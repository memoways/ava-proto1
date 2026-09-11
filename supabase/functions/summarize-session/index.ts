// Compresses the running conversation of a session into a bullet-point summary,
// stored in `session_summaries` and injected only into the same character.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

interface ConversationMessage {
  role: "user" | "max" | "emma" | "assistant";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = (body?.session_id || "").toString();
    const conversation: ConversationMessage[] = Array.isArray(body?.conversation) ? body.conversation : [];
    const turnCount = Number(body?.turn_count ?? 0);
    const characterKey = body?.character_key === "emma" ? "emma" : body?.character_key === "max" ? "max" : null;
    const characterContext = body?.character_context && typeof body.character_context === "object"
      ? body.character_context as Record<string, unknown>
      : null;
    const denied = await enforceGameRequest(req, "summarize-session", corsHeaders, sessionId || null);
    if (denied) return denied;

    if (!sessionId || !conversation.length || !characterKey) {
      return new Response(JSON.stringify({ error: "session_id, character_key and conversation are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (characterContext && characterContext.characterKey !== characterKey) {
      return new Response(JSON.stringify({ error: "character_context attribution mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load previous summary if any
    const { data: prev } = await supabase
      .from("session_summaries")
      .select("summary, last_turn")
      .eq("session_id", sessionId)
      .eq("character_key", characterKey)
      .maybeSingle();

    const previousSummary = prev?.summary || "";

    // Format the conversation as plain text (capped to last 24 turns to keep prompt small)
    const speaker = characterKey === "emma" ? "EMMA" : "MAX";
    const recent = conversation
      .filter((message) => message.role === "user" || message.role === characterKey || message.role === "assistant")
      .slice(-24).map((m) =>
      `${m.role === "user" ? "UTILISATEUR" : speaker}: ${m.content}`
    ).join("\n");

    const displayName = characterKey === "emma" ? "Emma" : "Max";
    const attribution = characterContext
      ? `character_id=${String(characterContext.characterId || "")}; notion_page_id=${String(characterContext.notionPageId || "")}; environment=${String(characterContext.environmentId || "")}; prompt_version=${String(characterContext.promptUpdatedAt || "")}`
      : `character_key=${characterKey}`;
    const systemPrompt = `Tu es un compresseur de mémoire pour l'agent narratif ${displayName}. Attribution immuable : ${attribution}.\n\nTu produis un résumé en bullet-points (FR) destiné uniquement au prochain tour de ${displayName}.\n\nRègles:\n- Maximum 9 bullets, chacun ≤ 18 mots.\n- Utilise quatre sections utiles seulement : "Faits sur l'utilisateur", "Sujets déjà abordés", "Promesses/engagements de ${displayName}", "État relationnel".\n- Dans "État relationnel", conserve en une ou deux puces la confiance atteinte, les tensions et ce que ${displayName} accepte désormais de révéler.\n- N'attribue jamais à ${displayName} les paroles ou souvenirs d'un autre personnage.\n- N'invente RIEN et omets toute section vide.\n- Pas de méta-commentaire, pas d'introduction.\n- Conserve les informations utiles à la cohérence (prénoms, détails personnels, choix narratifs).`;

    const userPrompt = `Résumé précédent (à enrichir, pas à répéter mot pour mot):\n${previousSummary || "(aucun)"}\n\nÉchanges récents:\n${recent}\n\nProduis le nouveau résumé compressé:`;

    const aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[summarize-session] LLM error", aiRes.status, txt.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `llm_${aiRes.status}`, detail: txt.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const summary = (data?.choices?.[0]?.message?.content || "").toString().trim();

    if (!summary) {
      return new Response(JSON.stringify({ error: "empty_summary" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert
    const { error: upsertErr } = await supabase
      .from("session_summaries")
      .upsert(
        { session_id: sessionId, character_key: characterKey, summary, last_turn: turnCount, updated_at: new Date().toISOString() },
        { onConflict: "session_id,character_key" },
      );

    if (upsertErr) {
      console.error("[summarize-session] upsert error", upsertErr.message);
    }

    console.log(`[summarize-session] session=${sessionId.slice(0, 8)} character=${characterKey} turn=${turnCount} chars=${summary.length}`);

    return new Response(
      JSON.stringify({ character_key: characterKey, summary, last_turn: turnCount, model: MODEL, latency_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[summarize-session] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
