// Lightweight query rewriter — turns a follow-up like "et toi ?" into a self-contained
// search query that RAG (vector + rerank) can match meaningfully.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userMessage = (body?.user_message || "").toString().trim();
    const recentContext = (body?.recent_context || "").toString().slice(0, 1500);
    const characterName = (body?.character_name || "Max").toString();

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "user_message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cheap heuristic: if the message is already self-contained and >= 6 words,
    // skip the LLM round-trip.
    const wordCount = userMessage.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 6 && !/^(et toi|et vous|pourquoi|comment|et\s|ah\s|ok|d'accord)\b/i.test(userMessage)) {
      return new Response(
        JSON.stringify({ query: userMessage, rewritten: false, latency_ms: Date.now() - startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Tu es un assistant qui reformule la dernière phrase d'un utilisateur en une requête de recherche autonome en français pour un index sémantique.\n\nRègles:\n- Réutilise les références implicites de l'historique (pronoms, sujets sous-entendus).\n- Conserve l'intention exacte. N'ajoute aucun fait nouveau.\n- Réponds UNIQUEMENT par la requête reformulée, sans guillemets, sans préfixe, sans ponctuation finale.\n- Maximum 18 mots.\n- Le personnage interrogé est ${characterName}.`;

    const userPrompt = `Historique récent:\n${recentContext || "(vide)"}\n\nDernière phrase de l'utilisateur: ${userMessage}\n\nRequête de recherche autonome:`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 80,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[rewrite-query] LLM error", aiRes.status, txt.slice(0, 300));
      // Fail-open: return original message
      return new Response(
        JSON.stringify({ query: userMessage, rewritten: false, error: `llm_${aiRes.status}`, latency_ms: Date.now() - startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    let rewritten = (data?.choices?.[0]?.message?.content || "").toString().trim();
    // Strip surrounding quotes
    rewritten = rewritten.replace(/^["'«»]+|["'«»]+$/g, "").trim();
    if (!rewritten) rewritten = userMessage;

    return new Response(
      JSON.stringify({
        query: rewritten,
        rewritten: rewritten !== userMessage,
        original: userMessage,
        model: MODEL,
        latency_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[rewrite-query] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
