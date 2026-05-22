import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY")!;
const NOTION_DATABASE_ID = "31d62322e595804795cbca5bf679d053";

// ============================================================================
// Legacy (PRD1/2/3) mapping
// ============================================================================
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
  return value ? { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] } : null;
}

function buildLegacyProps(payload: any) {
  const { sessionId, questionnaire: q, trustLevel, durationSeconds, gameOverReason, variant, voiceModality } = payload;
  const props: Record<string, any> = {};
  const set = (k: string, v: any) => { if (v != null) props[k] = v; };

  props["Nom"] = { title: [{ text: { content: `Session ${sessionId?.slice(0, 8) || "unknown"}` } }] };
  set("Session ID", textProp(sessionId));
  set("Variante onboarding", variant ? { select: { name: variant } } : null);
  set("Modalite voix", voiceModality ? { select: { name: voiceModality } } : null);
  set("Trust final", numProp(trustLevel));
  set("Duree secondes", numProp(durationSeconds));
  set("Raison fin", textProp(gameOverReason));
  set("Date soumission", { date: { start: new Date().toISOString() } });

  set("Note experience", numProp(q.experience_rating));
  set("Mot experience", textProp(q.experience_word));
  set("NPS", numProp(q.nps));
  set("GM clarte", numProp(q.gm_clarity));
  set("GM role compris", selectProp("gm_role_understood", q.gm_role_understood));
  set("GM immersion intro", numProp(q.gm_immersion_intro));
  set("A cocreation engage", numProp(q.a_cocreation_engaged));
  set("A cocreation naturel", numProp(q.a_cocreation_natural));
  set("A cocreation libre", textProp(q.a_cocreation_freeform));
  set("B narrateur immersif", numProp(q.b_narrator_immersive));
  set("B narrateur libre", textProp(q.b_narrator_freeform));
  set("Voix Max naturel", numProp(q.voice_naturalness));
  set("Voix GM naturel", numProp(q.voice_gm_naturalness));
  set("Modalite confort", numProp(q.voice_modality_comfort));
  set("PTT bouton clair", numProp(q.ptt_button_clear));
  set("PTT relachement", selectProp("ptt_release_issues", q.ptt_release_issues));
  set("Latence percue", selectProp("latency_perceived", q.latency_perceived));
  set("Latence moments", textProp(q.latency_moments));
  set("Latence genante", selectProp("mechanic_latency", q.mechanic_latency));
  set("Immersion histoire", numProp(q.immersion_story));
  set("Immersion naturel", numProp(q.immersion_natural));
  set("Ecoute Max", numProp(q.mechanic_listening));
  set("Compris objectif", selectProp("narration_understood", q.narration_understood));
  set("Envie continuer", numProp(q.narration_continue));
  set("Feedback ouvert", textProp(q.open_feedback));
  set("Pret a payer", selectProp("value_pay", q.value_pay));
  set("Fourchette prix", selectProp("value_price", q.value_price));
  set("Format prefere", selectProp("value_format", q.value_format));

  if (q.contact_name) props["Nom contact"] = { rich_text: [{ text: { content: q.contact_name } }] };
  if (q.contact_email) props["Email contact"] = { email: q.contact_email };
  if (q.opt_in_feedback) props["Opt-in feedback"] = { checkbox: true };
  if (q.opt_in_updates) props["Opt-in updates"] = { checkbox: true };

  return props;
}

// ============================================================================
// PRD4 §14.4 mapping
// ============================================================================
const PRD4_DURATION_MAP: Record<string, string> = {
  trop_court: "Trop court",
  juste: "Juste",
  trop_long: "Trop long",
};
const PRD4_CHARACTER_MAP: Record<string, string> = {
  emma: "Emma",
  ava: "Ava",
  leo: "Léo",
  max: "Max encore",
  aucun: "Aucun",
};

function buildPRD4Props(payload: any) {
  const { sessionId, questionnaire } = payload;
  const a = questionnaire.answers || {};
  const t = questionnaire.technical || {};
  const props: Record<string, any> = {};
  const set = (k: string, v: any) => { if (v != null) props[k] = v; };

  props["Nom"] = { title: [{ text: { content: `PRD4 ${sessionId?.slice(0, 8) || "session"}` } }] };
  set("Session ID", textProp(sessionId));
  set("Modalite voix", { select: { name: "push_to_talk" } });
  set("Date soumission", { date: { start: t.submitted_at || new Date().toISOString() } });
  set("Duree secondes", numProp(t.duration_seconds));

  // PRD4 spécifique
  set("PRD4 A vu le film", a.q1_film_seen ? { select: { name: a.q1_film_seen === "oui" ? "Oui" : "Non" } } : null);
  set("PRD4 Teaser vu", { checkbox: !!t.teaser_seen });
  set("PRD4 Teaser skippé", { checkbox: !!t.teaser_skipped });
  set("PRD4 Teaser utile score", numProp(a.q2_teaser_helpful));
  set("PRD4 Role creation clarte", numProp(a.q3_role_clarity));
  set("PRD4 Role summary justesse", numProp(a.q4_role_summary_accuracy));
  set("PRD4 PTT clarte", numProp(a.q5_ptt_clarity));
  set("PRD4 PTT frustration", numProp(t.ptt_errors));
  set("PRD4 Max reconnait role", numProp(a.q6_max_used_role));
  set("PRD4 Max credible personnage", numProp(a.q7_max_credible));
  set("PRD4 Envie autres personnages", numProp(a.q8_want_other_characters));
  set(
    "PRD4 Personnage souhaite prochain",
    a.q8b_next_character_wanted
      ? { select: { name: PRD4_CHARACTER_MAP[a.q8b_next_character_wanted] || a.q8b_next_character_wanted } }
      : null,
  );
  set(
    "PRD4 Duree ressentie",
    a.q9_duration_feeling
      ? { select: { name: PRD4_DURATION_MAP[a.q9_duration_feeling] || a.q9_duration_feeling } }
      : null,
  );
  set("PRD4 Rupture immersion", textProp(a.q10_open_feedback));

  if (t.role_profile) {
    set("PRD4 Role JSON", textProp(JSON.stringify(t.role_profile)));
  }
  set("PRD4 Nb tours", numProp(t.turn_count));
  set("PRD4 Latence moyenne ms", numProp(t.avg_latency_ms));
  set("PRD4 Latence max ms", numProp(t.max_latency_ms));
  set("PRD4 Erreurs PTT", numProp(t.ptt_errors));

  if (a.contact_email) props["PRD4 Email contact"] = { email: a.contact_email };
  if (a.opt_in_updates) props["PRD4 Être tenu au courant"] = { checkbox: true };
  if (a.opt_in_feedback) props["PRD4 Contact feedback détaillé"] = { checkbox: true };

  // Aussi écrire l'email dans le champ générique pour homogénéité
  if (a.contact_email) props["Email contact"] = { email: a.contact_email };
  if (a.opt_in_updates) props["Opt-in updates"] = { checkbox: true };
  if (a.opt_in_feedback) props["Opt-in feedback"] = { checkbox: true };

  return props;
}

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
    const payload = await req.json();
    const version = payload?.questionnaire?.version;
    const allProps = version === "prd4" ? buildPRD4Props(payload) : buildLegacyProps(payload);

    // Filtre : ne garde que les propriétés qui existent dans la base Notion.
    const existing = await fetchDatabaseProperties();
    let props = allProps;
    let skipped: string[] = [];
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

