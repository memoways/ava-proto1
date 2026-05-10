// Compresses the running conversation of a session into a bullet-point summary,
// stored in `session_summaries` and injected back into Max's system prompt.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface ConversationMessage {
  role: "user" | "max" | "assistant";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = (body?.session_id || "").toString();
    const conversation: ConversationMessage[] = Array.isArray(body?.conversation) ? body.conversation : [];
    const turnCount = Number(body?.turn_count ?? 0);

    if (!sessionId || !conversation.length) {
      return new Response(JSON.stringify({ error: "session_id and conversation are required" }), {
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
      .maybeSingle();

    const previousSummary = prev?.summary || "";

    // Format the conversation as plain text (capped to last 24 turns to keep prompt small)
    const recent = conversation.slice(-24).map((m) =>
      `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`
    ).join("\n");

    const systemPrompt = `Tu es un compresseur de mémoire pour un agent narratif (Max) lors d'une session de jeu de 10 minutes.\n\nTu produis un résumé en bullet-points (FR) destiné à être réinjecté dans le system prompt de Max au tour suivant.\n\nRègles:\n- Maximum 8 bullets, chacun ≤ 18 mots.\n- Sépare en 3 sections: "Faits sur l'utilisateur", "Sujets déjà abordés", "Promesses/engagements de Max".\n- N'invente RIEN. Si une section est vide, écris "(rien)".\n- Pas de méta-commentaire, pas d'introduction.\n- Conserve les informations utiles à la cohérence (prénoms, détails personnels, choix narratifs).`;

    const userPrompt = `Résumé précédent (à enrichir, pas à répéter mot pour mot):\n${previousSummary || "(aucun)"}\n\nÉchanges récents:\n${recent}\n\nProduis le nouveau résumé compressé:`;

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
        { session_id: sessionId, summary, last_turn: turnCount, updated_at: new Date().toISOString() },
        { onConflict: "session_id" },
      );

    if (upsertErr) {
      console.error("[summarize-session] upsert error", upsertErr.message);
    }

    console.log(`[summarize-session] session=${sessionId.slice(0, 8)} turn=${turnCount} chars=${summary.length}`);

    return new Response(
      JSON.stringify({ summary, last_turn: turnCount, model: MODEL, latency_ms: Date.now() - startedAt }),
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
