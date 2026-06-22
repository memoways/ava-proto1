import { simulateMaxResponse, validateMaxResponseConstraints, type MaxAgentInput } from "@/agents/maxAgent";
import { callGameMaster, type GameMasterInput } from "@/agents/gameMasterAgent";
import { buildKnowledgeContextFromRAG, formatRAGContext, queryRAG, rewriteRAGQuery } from "@/services/ragService";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, ConversationPipelineTimings, ConversationPipelineTrace, ConversationValidationTrace, GameMasterResponse, GameMasterTurnBrief, MaxConstraintCheckResult, MaxTurnKnowledgeContext, VideoTrigger } from "@/types";
import { getAntiHallucinationValidatorSettings, getGameplaySettings, getLLMSettings } from "@/services/settingsService";
import { createTurnTimer } from "@/services/latencyTelemetry";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";

function rowToTrigger(row: VideoTriggerRow): VideoTrigger {
  return {
    id: row.id,
    title: row.title,
    type: (row.type as VideoTrigger["type"]) || "interlude",
    themes: row.themes ?? [],
    priority: row.priority ?? 1,
    transition_style: row.transition_style ?? "fade_black",
    post_video_context: row.context ?? row.post_video_context ?? null,
    context: row.context,
    description: row.description,
    video_url: row.video_url ?? null,
    notion_id: row.notion_id,
  };
}

export interface ConversationTurnResult {
  maxResponse: string;
  gameMasterResponse: GameMasterResponse;
  trigger: VideoTrigger | null;
}

const PIPELINE_TRACE_KEY = "ava_pipeline_last_trace";
const MAX_VALIDATION_RETRIES = 1;

interface ValidatedMaxResponse {
  response: string;
  validation: ConversationValidationTrace;
  timings: { max_ms: number; validator_ms: number };
}

function buildFastPreTurnBrief(input: {
  knowledgeContext?: MaxTurnKnowledgeContext;
} & Pick<GameMasterInput, "conversationHistory" | "userMessage" | "currentTrustLevel" | "triggeredIds" | "timeElapsedSeconds">): GameMasterTurnBrief {
  return {
    response_mode: "méfiant",
    openness_level: input.currentTrustLevel >= 6 ? 2 : 1,
    emotional_state: "tendu",
    conversation_goal: "répondre brièvement et relancer l'interlocuteur",
    reveal_budget: input.currentTrustLevel >= 6 ? 1 : 0,
    allowed_knowledge: input.knowledgeContext?.allowedFacts?.slice(0, 3) || [],
    forbidden_topics: input.knowledgeContext?.forbiddenTopics?.slice(0, 3) || [],
    blocked_assertions: input.knowledgeContext?.blockedAssertions?.slice(0, 3) || [],
    style_instructions: ["réponse orale courte", "2 phrases maximum"],
    trigger_hint: null,
    notes: "Brief local instantané (GM pré-tour LLM désactivé sur le hot path live)",
    fallback: {
      kind: "orchestrator_error",
      reason: "gm_pre_turn_llm_skipped_for_latency",
      elapsed_ms: 0,
      timeout_ms: 0,
    },
  };
}

/**
 * Orchestrates a full conversation turn with optimized latency:
 * 1. Fetch RAG context
 * 2. Stream Max agent response
 * 3. Run Game Master in parallel (doesn't block TTS)
 * Returns Max response ASAP + a promise for Game Master results
 */
