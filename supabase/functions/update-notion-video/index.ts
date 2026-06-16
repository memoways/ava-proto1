import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_URL = "https://api.notion.com/v1";

interface UpdateRequest {
  notion_id: string;
  title?: string;
  context?: string;
  description?: string;
  priority?: number;
  themes?: string[];
  type?: string;
  transition_style?: string;
  video_url?: string | null;
}

function richText(value: string | undefined | null) {
  const v = (value ?? "").toString();
  return { rich_text: v ? [{ type: "text", text: { content: v.slice(0, 1900) } }] : [] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) throw new Error('NOTION_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = (await req.json().catch(() => ({}))) as UpdateRequest;
    if (!body.notion_id) {
      return new Response(JSON.stringify({ error: "notion_id is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const properties: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      properties["Titre de la vidéo"] = { title: [{ type: "text", text: { content: body.title.slice(0, 1900) } }] };
    }
    if (typeof body.context === "string") properties["Contexte"] = richText(body.context);
    if (typeof body.description === "string") properties["Description"] = richText(body.description);
    if (typeof body.priority === "number") properties["Priorité"] = { number: body.priority };
    if (Array.isArray(body.themes)) {
      properties["Thèmes"] = { multi_select: body.themes.map((name) => ({ name })) };
    }
    if (typeof body.type === "string") properties["Type"] = { select: { name: body.type } };
    if (typeof body.transition_style === "string") {
      properties["Style de transition"] = { select: { name: body.transition_style } };
    }
    if (body.video_url !== undefined) properties["URL Gumlet"] = { url: body.video_url || null };

    const res = await fetch(`${NOTION_API_URL}/pages/${body.notion_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let friendly = `Notion API error [${res.status}]`;
      if (res.status === 403 || res.status === 404) {
        friendly += ' — la base "Vidéos AVA" doit être partagée avec l\'intégration Notion utilisée par Lovable.';
      }
      console.error('[update-notion-video]', res.status, errText);
      return new Response(JSON.stringify({ error: friendly, detail: errText }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mirror to Supabase so the UI reflects the change immediately
    const localPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === "string") localPatch.title = body.title;
    if (typeof body.context === "string") {
      localPatch.context = body.context;
      localPatch.post_video_context = body.context;
    }
    if (typeof body.description === "string") localPatch.description = body.description;
    if (typeof body.priority === "number") localPatch.priority = body.priority;
    if (Array.isArray(body.themes)) localPatch.themes = body.themes;
    if (typeof body.type === "string") localPatch.type = body.type;
    if (typeof body.transition_style === "string") localPatch.transition_style = body.transition_style;
    if (body.video_url !== undefined) localPatch.video_url = body.video_url;

    const { error: upErr } = await supabase
      .from('video_triggers')
      .update(localPatch)
      .eq('notion_id', body.notion_id);
    if (upErr) console.warn('[update-notion-video] local mirror failed:', upErr);

    return new Response(JSON.stringify({ ok: true, notion_id: body.notion_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
