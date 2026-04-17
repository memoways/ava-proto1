import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY")!;
const NOTION_DATABASE_ID = "31d62322e595804795cbca5bf679d053";

const SELECT_MAPS: Record<string, Record<string, string>> = {
  mechanic_latency: { pas_du_tout: "Pas du tout", un_peu: "Un peu", beaucoup: "Beaucoup" },
  narration_understood: { oui: "Oui", non: "Non", partiellement: "Partiellement" },
  gm_role_understood: { oui: "Oui", non: "Non", partiellement: "Partiellement" },
  value_pay: { oui: "Oui", non: "Non", peut_etre: "Peut-être" },
  value_price: { "0-5": "0-5€", "5-15": "5-15€", "15-30": "15-30€", "30+": "30€+" },
  value_format: { web: "Web", mobile: "Mobile", vr: "VR", autre: "Autre" },
  latency_perceived: { fluide: "Fluide", acceptable: "Acceptable", genante: "Gênante" },
  ptt_release_issues: { aucun: "Aucun", parfois: "Parfois", souvent: "Souvent" },
};

function selectProp(field: string, value: string | undefined) {
  if (!value) return null;
  const map = SELECT_MAPS[field];
  const name = map?.[value] || value;
  return { select: { name } };
}

function numProp(value: number | undefined | null) {
  return value != null ? { number: value } : null;
}

function textProp(value: string | undefined | null) {
  return value ? { rich_text: [{ text: { content: value } }] } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, questionnaire: q, trustLevel, durationSeconds, gameOverReason, variant, voiceModality } = await req.json();

    // Build properties — only set non-null values
    const props: Record<string, any> = {};
    const set = (key: string, val: any) => { if (val != null) props[key] = val; };

    // Title (required)
    props["Nom"] = { title: [{ text: { content: `Session ${sessionId?.slice(0, 8) || "unknown"}` } }] };

    // Metadata
    set("Session ID", textProp(sessionId));
    set("Variante", variant ? { select: { name: variant } } : null);
    set("Modalite voix", voiceModality ? { select: { name: voiceModality } } : null);
    set("Trust final", numProp(trustLevel));
    set("Duree secondes", numProp(durationSeconds));
    set("Raison fin", textProp(gameOverReason));
    set("Date soumission", { date: { start: new Date().toISOString() } });

    // Block 1 — Global
    set("Note experience", numProp(q.experience_rating));
    set("Mot experience", textProp(q.experience_word));
    set("NPS", numProp(q.nps));

    // Block 2 — GM
    set("GM clarte", numProp(q.gm_clarity));
    set("GM role compris", selectProp("gm_role_understood", q.gm_role_understood));
    set("GM immersion intro", numProp(q.gm_immersion_intro));

    // Block 3A — Variante A
    set("A cocreation engage", numProp(q.a_cocreation_engaged));
    set("A cocreation naturel", numProp(q.a_cocreation_natural));
    set("A cocreation libre", textProp(q.a_cocreation_freeform));

    // Block 3B — Variante B
    set("B narrateur immersif", numProp(q.b_narrator_immersive));
    set("B narrateur libre", textProp(q.b_narrator_freeform));

    // Block 4 — Voix
    set("Voix Max naturel", numProp(q.voice_naturalness));
    set("Voix GM naturel", numProp(q.voice_gm_naturalness));
    set("Modalite confort", numProp(q.voice_modality_comfort));
    set("PTT bouton clair", numProp(q.ptt_button_clear));
    set("PTT relachement", selectProp("ptt_release_issues", q.ptt_release_issues));

    // Block 5 — Latence
    set("Latence percue", selectProp("latency_perceived", q.latency_perceived));
    set("Latence moments", textProp(q.latency_moments));
    set("Latence genante", selectProp("mechanic_latency", q.mechanic_latency));

    // Block 6 — Immersion
    set("Immersion histoire", numProp(q.immersion_story));
    set("Immersion naturel", numProp(q.immersion_natural));
    set("Ecoute Max", numProp(q.mechanic_listening));
    set("Compris objectif", selectProp("narration_understood", q.narration_understood));
    set("Envie continuer", numProp(q.narration_continue));
    set("Feedback ouvert", textProp(q.open_feedback));

    // Block 7 — Value
    set("Pret a payer", selectProp("value_pay", q.value_pay));
    set("Fourchette prix", selectProp("value_price", q.value_price));
    set("Format prefere", selectProp("value_format", q.value_format));

    // Block 8 — Contact
    if (q.contact_name) props["Nom contact"] = { rich_text: [{ text: { content: q.contact_name } }] };
    if (q.contact_email) props["Email contact"] = { email: q.contact_email };
    if (q.opt_in_feedback) props["Opt-in feedback"] = { checkbox: true };
    if (q.opt_in_updates) props["Opt-in updates"] = { checkbox: true };

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
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    console.log("[Notion] Questionnaire synced:", data.id);
    return new Response(JSON.stringify({ success: true, notionPageId: data.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[Notion] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