export async function processConversationTurn(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentTrustLevel: number,
  triggeredIds: string[],
  timeElapsedSeconds: number,
  ragContext?: string,
  postVideoContext?: string,
  sessionId?: string,
  turnId?: string
): Promise<{
  maxResponse: string;
  preTurnBrief: GameMasterTurnBrief;
  validation: ConversationValidationTrace;
  /** Per-step latency timings captured by the orchestrator (rag/gm_pre/max/validator). */
  timings: ConversationPipelineTimings;
  gameMasterPromise: Promise<{ gameMasterResponse: GameMasterResponse; trigger: VideoTrigger | null; gm_post_ms: number }>;
}> {
  const t0 = performance.now();
  const llmSettings = (() => { try { return getLLMSettings(); } catch { return {} as ReturnType<typeof getLLMSettings>; } })();
  const turnTimer = createTurnTimer({
    session_id: sessionId,
    character: "max",
    voice_modality: "voice",
    user_message_len: userMessage.length,
    max_model: llmSettings.LLM_MODEL,
    gm_model: llmSettings.LLM_MODEL_GM,
    validator_model: llmSettings.LLM_MODEL_GM,
    turn_index: conversationHistory.filter((m) => m.role === "user").length + 1,
  });
  // Fetch RAG context if not provided (non-blocking — start immediately)
  let finalRagContext = ragContext;
  const gameplay = getGameplaySettings();

  // Kick off session summary fetch in parallel — does not block RAG.
  const summaryPromise = sessionId ? fetchSessionSummary(sessionId) : Promise.resolve(null);

  const ragStart = performance.now();
  const ragPromise = !finalRagContext ? (async () => {
    const subTimings = { rewrite_ms: 0, query_ms: 0, knowledge_build_ms: 0, matches_count: 0, top_similarity: 0 };
    try {
      const recentMessages = conversationHistory.slice(-4).map(m => m.content).join(' ');

      // Optional query rewriting (toggle: RAG_QUERY_REWRITE_ENABLED).
      let rewrittenQuery: string | undefined;
      if (gameplay.RAG_QUERY_REWRITE_ENABLED) {
        const rwStart = performance.now();
        try {
          const r = await rewriteRAGQuery(userMessage, recentMessages);
          if (r && r !== userMessage) {
            rewrittenQuery = r;
            console.log('[RAG] Rewritten query:', r);
          }
        } catch (rwErr) {
          console.warn('[RAG] rewrite failed (fallback to raw):', rwErr);
        }
        subTimings.rewrite_ms = Math.round(performance.now() - rwStart);
      }

      const qStart = performance.now();
      const matches = await queryRAG(userMessage, recentMessages, gameplay.RAG_TOP_K, undefined, {
        rewrittenQuery,
        rerank: gameplay.RAG_RERANK_ENABLED,
        retrieveK: gameplay.RAG_RETRIEVE_K,
        provider: gameplay.RAG_EMBEDDING_PROVIDER,
      });
      subTimings.query_ms = Math.round(performance.now() - qStart);
      subTimings.matches_count = matches.length;
      subTimings.top_similarity = matches[0]?.similarity ?? matches[0]?.retrieval_similarity ?? 0;

      const kbStart = performance.now();
      const ctx = formatRAGContext(matches);
      const knowledgeContext = buildKnowledgeContextFromRAG(matches);
      subTimings.knowledge_build_ms = Math.round(performance.now() - kbStart);

      if (ctx) console.log('[RAG] Context found, injecting into prompt');
      return { ctx, knowledgeContext, subTimings };
    } catch (err) {
      console.error('[RAG] Failed to fetch context:', err);
      return { ctx: "", knowledgeContext: buildKnowledgeContextFromRAG([]), subTimings };
    }
  })() : Promise.resolve({ ctx: finalRagContext, knowledgeContext: buildKnowledgeContextFromRAG([]), subTimings: { rewrite_ms: 0, query_ms: 0, knowledge_build_ms: 0, matches_count: 0, top_similarity: 0 } });

  // Wait for RAG (runs in parallel with any preloaded system prompt)
  const ragResult = await ragPromise;
  const rag_ms = Math.round(performance.now() - ragStart);
  finalRagContext = ragResult.ctx;
  debugLogger.log({ service: "other", level: "info", direction: "out", label: `Orchestrator: RAG done (${rag_ms}ms), calling Max+GM in parallel`, detail: `History: ${conversationHistory.length} msgs, trust: ${currentTrustLevel}` });

  // Resolve the session summary (small fetch, usually finished by now).
  const summaryRecord = await summaryPromise;
  const sessionSummary = summaryRecord?.summary;

  // Le GM pre-turn LLM a été retiré du hot path live : il timeoutait souvent à 4s
  // et son brief n'était pas injecté dans Max. On garde un brief local instantané
  // pour la trace, et le banc d'essai conserve le planner LLM détaillé.
  const gmPreStart = performance.now();
  const preTurnResult = {
    brief: buildFastPreTurnBrief({
      conversationHistory,
      userMessage,
      currentTrustLevel,
      triggeredIds,
      timeElapsedSeconds,
      knowledgeContext: ragResult.knowledgeContext,
    }),
    gm_pre_ms: Math.round(performance.now() - gmPreStart),
  };

  const maxInput: MaxAgentInput = {
    conversationHistory,
    userMessage,
    ragContext: finalRagContext || undefined,
    postVideoContext,
    session_id: sessionId,
    knowledgeContext: ragResult.knowledgeContext,
    sessionSummary,
  };

  const validatedPromise = generateValidatedMaxResponse(maxInput);
  const validatedTurn = await validatedPromise;

  const timings: ConversationPipelineTimings = {
    rag_ms,
    gm_pre_ms: preTurnResult.gm_pre_ms,
    max_ms: validatedTurn.timings.max_ms,
    validator_ms: validatedTurn.timings.validator_ms,
    total_ms: Math.round(performance.now() - t0),
  };

  // Emit telemetry (fire-and-forget) — never blocks the turn return.
  turnTimer.emit({
    t_rag_rewrite_ms: ragResult.subTimings.rewrite_ms,
    t_rag_query_ms: ragResult.subTimings.query_ms,
    t_rag_total_ms: rag_ms,
    t_knowledge_build_ms: ragResult.subTimings.knowledge_build_ms,
    t_gm_pre_ms: preTurnResult.gm_pre_ms,
    t_max_llm_ms: validatedTurn.timings.max_ms,
    t_validator_ms: validatedTurn.timings.validator_ms,
    t_turn_total_ms: timings.total_ms,
    rag_matches_count: ragResult.subTimings.matches_count,
    rag_top_similarity: ragResult.subTimings.top_similarity,
    max_response_len: validatedTurn.response.length,
    had_fallback: validatedTurn.validation.finalStatus === "fallback",
    metadata: {
      turn_id: turnId ?? null,
      attempts: validatedTurn.validation.attempts,
      gm_pre_fallback: preTurnResult.brief.fallback?.kind ?? null,
    },
  });

  persistPipelineTrace({
    updatedAt: new Date().toISOString(),
    userMessage,
    ragContext: finalRagContext || "",
    preTurnBrief: preTurnResult.brief,
    finalResponse: validatedTurn.response,
    validation: validatedTurn.validation,
  });

  // Fire Game Master post-turn in background
  const gameMasterPromise = (async () => {
    const gmPostStart = performance.now();
    const gmInput: GameMasterInput = {
      conversationHistory,
      userMessage,
      maxResponse: validatedTurn.response,
      currentTrustLevel,
      triggeredIds,
      timeElapsedSeconds,
      characterName: "Max",
    };

    const gameMasterResponse = await callGameMaster(gmInput);

    let trigger: VideoTrigger | null = null;
    if (gameMasterResponse.trigger_video_id) {
      const videos = await getVideoTriggersCached();
      const row = videos.find((v) => v.id === gameMasterResponse.trigger_video_id);
      trigger = row ? rowToTrigger(row) : null;
    }

    const gm_post_ms = Math.round(performance.now() - gmPostStart);
    // Post-turn telemetry (separate small event for gm_post measure)
    try {
      const { trackEvent } = await import("@/services/posthogService");
      trackEvent("turn_latency_post", { session_id: sessionId, turn_id: turnId ?? null, t_gm_post_ms: gm_post_ms });
    } catch { /* ignore */ }
    return { gameMasterResponse, trigger, gm_post_ms };
  })();

  // Background: refresh compressed session summary every N user turns.
  if (sessionId && gameplay.RAG_SUMMARY_EVERY_N_TURNS > 0) {
    const userTurns = conversationHistory.filter((m) => m.role === "user").length + 1; // +1 = current turn
    const lastSummarizedTurn = summaryRecord?.last_turn ?? 0;
    const dueForSummary = userTurns - lastSummarizedTurn >= gameplay.RAG_SUMMARY_EVERY_N_TURNS;
    if (dueForSummary) {
      const fullHistory: ConversationMessage[] = [
        ...conversationHistory,
        { role: "user", content: userMessage, timestamp: Date.now() },
        { role: "max", content: validatedTurn.response, timestamp: Date.now() },
      ];
      // Fire and forget — never block the turn.
      summarizeSessionAsync(sessionId, fullHistory, userTurns).catch(() => {});
    }
  }

  return {
    maxResponse: validatedTurn.response,
    preTurnBrief: preTurnResult.brief,
    validation: validatedTurn.validation,
    timings,
    gameMasterPromise,
  };
}

