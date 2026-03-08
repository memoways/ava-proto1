import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY")!;
const NOTION_DATABASE_ID = "31d62322e595804795cbca5bf679d053";

// Map app values to Notion select option names
const LATENCY_MAP: Record<string, string> = {
  pas_du_tout: "Pas du tout",
  un_peu: "Un peu",
  beaucoup: "Beaucoup",
};

const UNDERSTOOD_MAP: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  partiellement: "Partiellement",
};

const PAY_MAP: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  peut_etre: "Peut-être",
};

const PRICE_MAP: Record<string, string> = {
  "0-5": "0-5€",
  "5-15": "5-15€",
  "15-30": "15-30€",
  "30+": "30€+",
};

const FORMAT_MAP: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  vr: "VR",
  autre: "Autre",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, questionnaire, trustLevel, durationSeconds, gameOverReason } = await req.json();

    const properties: Record<string, any> = {
      "Nom": { title: [{ text: { content: `Session ${sessionId?.slice(0, 8) || "unknown"}` } }] },
      "Session ID": { rich_text: [{ text: { content: sessionId || "" } }] },
      "Note experience": { number: questionnaire.experience_rating },
      "Mot experience": { rich_text: [{ text: { content: questionnaire.experience_word || "" } }] },
      "NPS": { number: questionnaire.nps },
      "Immersion histoire": { number: questionnaire.immersion_story },
      "Immersion naturel": { number: questionnaire.immersion_natural },
      "Ecoute Max": { number: questionnaire.mechanic_listening },
      "Envie continuer": { number: questionnaire.narration_continue },
      "Feedback ouvert": { rich_text: [{ text: { content: questionnaire.open_feedback || "" } }] },
      "Trust final": { number: trustLevel ?? 0 },
      "Duree secondes": { number: durationSeconds ?? 0 },
      "Raison fin": { rich_text: [{ text: { content: gameOverReason || "" } }] },
      "Date soumission": { date: { start: new Date().toISOString() } },
    };

    // Add select fields only if they have values
    if (questionnaire.mechanic_latency && LATENCY_MAP[questionnaire.mechanic_latency]) {
      properties["Latence genante"] = { select: { name: LATENCY_MAP[questionnaire.mechanic_latency] } };
    }
    if (questionnaire.narration_understood && UNDERSTOOD_MAP[questionnaire.narration_understood]) {
      properties["Compris objectif"] = { select: { name: UNDERSTOOD_MAP[questionnaire.narration_understood] } };
    }
    if (questionnaire.value_pay && PAY_MAP[questionnaire.value_pay]) {
      properties["Pret a payer"] = { select: { name: PAY_MAP[questionnaire.value_pay] } };
    }
    if (questionnaire.value_price && PRICE_MAP[questionnaire.value_price]) {
      properties["Fourchette prix"] = { select: { name: PRICE_MAP[questionnaire.value_price] } };
    }
    if (questionnaire.value_format && FORMAT_MAP[questionnaire.value_format]) {
      properties["Format prefere"] = { select: { name: FORMAT_MAP[questionnaire.value_format] } };
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Notion] Failed to create page:", err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    console.log("[Notion] Questionnaire synced:", data.id);

    return new Response(JSON.stringify({ success: true, notionPageId: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Notion] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
