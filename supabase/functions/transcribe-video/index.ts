// Admin-only: listens to one SPOKEN film extract (Gumlet audio rendition) with
// Gemini 2.5 Flash and writes the words actually said to its Notion "Transcription"
// property, then mirrors it to video_triggers.transcription. The transcription stays
// unverified (a human ticks "Transcription vérifiée"). Never writes Description,
// Description IA or Dialogue. The one other write: when a VERIFIED transcription is
// replaced after an explicit confirmation, "Transcription vérifiée" is unticked.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { gumletAssetId, gumletMasterPlaylistUrl, variantMediaFileUrl } from "../_shared/videoDescription.ts";
import {
  assertOnlyTranscription,
  buildTranscribeRequest,
  buildTranscriptionNotionPatch,
  checkTranscribable,
  decideOverwrite,
  MAX_AUDIO_BYTES,
  normalizeTranscription,
  parseTranscribeVideoBody,
  pickAudioRendition,
  TRANSCRIBE_VIDEO_MODEL,
} from "../_shared/videoTranscription.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

class TranscribeError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

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

/** Master playlist → audio rendition → its single MP4/AAC file. Never invents a sound. */
async function downloadAudio(assetId: string): Promise<Uint8Array> {
  const masterUrl = gumletMasterPlaylistUrl(assetId);
  const rendition = pickAudioRendition(await fetchText(masterUrl));
  if (!rendition) throw new TranscribeError("no_audio_rendition", 422);
  const variantUrl = new URL(rendition.uri, masterUrl).toString();
  const fileUrl = variantMediaFileUrl(await fetchText(variantUrl), variantUrl);
  if (!fileUrl) throw new TranscribeError("no_audio_rendition", 422);
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`gumlet_media_${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES) throw new TranscribeError("video_too_large", 413);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_AUDIO_BYTES) throw new TranscribeError("video_too_large", 413);
  if (bytes.length === 0) throw new TranscribeError("no_audio_rendition", 422);
  return bytes;
}

async function callModel(apiKey: string, audioBase64: string) {
  const send = (mode: "input_audio" | "video_url") =>
    fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTranscribeRequest(audioBase64, mode)),
    });
  let res = await send("input_audio");
  // Some routes reject the audio part type: retry once as an MP4 media part (same bytes).
  if (res.status === 400 || res.status === 422) res = await send("video_url");
  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  try {
    const parsed = parseTranscribeVideoBody(await req.json().catch(() => ({})));
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!NOTION_API_KEY) return json({ error: 'NOTION_API_KEY is not configured' }, 500);
    if (!OPENROUTER_API_KEY) return json({ error: 'OPENROUTER_API_KEY is not configured' }, 500);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Media URL and labels come from the synced catalogue, never from the caller.
    const { data: video, error: readErr } = await supabase
      .from('video_triggers')
      .select('notion_id, video_url, nature, dialogue, transcription, transcription_verified')
      .eq('notion_id', parsed.notionId)
      .maybeSingle();
    if (readErr) return json({ error: readErr.message }, 500);
    if (!video) return json({ error: 'video_not_found' }, 404);

    const eligible = checkTranscribable(video);
    if (!eligible.ok) return json({ error: eligible.error }, 422);
    const overwrite = decideOverwrite(video, {
      reanalyze: parsed.reanalyze,
      confirmOverwriteVerified: parsed.confirmOverwriteVerified,
    });
    if (!overwrite.ok) return json({ error: overwrite.error }, 409);

    const assetId = gumletAssetId(video.video_url);
    if (!assetId) return json({ error: 'gumlet_url_missing' }, 422);

    const bytes = await downloadAudio(assetId);

    const aiRes = await callModel(OPENROUTER_API_KEY, toBase64(bytes));
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('[transcribe-video] LLM error', aiRes.status, txt.slice(0, 300));
      return json({ error: `llm_${aiRes.status}`, detail: txt.slice(0, 200) }, 502);
    }
    const ai = await aiRes.json();
    const transcription = normalizeTranscription(ai?.choices?.[0]?.message?.content);
    if (!transcription) {
      // Nothing is written: no speech (or an empty answer) is reported, never stored as text.
      return json({ ok: true, written: false, reason: 'no_speech_detected', notion_id: parsed.notionId, audio_bytes: bytes.length, usage: ai?.usage ?? null });
    }

    const patch = buildTranscriptionNotionPatch(transcription, { clearsVerified: overwrite.clearsVerified });
    assertOnlyTranscription(patch);
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
      console.error('[transcribe-video] Notion', notionRes.status, errText);
      return json({ error: `Notion API error [${notionRes.status}]`, detail: errText.slice(0, 200) }, 502);
    }

    const mirror: Record<string, unknown> = { transcription };
    if (overwrite.clearsVerified) mirror.transcription_verified = false;
    const { error: upErr } = await supabase.from('video_triggers').update(mirror).eq('notion_id', parsed.notionId);
    if (upErr) console.warn('[transcribe-video] local mirror failed:', upErr);

    const latencyMs = Date.now() - startedAt;
    console.log(`[transcribe-video] ${parsed.notionId.slice(0, 8)} bytes=${bytes.length} chars=${transcription.length} ms=${latencyMs}`);
    return json({
      ok: true,
      written: true,
      notion_id: parsed.notionId,
      transcription,
      verified_cleared: overwrite.clearsVerified,
      model: TRANSCRIBE_VIDEO_MODEL,
      audio_bytes: bytes.length,
      latency_ms: latencyMs,
      usage: ai?.usage ?? null,
      mirrored: !upErr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[transcribe-video]', message);
    if (err instanceof TranscribeError) return json({ error: message }, err.status);
    return json({ error: message }, message === 'transcription_too_long' ? 413 : 502);
  }
});