async function generateValidatedMaxResponse(input: MaxAgentInput): Promise<ValidatedMaxResponse> {
  const reports: ConversationValidationTrace["reports"] = [];
  let max_ms = 0;
  let validator_ms = 0;

  for (let attempt = 1; attempt <= MAX_VALIDATION_RETRIES + 1; attempt++) {
    const attemptInput = buildAttemptInput(input, reports);
    const maxStart = performance.now();
    const { response } = await simulateMaxResponse(attemptInput);
    max_ms += performance.now() - maxStart;
    const valStart = performance.now();
    const validation = await validateAttempt(attemptInput, response);
    validator_ms += performance.now() - valStart;

    reports.push({
      attempt,
      response,
      compliant: validation.compliant,
      summary: validation.summary,
      violations: validation.violations,
      safe_points: validation.safe_points,
    });

    if (validation.compliant) {
      return {
        response,
        validation: {
          attempts: attempt,
          regenerated: attempt > 1,
          finalStatus: "passed",
          reports,
        },
        timings: { max_ms: Math.round(max_ms), validator_ms: Math.round(validator_ms) },
      };
    }
  }

  const lastReport = reports[reports.length - 1];
  const fallbackResponse = "Je ne peux pas l'affirmer avec certitude à partir de ce que je sais. Je préfère rester prudent pour l'instant.";

  return {
    response: fallbackResponse,
    validation: {
      attempts: reports.length,
      regenerated: reports.length > 1,
      finalStatus: "fallback",
      reports: [
        ...reports,
        {
          attempt: reports.length + 1,
          response: fallbackResponse,
          compliant: true,
          summary: `Fallback de sécurité après validation échouée${lastReport ? ` (${lastReport.summary})` : ""}.`,
          violations: [],
          safe_points: ["Réponse remplacée par un message de prudence avant TTS."],
        },
      ],
    },
    timings: { max_ms: Math.round(max_ms), validator_ms: Math.round(validator_ms) },
  };
}

