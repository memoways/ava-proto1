// Admin-only: watches one catalogue video (Gumlet 360p rendition, no sound) with
// Gemini 2.5 Flash and writes the result to its Notion "Description IA" property,
// then mirrors it to video_triggers.ai_description. Never reads or writes the
// human Description, nor any other field.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";
import {
  assertOnlyAiDescription,
  buildAiDescriptionNotionPatch,
  buildDescribeVideoRequest,
  DESCRIBE_VIDEO_MODEL,
  gumletAssetId,
  gumletMasterPlaylistUrl,
  MAX_VIDEO_BYTES,
  normalizeAiDescription,
  parseDescribeVideoBody,
  pickAnalysisVariant,
  variantMediaFileUrl,
} from "../_shared/videoDescription.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gumlet_${res.status}`);
  return res.text();
}

/** Master playlist → analysis rendition → its single MP4 file (video track only). */
async function downloadAnalysisVideo(assetId: string): Promise<Uint8Array> {
  const masterUrl = gumletMasterPlaylistUrl(assetId);
  const variant = pickAnalysisVariant(await fetchText(masterUrl));
  if (!variant) throw new Error("gumlet_no_rendition");
  const variantUrl = new URL(variant, masterUrl).toString();
  const fileUrl = variantMediaFileUrl(await fetchText(variantUrl), variantUrl);
  if (!fileUrl) throw new Error("gumlet_unsupported_rendition");
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`gumlet_media_${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_BYTES) throw new Error("video_too_large");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error("video_too_large");
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  try {
    const parsed = parseDescribeVideoBody(await req.json().catch(() => ({})));
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!NOTION_API_KEY) return json({ error: 'NOTION_API_KEY is not configured' }, 500);
    if (!OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY is not configured' }, 500);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // The media URL comes from the synced catalogue, never from the caller.
    const { data: video, error: readErr } = await supabase
      .from('video_triggers')
      .select('notion_id, video_url')
      .eq('notion_id', parsed.notionId)
      .maybeSingle();
    if (readErr) return json({ error: readErr.message }, 500);
    if (!video) return json({ error: 'video_not_found' }, 404);
    const assetId = gumletAssetId(video.video_url);
    if (!assetId) return json({ error: 'gumlet_url_missing' }, 422);

    const bytes = await downloadAnalysisVideo(assetId);

    const aiRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDescribeVideoRequest(toBase64(bytes))),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('[describe-video] LLM error', aiRes.status, txt.slice(0, 300));
      return json({ error: `llm_${aiRes.status}`, detail: txt.slice(0, 200) }, 502);
    }
    const ai = await aiRes.json();
    const description = normalizeAiDescription(ai?.choices?.[0]?.message?.content);
    if (!description) return json({ error: 'empty_description' }, 502);

    const patch = buildAiDescriptionNotionPatch(description);
    assertOnlyAiDescription(patch);
    const notionRes = await fetch(`${NOTION_API_URL}/pages/${parsed.notionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(patch),
    });
    if (!notionRes.ok) {
      const errText = await notionRes.text();
      console.error('[describe-video] Notion', notionRes.status, errText);
      return json({ error: `Notion API error [${notionRes.status}]`, detail: errText.slice(0, 200) }, 502);
    }

    const { error: upErr } = await supabase
      .from('video_triggers')
      .update({ ai_description: description })
      .eq('notion_id', parsed.notionId);
    if (upErr) console.warn('[describe-video] local mirror failed:', upErr);

    const latencyMs = Date.now() - startedAt;
    console.log(`[describe-video] ${parsed.notionId.slice(0, 8)} bytes=${bytes.length} chars=${description.length} ms=${latencyMs}`);
    return json({
      ok: true,
      notion_id: parsed.notionId,
      ai_description: description,
      model: DESCRIBE_VIDEO_MODEL,
      video_bytes: bytes.length,
      latency_ms: latencyMs,
      usage: ai?.usage ?? null,
      mirrored: !upErr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[describe-video]', message);
    return json({ error: message }, message === 'video_too_large' ? 413 : 502);
  }
});
