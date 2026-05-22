// summarize-role — PRD4 Phase 2
// Takes the raw voice transcript describing the player's role and produces
// a structured `user_role_profile_json` used by Max (summary_for_max) and
// shown back to the player (summary_for_user).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

interface UserRoleProfile {
  raw_input: string;
  summary_for_user: string;
  summary_for_max: string;
  relationship_to_family: string;
  age: string;
  gender: string;
  proximity_level: string;
  intent: string;
  created_by_system: boolean;
  created_at: string;
}

const SYSTEM_PROMPT = `Tu es un assistant narratif. À partir de la présentation libre d'un joueur, tu produis un profil structuré en JSON STRICT (aucun texte hors JSON).

Contexte : le joueur s'apprête à appeler par visioconférence Max, le père d'Ava (jeune femme infectée par le virus Protogyny). Le joueur invente librement qui il est par rapport à la famille (Max, Emma, Léo, Ava).

Tu dois retourner EXACTEMENT cet objet JSON, avec ces clés :
{
  "summary_for_user": "string — 1 à 2 phrases en FR, à la 2e personne ('Tu es...'), miroir bienveillant et fidèle de ce que le joueur a dit. Pas d'invention.",
  "summary_for_max": "string — 3 à 5 lignes en FR, 3e personne, à injecter dans le system prompt de Max. Décrit qui appelle, sa relation supposée à la famille, son intention apparente. Ne contredit jamais la présentation.",
  "relationship_to_family": "string courte — ex: 'amie d'Ava', 'psychologue mandaté', 'voisin', 'inconnu'",
  "age": "string courte — ex: '30 ans', 'la trentaine', 'inconnu'",
  "gender": "string — 'féminin' | 'masculin' | 'non précisé'",
  "proximity_level": "string — 'proche' | 'connaissance' | 'professionnel' | 'inconnu'",
  "intent": "string courte — pourquoi il/elle appelle d'après la présentation"
}

Règles :
- Si une info n'est pas dans la présentation, mets "inconnu" / "non précisé" — n'invente jamais.
- Reste fidèle au ton et aux mots du joueur.
- Pas de markdown, pas de \`\`\`, pas de commentaire. Uniquement l'objet JSON.`;

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```json\s*|```$/g, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawInput = (body?.raw_input || "").toString().trim();
    const model = (body?.model || DEFAULT_MODEL).toString();

    if (rawInput.length < 5) {
      return new Response(JSON.stringify({ error: "raw_input too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ava-prototype.lovable.app",
        "X-Title": "AVA PRD4 — summarize-role",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Présentation du joueur :\n"""${rawInput}"""\n\nProduis le JSON.` },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[summarize-role] LLM error", aiRes.status, txt.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `llm_${aiRes.status}`, detail: txt.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const content = (data?.choices?.[0]?.message?.content || "").toString();
    const parsed = extractJson(content);

    if (!parsed) {
      console.error("[summarize-role] JSON parse failed, raw:", content.slice(0, 300));
      return new Response(JSON.stringify({ error: "invalid_json", raw: content.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile: UserRoleProfile = {
      raw_input: rawInput,
      summary_for_user: (parsed.summary_for_user || "").toString().trim(),
      summary_for_max: (parsed.summary_for_max || "").toString().trim(),
      relationship_to_family: (parsed.relationship_to_family || "inconnu").toString(),
      age: (parsed.age || "inconnu").toString(),
      gender: (parsed.gender || "non précisé").toString(),
      proximity_level: (parsed.proximity_level || "inconnu").toString(),
      intent: (parsed.intent || "inconnu").toString(),
      created_by_system: true,
      created_at: new Date().toISOString(),
    };

    if (!profile.summary_for_user || !profile.summary_for_max) {
      return new Response(JSON.stringify({ error: "missing_summaries", profile }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[summarize-role] ok model=${model} chars_in=${rawInput.length} latency_ms=${Date.now() - startedAt}`,
    );

    return new Response(
      JSON.stringify({ profile, model, latency_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[summarize-role] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