function buildAttemptInput(input: MaxAgentInput, reports: ConversationValidationTrace["reports"]): MaxAgentInput {
  if (!reports.length) return input;

  const lastReport = reports[reports.length - 1];
  const regenerationInstruction = [
    "[RÉGÉNÉRATION SÉCURISÉE]",
    "Ta réponse précédente a été rejetée avant diffusion vocale.",
    `Violations détectées: ${lastReport.violations.join(" | ") || lastReport.summary}`,
    "Réécris une réponse plus prudente.",
    "N'affirme aucun fait absent des faits autorisés.",
    "Si l'information manque, exprime explicitement le doute ou les limites de ce que tu sais.",
  ].join("\n");

  return {
    ...input,
    userMessage: `${input.userMessage}\n\n${regenerationInstruction}`,
  };
}

const VALIDATION_TIMEOUT_MS = 4000;

async function validateAttempt(input: MaxAgentInput, response: string): Promise<MaxConstraintCheckResult> {
  // Fail-open avec timeout : si le validateur ne répond pas vite ou échoue,
  // on laisse passer la réponse pour ne pas bloquer le pipeline vocal.
  return Promise.race<MaxConstraintCheckResult>([
    validateMaxResponseConstraints({
      userMessage: input.userMessage,
      response,
      ragContext: input.ragContext,
      knowledgeContext: input.knowledgeContext,
    }).catch((err) => {
      console.warn("[Validator] erreur — fail-open:", err);
      return {
        compliant: true,
        summary: "Validation indisponible (erreur) — réponse diffusée par défaut.",
        violations: [],
        safe_points: ["fail-open sur erreur"],
      };
    }),
    new Promise<MaxConstraintCheckResult>((resolve) =>
      setTimeout(() => resolve({
        compliant: true,
        summary: `Validation expirée après ${VALIDATION_TIMEOUT_MS}ms — réponse diffusée par défaut.`,
        violations: [],
        safe_points: ["fail-open sur timeout"],
      }), VALIDATION_TIMEOUT_MS),
    ),
  ]);
}

function persistPipelineTrace(trace: ConversationPipelineTrace) {
  try {
    localStorage.setItem(PIPELINE_TRACE_KEY, JSON.stringify(trace));
  } catch {
    // ignore trace persistence issues
  }
}
