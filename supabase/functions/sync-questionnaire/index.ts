import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import { buildQuestionnaireProps, type SyncQuestionnairePayload } from "../_shared/questionnaireNotionProps.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY")!;
const NOTION_DATABASE_ID = "31d62322e595804795cbca5bf679d053";

async function fetchDatabaseProperties(): Promise<Set<string>> {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) {
    console.warn("[Notion] Could not fetch DB schema, sending all props:", await res.text());
    return new Set();
  }
  const data = await res.json();
  return new Set(Object.keys(data.properties || {}));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const payload = await req.json() as SyncQuestionnairePayload;
    const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : null;
    const denied = await enforceGameRequest(req, "sync-questionnaire", corsHeaders, sessionId);
    if (denied) return denied;
    const version = payload?.questionnaire?.version;
    const allProps = buildQuestionnaireProps(payload);

    // Filtre : ne garde que les propriétés qui existent dans la base Notion.
    const existing = await fetchDatabaseProperties();
    let props = allProps;
    const skipped: string[] = [];
    if (existing.size > 0) {
      props = {};
      for (const [k, v] of Object.entries(allProps)) {
        if (existing.has(k)) props[k] = v;
        else skipped.push(k);
      }
      if (skipped.length) console.warn("[Notion] Skipped missing props:", skipped);
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ parent: { database_id: NOTION_DATABASE_ID }, properties: props }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Notion] Failed to create page:", err);
      return new Response(JSON.stringify({ error: err, skipped_props: skipped }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    console.log(`[Notion] Questionnaire synced (version=${version || "legacy"}):`, data.id);
    return new Response(
      JSON.stringify({ success: true, notionPageId: data.id, version: version || "legacy", skipped_props: skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Notion] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
