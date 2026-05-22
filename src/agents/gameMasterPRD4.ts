/**
 * PRD4 — Évaluateur post-tour du Game Master.
 *
 * Appelé en void après chaque réponse de Max (n'est jamais sur le chemin
 * critique du TTS). Retourne le schéma PRD4 §10.3 et persiste l'entrée dans
 * `sessions.gm_post_turn_log` (jsonb append-only).
 */
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { getLLMSettings } from "@/services/settingsService";
import type { ConversationMessage, PRD4PostTurnEvaluation, UserRoleProfile } from "@/types";

export interface PRD4PostTurnInput {
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  userRole: UserRoleProfile | null;
  turnIndex: number;
  timeElapsedSeconds: number;
}

const DEFAULT_RESULT: PRD4PostTurnEvaluation = {
  engagement_delta: 0,
  confusion_detected: false,
  role_usage_quality: "unknown",
  topics_covered: [],
  transition_recommended: false,
  cinematic_hint: null,
  next_turn_guidance: "Continue la conversation naturellement.",
  end_recommended: false,
  moderation_flag: false,
  notes: "Évaluation par défaut (LLM indisponible).",
};

const SYSTEM_PROMPT = `Tu es le Game Master d'une expérience narrative en temps réel de ~5 minutes entre un joueur et Max (père d'Ava). Après chaque échange (1 message utilisateur + 1 réponse de Max), tu produis une évaluation structurée en JSON STRICT — aucun texte hors JSON.

Tu retournes EXACTEMENT cet objet :
{
  "engagement_delta": number,       // -2..+2 — qualité de l'échange pour le joueur
  "confusion_detected": boolean,    // true si le joueur semble perdu ou Max contradictoire
  "role_usage_quality": "low" | "medium" | "high" | "unknown", // Max exploite-t-il le profil joueur ?
  "topics_covered": string[],       // 1-4 mots-clés courts des sujets abordés
  "transition_recommended": boolean,// faut-il proposer un changement de rythme ?
  "cinematic_hint": string | null,  // suggestion narrative courte ou null
  "next_turn_guidance": string,     // 1 phrase concise pour guider Max au prochain tour
  "end_recommended": boolean,       // true si la session a atteint un point naturel de fin
  "moderation_flag": boolean,       // true si contenu problématique
  "notes": string                   // 1 phrase courte de raison
}

Règles :
- "end_recommended" = true seulement si la conversation a vraiment trouvé une clôture naturelle, ou si elle est en train d'échouer (hors-sujet répété, abandon). Sois conservateur — la session dure ~5 minutes max et sera coupée par le timer si besoin.
- Pas de markdown, pas de \`\`\`, pas de commentaire. Uniquement l'objet JSON.`;

function extractJson(text: string): unknown {
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

function buildUserPrompt(input: PRD4PostTurnInput): string {
  const recent = input.conversationHistory.slice(-6).map((m) =>
    `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`
  ).join("\n");

  return `## PROFIL JOUEUR
${input.userRole?.summary_for_max || "(profil indisponible)"}

## TEMPS ÉCOULÉ
${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s sur ~5 min cible — tour #${input.turnIndex}

## HISTORIQUE RÉCENT
${recent || "(aucun)"}

## DERNIER ÉCHANGE (à évaluer)
UTILISATEUR: ${input.userMessage}
MAX: ${input.maxResponse}

Retourne l'évaluation JSON.`;
}

/**
 * Évalue le tour qui vient de se jouer. Toujours résout (jamais throw).
 * Persiste dans `sessions.gm_post_turn_log` si sessionId fourni.
 */
export async function evaluatePostTurnPRD4(
  input: PRD4PostTurnInput,
): Promise<PRD4PostTurnEvaluation> {
  const startedAt = performance.now();
  let result: PRD4PostTurnEvaluation;
  let model = "";
  try {
    const llm = getLLMSettings();
    model = llm.LLM_MODEL_GM;
    const callRes = await callLLMWithUsage(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      {
        model: llm.LLM_MODEL_GM,
        temperature: 0.2,
        max_tokens: llm.LLM_MAX_TOKENS_GM ?? 250,
        feature_key: "prd4_gm_post_turn",
        session_id: input.sessionId ?? undefined,
      },
    );
    const parsed = extractJson(callRes.content) as Partial<PRD4PostTurnEvaluation> | null;
    if (!parsed) {
      console.warn("[GM-PRD4] no JSON in response:", callRes.content.slice(0, 200));
      result = { ...DEFAULT_RESULT, notes: "Réponse LLM non parsable (fallback)." };
    } else {
      result = {
        engagement_delta: Number(parsed.engagement_delta ?? 0),
        confusion_detected: Boolean(parsed.confusion_detected),
        role_usage_quality: (parsed.role_usage_quality as PRD4PostTurnEvaluation["role_usage_quality"]) || "unknown",
        topics_covered: Array.isArray(parsed.topics_covered) ? parsed.topics_covered.slice(0, 6).map(String) : [],
        transition_recommended: Boolean(parsed.transition_recommended),
        cinematic_hint: parsed.cinematic_hint ? String(parsed.cinematic_hint) : null,
        next_turn_guidance: String(parsed.next_turn_guidance || DEFAULT_RESULT.next_turn_guidance),
        end_recommended: Boolean(parsed.end_recommended),
        moderation_flag: Boolean(parsed.moderation_flag),
        notes: String(parsed.notes || ""),
      };
    }
    model = callRes.model || model;
  } catch (err) {
    console.error("[GM-PRD4] error:", err);
    result = { ...DEFAULT_RESULT, notes: `Erreur LLM: ${(err as Error).message?.slice(0, 100) || "inconnue"}` };
  }

  const enriched: PRD4PostTurnEvaluation = {
    ...result,
    turn_index: input.turnIndex,
    latency_ms: Math.round(performance.now() - startedAt),
    model,
    created_at: new Date().toISOString(),
  };

  // Persist append-only — best effort, never blocks.
  if (input.sessionId) {
    void appendToGmPostTurnLog(input.sessionId, enriched).catch((err) => {
      console.warn("[GM-PRD4] persist failed:", err);
    });
  }

  return enriched;
}

async function appendToGmPostTurnLog(sessionId: string, entry: PRD4PostTurnEvaluation): Promise<void> {
  // Lecture-modification-écriture : pas d'append SQL atomique côté client.
  // Pour ~25 tours max c'est acceptable, et les écritures sont séquentielles par session.
  const { data, error } = await supabase
    .from("sessions")
    .select("gm_post_turn_log")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  const current = Array.isArray(data?.gm_post_turn_log) ? (data!.gm_post_turn_log as unknown[]) : [];
  const next = [...current, entry];

  const { error: upErr } = await supabase
    .from("sessions")
    .update({ gm_post_turn_log: next as never })
    .eq("id", sessionId);
  if (upErr) throw upErr;
}
