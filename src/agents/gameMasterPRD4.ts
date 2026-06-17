/**
 * PRD4 — Évaluateur post-tour du Game Master.
 *
 * Appelé en void après chaque réponse de Max (n'est jamais sur le chemin
 * critique du TTS). Retourne le schéma PRD4 §10.3 + un éventuel `trigger_video_id`
 * choisi parmi les vidéos disponibles (table `video_triggers`).
 * Persiste l'entrée dans `sessions.gm_post_turn_log` (jsonb append-only).
 */
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { getLLMSettings } from "@/services/settingsService";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import type { ConversationMessage, PRD4PostTurnEvaluation, UserRoleProfile } from "@/types";

export interface PRD4PostTurnInput {
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  userRole: UserRoleProfile | null;
  /** GIFF — posture initiale exprimée par l'utilisateur avant l'appel. */
  userPostureRaw?: string | null;
  turnIndex: number;
  timeElapsedSeconds: number;
  /** IDs de triggers vidéo déjà joués (évite de rejouer). */
  triggeredVideoIds?: string[];
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
  trigger_video_id: null,
};

const GM_POST_TURN_TIMEOUT_MS = 12000;

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
  "notes": string,                  // 1 phrase courte de raison
  "trigger_video_id": string | null // ID d'une vidéo à jouer ; voir bloc VIDÉOS DISPONIBLES
}

Règles "trigger_video_id" — PRIORITÉ HAUTE, c'est le principal levier narratif :
- Renseigne UNIQUEMENT un id présent dans la liste VIDÉOS DISPONIBLES.
- DÈS QU'un thème de la vidéo (champ \`themes\`) est abordé sémantiquement par le joueur OU par Max dans le dernier échange, DÉCLENCHE la vidéo. Tolère les fautes d'orthographe et variantes (ex: "patricarcat" = "patriarcat", "famille" ⊃ parents/sœur/père/frère/enfance/fratrie, "trahison" ⊃ mensonge/cacher/secret, "secrets" ⊃ cacher/vérité/dissimuler, "confiance" ⊃ doute/méfiance). Sois LARGE dans le matching sémantique.
- Si plusieurs matchs possibles : prends la priorité la plus haute (number le plus petit = plus prioritaire).
- N'utilise JAMAIS un id présent dans \`already_triggered\`.
- Ne déclenche PAS deux vidéos dans le même tour, et évite deux tours consécutifs si possible.
- Le seul cas où tu retournes null : aucun thème vidéo n'a réellement été touché. En cas de doute raisonnable, DÉCLENCHE — l'expérience repose sur ces cinématiques.

Règles "end_recommended" : true seulement si la conversation a vraiment trouvé une clôture naturelle, ou si elle est en train d'échouer. Sois conservateur — la session dure ~5 min max.

Pas de markdown, pas de \`\`\`, pas de commentaire. Uniquement l'objet JSON.`;

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

function buildUserPrompt(input: PRD4PostTurnInput, videos: VideoTriggerRow[]): string {
  const recent = input.conversationHistory.slice(-6).map((m) =>
    `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`
  ).join("\n");

  const triggered = input.triggeredVideoIds ?? [];
  const videoLines = videos.length
    ? videos
        .map((v) => `- id=${v.id} | titre="${v.title}" | type=${v.type} | priorité=${v.priority ?? "?"} | thèmes=[${(v.themes ?? []).join(", ") || "—"}]${v.description ? ` | description="${v.description.slice(0, 160)}"` : ""}`)
        .join("\n")
    : "(aucune)";

  return `## PROFIL JOUEUR
${input.userRole?.summary_for_max || "(profil indisponible)"}

## POSTURE INITIALE DU JOUEUR (intention / question exprimée avant le début de l'appel — à garder en mémoire pour évaluer la cohérence de l'échange)
${input.userPostureRaw?.trim() || "(non renseignée)"}

## TEMPS ÉCOULÉ
${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s sur ~5 min cible — tour #${input.turnIndex}

## VIDÉOS DISPONIBLES
${videoLines}

## already_triggered
${triggered.length ? triggered.join(", ") : "(aucune)"}

## HISTORIQUE RÉCENT
${recent || "(aucun)"}

## DERNIER ÉCHANGE (à évaluer)
UTILISATEUR: ${input.userMessage}
MAX: ${input.maxResponse}

Retourne l'évaluation JSON (inclure trigger_video_id si une vidéo est pertinente).`;
}

/**
 * Évalue le tour qui vient de se jouer. Toujours résout (jamais throw).
 */
export async function evaluatePostTurnPRD4(
  input: PRD4PostTurnInput,
): Promise<PRD4PostTurnEvaluation> {
  const startedAt = performance.now();
  let result: PRD4PostTurnEvaluation;
  let model = "";
  const videos = await getVideoTriggersCached();
  const validIds = new Set(videos.map((v) => v.id));
  const triggered = new Set(input.triggeredVideoIds ?? []);
  try {
    const llm = getLLMSettings();
    model = llm.LLM_MODEL_GM;
    const callRes = await callLLMWithUsage(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input, videos) },
      ],
      {
        model: llm.LLM_MODEL_GM,
        temperature: 0.2,
        max_tokens: llm.LLM_MAX_TOKENS_GM ?? 250,
        timeoutMs: GM_POST_TURN_TIMEOUT_MS,
        feature_key: "prd4_gm_post_turn",
        session_id: input.sessionId ?? undefined,
      },
    );
    const parsed = extractJson(callRes.content) as Partial<PRD4PostTurnEvaluation> | null;
    if (!parsed) {
      console.warn("[GM-PRD4] no JSON in response:", callRes.content.slice(0, 200));
      result = { ...DEFAULT_RESULT, notes: "Réponse LLM non parsable (fallback)." };
    } else {
      const rawTrigger = parsed.trigger_video_id ? String(parsed.trigger_video_id) : null;
      const safeTrigger = rawTrigger && validIds.has(rawTrigger) && !triggered.has(rawTrigger) ? rawTrigger : null;
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
        trigger_video_id: safeTrigger,
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

  if (input.sessionId) {
    void appendToGmPostTurnLog(input.sessionId, enriched).catch((err) => {
      console.warn("[GM-PRD4] persist failed:", err);
    });
  }

  return enriched;
}

async function appendToGmPostTurnLog(sessionId: string, entry: PRD4PostTurnEvaluation): Promise<void> {
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
