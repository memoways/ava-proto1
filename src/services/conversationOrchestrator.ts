import { simulateMaxResponse, validateMaxResponseConstraints, type MaxAgentInput } from "@/agents/maxAgent";
import { callGameMaster, planGameMasterTurn, type GameMasterInput } from "@/agents/gameMasterAgent";
import { buildKnowledgeContextFromRAG, formatRAGContext, queryRAG, rewriteRAGQuery } from "@/services/ragService";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, ConversationPipelineTimings, ConversationPipelineTrace, ConversationValidationTrace, GameMasterResponse, GameMasterTurnBrief, MaxConstraintCheckResult, VideoTrigger } from "@/types";
import { getGameplaySettings, getLLMSettings } from "@/services/settingsService";
import { createTurnTimer } from "@/services/latencyTelemetry";

// Demo triggers for the prototype
const DEMO_TRIGGERS: Record<string, VideoTrigger> = {
  trigger_famille: {
    id: "trigger_famille",
    title: "Flashback famille",
    type: "mid_conversation",
    themes: ["famille", "parents", "enfance"],
    placeholder_text: "Max se souvient de son enfance avec Ava. Des images de leur maison familiale, des rires partagés, avant que tout change...",
    priority: 1,
    transition_style: "fade_black",
    post_video_context: "Tu viens de te souvenir de ton enfance avec Ava. Ces souvenirs te rendent nostalgique mais aussi plus déterminé.",
    duration_seconds: 8,
  },
  trigger_secret: {
    id: "trigger_secret",
    title: "Le message cryptique",
    type: "mid_conversation",
    themes: ["secret", "mystère", "vérité"],
    placeholder_text: "Le dernier message d'Ava apparaît à l'écran. Des symboles étranges, des coordonnées partielles, un avertissement...",
    priority: 2,
    transition_style: "fade_black",
    post_video_context: "Tu as montré le message d'Ava. C'est un pas vers la confiance.",
    duration_seconds: 10,
  },
  trigger_disparition: {
    id: "trigger_disparition",
    title: "Le jour de la disparition",
    type: "mid_conversation",
    themes: ["disparition", "absence", "recherche"],
    placeholder_text: "Reconstitution du dernier jour où Ava a été vue. Son appartement vide, des indices laissés derrière elle...",
    priority: 3,
    transition_style: "fade_black",
    post_video_context: "Tu as partagé ce que tu sais sur sa disparition. La confiance grandit.",
    duration_seconds: 12,
  },
};

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
  sessionId?: string
): Promise<{
  maxResponse: string;
  preTurnBrief: GameMasterTurnBrief;
  validation: ConversationValidationTrace;
  /** Per-step latency timings captured by the orchestrator (rag/gm_pre/max/validator). */
  timings: ConversationPipelineTimings;
  gameMasterPromise: Promise<{ gameMasterResponse: GameMasterResponse; trigger: VideoTrigger | null; gm_post_ms: number }>;
}> {
  const t0 = performance.now();
  // Fetch RAG context if not provided (non-blocking — start immediately)
  let finalRagContext = ragContext;
  const gameplay = getGameplaySettings();

  // Kick off session summary fetch in parallel — does not block RAG.
  const summaryPromise = sessionId ? fetchSessionSummary(sessionId) : Promise.resolve(null);

  const ragStart = performance.now();
  const ragPromise = !finalRagContext ? (async () => {
    try {
      const recentMessages = conversationHistory.slice(-4).map(m => m.content).join(' ');

      // Optional query rewriting (toggle: RAG_QUERY_REWRITE_ENABLED).
      let rewrittenQuery: string | undefined;
      if (gameplay.RAG_QUERY_REWRITE_ENABLED) {
        try {
          const r = await rewriteRAGQuery(userMessage, recentMessages);
          if (r && r !== userMessage) {
            rewrittenQuery = r;
            console.log('[RAG] Rewritten query:', r);
          }
        } catch (rwErr) {
          console.warn('[RAG] rewrite failed (fallback to raw):', rwErr);
        }
      }

      const matches = await queryRAG(userMessage, recentMessages, gameplay.RAG_TOP_K, undefined, {
        rewrittenQuery,
        rerank: gameplay.RAG_RERANK_ENABLED,
        retrieveK: gameplay.RAG_RETRIEVE_K,
        provider: gameplay.RAG_EMBEDDING_PROVIDER,
      });
      const ctx = formatRAGContext(matches);
      if (ctx) console.log('[RAG] Context found, injecting into prompt');
      return { ctx, knowledgeContext: buildKnowledgeContextFromRAG(matches) };
    } catch (err) {
      console.error('[RAG] Failed to fetch context:', err);
      return { ctx: "", knowledgeContext: buildKnowledgeContextFromRAG([]) };
    }
  })() : Promise.resolve({ ctx: finalRagContext, knowledgeContext: buildKnowledgeContextFromRAG([]) });

  // Wait for RAG (runs in parallel with any preloaded system prompt)
  const ragResult = await ragPromise;
  const rag_ms = Math.round(performance.now() - ragStart);
  finalRagContext = ragResult.ctx;
  debugLogger.log({ service: "other", level: "info", direction: "out", label: `Orchestrator: RAG done (${rag_ms}ms), calling Max+GM in parallel`, detail: `History: ${conversationHistory.length} msgs, trust: ${currentTrustLevel}` });

  // Resolve the session summary (small fetch, usually finished by now).
  const summaryRecord = await summaryPromise;
  const sessionSummary = summaryRecord?.summary;

  // Lance le GM pre-turn ET la réponse Max EN PARALLÈLE.
  const gmPreStart = performance.now();
  const preTurnPromise = planGameMasterTurn({
    conversationHistory,
    userMessage,
    currentTrustLevel,
    triggeredIds,
    timeElapsedSeconds,
    knowledgeContext: ragResult.knowledgeContext,
  }).catch((err) => {
    console.warn("[Orchestrator] GM pre-turn failed, using empty brief:", err);
    const message = err instanceof Error ? err.message : String(err);
    const elapsed_ms = Math.round(performance.now() - gmPreStart);
    let modelAtError: string | undefined;
    try { modelAtError = getLLMSettings().LLM_MODEL_GM; } catch { /* ignore */ }
    return {
      response_mode: "ferme_mefiant" as const,
      openness_level: 1,
      emotional_state: "neutre",
      conversation_goal: "",
      reveal_budget: 0,
      allowed_knowledge: [],
      forbidden_topics: [],
      blocked_assertions: [],
      style_instructions: [],
      trigger_hint: null,
      notes: "fallback (GM pre-turn error)",
      fallback: {
        kind: "orchestrator_error" as const,
        reason: `orchestrator: ${message.slice(0, 140)}`,
        elapsed_ms,
        model: modelAtError,
        error_excerpt: message.slice(0, 200),
      },
    };
  }).then((brief) => ({ brief, gm_pre_ms: Math.round(performance.now() - gmPreStart) }));

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
  const [validatedTurn, preTurnResult] = await Promise.all([validatedPromise, preTurnPromise]);

  const timings: ConversationPipelineTimings = {
    rag_ms,
    gm_pre_ms: preTurnResult.gm_pre_ms,
    max_ms: validatedTurn.timings.max_ms,
    validator_ms: validatedTurn.timings.validator_ms,
    total_ms: Math.round(performance.now() - t0),
  };

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
    };

    const gameMasterResponse = await callGameMaster(gmInput);

    let trigger: VideoTrigger | null = null;
    if (gameMasterResponse.trigger_video_id) {
      trigger = DEMO_TRIGGERS[gameMasterResponse.trigger_video_id] || null;
    }

    return { gameMasterResponse, trigger, gm_post_ms: Math.round(performance.now() - gmPostStart) };
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
