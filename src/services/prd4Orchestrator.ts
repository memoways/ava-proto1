/**
 * PRD4 — Orchestrateur lean d'un tour de conversation.
 *
 * Différences vs `processConversationTurn` (legacy A/B) :
 *  - Pas de GM pré-tour LLM (rapport coût/bénéfice trop faible en live).
 *  - Pas de validateur anti-hallucination (gardé pour le banc d'essai).
 *  - Injecte le `summary_for_max` du profil joueur dans le system prompt de Max.
 *  - Fire-and-forget : évaluation PRD4 post-tour (jamais bloquante pour le TTS).
 */
import { SimulateMaxResponseError, simulateMaxResponse, type MaxAgentInput, type SimulateMaxDiagnosticContext } from "@/agents/maxAgent";
import { evaluatePostTurnPRD4 } from "@/agents/gameMasterPRD4";
import { labelUserTurnPRD4, type PRD4LabelResult } from "@/agents/gameMasterLabelPRD4";
import {
  buildKnowledgeContextFromRAG,
  formatMaxRAGContext,
  queryRAGDetailed,
  type RAGQueryDetailed,
} from "@/services/ragService";
import { resolveCharacterIdByName } from "@/services/characterPromptService";
import { getGameplaySettings, getLLMSettings, isReasoningEnabledForModel } from "@/services/settingsService";
import { maxRagFormatOptionsForVariant } from "@/services/maxRagVariant";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { selectOptimizedConversation, selectRecentConversation, selectUnsummarizedConversation } from "@/services/conversationMemory";
import { fetchConversationMemory } from "@/services/sessionConversationMemory";
import { withTimeout } from "@/services/asyncUtils";
import { compactConversationTurnTrace } from "@/services/conversationTraceFormat";
import { enqueueConversationTurnTrace, patchQueuedConversationTurnTrace } from "@/services/conversationTraceOutbox";
import {
  RAG_DEGRADED_MODE_DEADLINE_MS,
  RAG_DEFAULT_RETRIEVE_K,

  MAX_LLM_RESPONSE_DEADLINE_MS,
  SUMMARY_FETCH_DEADLINE_MS,
  TURN_RESPONSE_DEADLINE_MS,
  getSessionMinimumClosureSeconds,
  normalizeSessionDurationSeconds,
} from "@/config/experienceRuntime";
import type { ConversationMessage, ConversationTurnTraceV1, PRD4PostTurnEvaluation, UserRoleProfile } from "@/types";

export interface PRD4TurnInput {
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  userRole: UserRoleProfile | null;
  timeElapsedSeconds: number;
  /** Personnage appelé (PRD4 : "max" toujours, autres grisés). */
  characterName?: string;
  /** IDs de triggers vidéo déjà joués durant la session. */
  triggeredVideoIds?: string[];
  /** Contexte injecté dans Max suite à la vidéo précédente. */
  postVideoContext?: string;
  /** GIFF — posture initiale de l'utilisateur (question/intention exprimée avant l'appel). */
  userPostureRaw?: string | null;
  /** Boucle GM→Max : next_turn_guidance produit par le post-tour du tour précédent. */
  gmGuidance?: string | null;
  /** Boucle GM→Max : sujets déjà couverts, cumulés sur la session. */
  gmTopicsCovered?: string[];
  onLatencySegment?: (event: PRD4LatencySegmentEvent) => void;
  /** Abort when the UI has moved to a newer turn or ended the session. */
  signal?: AbortSignal;
  /** Stable correlation ID shared with voice telemetry and diagnostic persistence. */
  turnId?: string;
  /** Exact trace mode, honored only for admin-owned diagnostic sessions. */
  diagnosticTraceEnabled?: boolean;
}

export interface PRD4TurnResult {
  maxResponse: string;
  timings: {
    rag_ms: number;
    max_ms: number;
    total_ms: number;
    trace_write_ms?: number;
  };
  ragMatches: number;
  memory: {
    totalMessages: number;
    recentMessages: number;
    summaryLastTurn: number;
  };
  /** Promesse résolue quand le GM post-turn a fini (à attendre en arrière-plan). */
  postTurnPromise: Promise<PRD4PostTurnEvaluation>;
  /** Label pass lancé en parallèle de Max (résout en général avant la fin du TTS). */
  labelPromise: Promise<PRD4LabelResult>;
  traceId: string | null;
}

export type PRD4LatencySegmentEvent =
  | { type: "start"; segment: "RAG" | "LLM" | "GM"; service: string }
  | { type: "end"; segment: "RAG" | "LLM" | "GM"; service: string; durationMs: number };

const MAX_FALLBACK_RESPONSE =
  "Je vous entends, mais la ligne accroche. Répétez juste l'essentiel, s'il vous plaît.";

export async function processPRD4Turn(input: PRD4TurnInput): Promise<PRD4TurnResult> {
  const t0 = performance.now();
  const diagnosticTraceEnabled = input.diagnosticTraceEnabled === true;
  const turnId = input.turnId || crypto.randomUUID();
  const responseDeadlineAt = t0 + TURN_RESPONSE_DEADLINE_MS;
  const turnIndex = input.conversationHistory.filter((m) => m.role === "user").length + 1;
  const gameplay = (() => {
    try { return getGameplaySettings(); } catch { return null; }
  })();
  const recentConversation = selectRecentConversation(input.conversationHistory);
  const sessionDurationSeconds = normalizeSessionDurationSeconds(gameplay?.TIMEOUT_SECONDS);
  const minimumClosureSeconds = getSessionMinimumClosureSeconds(sessionDurationSeconds);
  let summaryFetchMs = 0;
  const summaryStartedAt = performance.now();
  const summaryPromise = (input.sessionId
    ? withTimeout(
        "prd4_summary_fetch",
        fetchSessionSummary(input.sessionId),
        SUMMARY_FETCH_DEADLINE_MS,
      ).catch(() => null)
    : Promise.resolve(null)).then((record) => {
      summaryFetchMs = Math.round(performance.now() - summaryStartedAt);
      return record;
    });
  const memoryPromise = gameplay?.MAX_PROMPT_VARIANT === "optimized_v3" && input.sessionId
    ? withTimeout(
        "prd4_structured_memory_fetch",
        fetchConversationMemory(input.sessionId),
        SUMMARY_FETCH_DEADLINE_MS,
      ).catch(() => null)
    : Promise.resolve(null);

  // --- RAG (best-effort, non-bloquant en cas d'erreur) -----------------------
  const ragStart = performance.now();
  input.onLatencySegment?.({ type: "start", segment: "RAG", service: "RAG" });
  let ragContext = "";
  let knowledgeContext = buildKnowledgeContextFromRAG([]);
  let matchesCount = 0;
  let ragDetailed: RAGQueryDetailed | null = null;
  let ragError: string | null = null;
  let ragErrorKind: "rag_timeout" | "rag_http_error" | "rag_client_error" | "rerank_failed" | null = null;
  try {
    const recent = recentConversation.slice(-2).map((m) => m.content).join(" ");
    // Cloisonnement RAG : on ne récupère QUE les chunks du personnage courant
    // (les chunks shared/storyworld avec character_id NULL restent visibles).
    const characterId = await resolveCharacterIdByName(input.characterName || "Max");
    ragDetailed = await withTimeout(
      "prd4_rag",
      queryRAGDetailed(
        input.userMessage,
        recent,
        gameplay?.MAX_PROMPT_VARIANT === "optimized_v3"
          ? Math.max(6, gameplay?.RAG_TOP_K ?? 3)
          : gameplay?.RAG_TOP_K ?? 5,
        gameplay?.RAG_MATCH_THRESHOLD,
        {
          characterId,
          rerank: gameplay?.RAG_RERANK_ENABLED,
          retrieveK: gameplay?.RAG_RETRIEVE_K ?? RAG_DEFAULT_RETRIEVE_K,
          rerankModel: gameplay?.RAG_RERANK_MODEL,
          rerankTruncation: gameplay?.RAG_RERANK_TRUNCATION,
          signal: input.signal,
          timeoutMs: RAG_DEGRADED_MODE_DEADLINE_MS,
        },
      ),
      RAG_DEGRADED_MODE_DEADLINE_MS,
    );
    const matches = ragDetailed.matches;
    ragError = ragDetailed.error || null;
    if (ragError) {
      ragErrorKind = /^HTTP \d/.test(ragError) ? "rag_http_error" : "rag_client_error";
    } else if (ragDetailed.rerankError) {
      ragErrorKind = "rerank_failed";
    }
    matchesCount = matches.length;
    ragContext = formatMaxRAGContext(matches, maxRagFormatOptionsForVariant(gameplay?.MAX_PROMPT_VARIANT));
    knowledgeContext = buildKnowledgeContextFromRAG(matches);
  } catch (err) {
    console.warn("[PRD4 orchestrator] RAG failed (non-fatal):", err);
    ragError = err instanceof Error ? err.message : String(err);
    ragErrorKind = /timed out/i.test(ragError) ? "rag_timeout" : "rag_client_error";
  }

  const rag_ms = Math.round(performance.now() - ragStart);
  input.onLatencySegment?.({ type: "end", segment: "RAG", service: "RAG", durationMs: rag_ms });

  // --- GM Label Pass (parallèle à Max) ---------------------------------------
  const rawLabelPromise: Promise<PRD4LabelResult> = labelUserTurnPRD4({
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    conversationHistory: recentConversation,
    userPostureRaw: input.userPostureRaw ?? null,
    signal: input.signal,
    diagnosticTrace: diagnosticTraceEnabled,
  });

  // --- Max --------------------------------------------------------------------
  const maxStart = performance.now();
  input.onLatencySegment?.({ type: "start", segment: "LLM", service: "Max LLM" });
  const summaryRecord = await summaryPromise;
  const structuredMemory = await memoryPromise;
  const maxConversationHistory = gameplay?.MAX_PROMPT_VARIANT === "optimized_v3"
    ? selectOptimizedConversation(input.conversationHistory, structuredMemory?.lastTurn ?? 0)
    : recentConversation;
  const postureSummary = input.userPostureRaw?.trim()
    ? `L'utilisateur a démarré la conversation en exprimant ceci (à garder en mémoire tout au long de l'échange comme contexte de qui il est et de ce qu'il vient chercher) : « ${input.userPostureRaw.trim()} »`
    : undefined;
  const resolvedUserRoleSummary = input.userRole?.summary_for_max ?? postureSummary;
  const maxInput: MaxAgentInput = {
    conversationHistory: maxConversationHistory,
    userMessage: input.userMessage,
    ragContext: ragContext || undefined,
    postVideoContext: input.postVideoContext,
    session_id: input.sessionId ?? undefined,
    knowledgeContext,
    sessionSummary: summaryRecord?.summary,
    conversationMemory: structuredMemory,
    ragCandidates: ragDetailed?.matches.map((match, index) => ({
      id: match.id,
      content: match.content,
      rank: index + 1,
    })),
    userRoleSummary: resolvedUserRoleSummary,
    temporalContext: {
      timeElapsedSeconds: input.timeElapsedSeconds,
      sessionDurationSeconds,
      turnIndex,
    },
    gmGuidance: input.gmGuidance?.trim()
      ? { guidance: input.gmGuidance, topicsCovered: input.gmTopicsCovered }
      : undefined,
  };
  let maxResponse = "";
  let max_ms = 0;
  let maxResult: Awaited<ReturnType<typeof simulateMaxResponse>> | null = null;
  let maxFailureDiagnostic: SimulateMaxDiagnosticContext | null = null;
  let maxError: string | null = null;
  try {
    const remainingMs = Math.floor(responseDeadlineAt - performance.now());
    if (remainingMs < 250) throw new Error("PRD4 response deadline exhausted after RAG");
    maxResult = await simulateMaxResponse(maxInput, {
      characterName: input.characterName || "Max",
      featureKey: "prd4_chat",
      timeoutMs: Math.min(MAX_LLM_RESPONSE_DEADLINE_MS, remainingMs),
      signal: input.signal,
      diagnosticTrace: diagnosticTraceEnabled,
    });
    maxResponse = maxResult.response;
  } catch (err) {
    console.warn("[PRD4 orchestrator] Max LLM failed (fallback response):", err);
    maxError = err instanceof Error ? err.message : String(err);
    maxFailureDiagnostic = err instanceof SimulateMaxResponseError ? err.diagnosticContext : null;
    maxResponse = MAX_FALLBACK_RESPONSE;
  } finally {
    max_ms = Math.round(performance.now() - maxStart);
    input.onLatencySegment?.({ type: "end", segment: "LLM", service: "Max LLM", durationMs: max_ms });
  }

  // --- GM post-turn (void) ---------------------------------------------------
  const runPostTurn = async () => {
    const gmStart = performance.now();
    input.onLatencySegment?.({ type: "start", segment: "GM", service: "GM post-turn" });
    try {
      return await evaluatePostTurnPRD4({
        sessionId: input.sessionId,
        conversationHistory: recentConversation,
        userMessage: input.userMessage,
        maxResponse,
        userRole: input.userRole,
        conversationMemoryBefore: structuredMemory,
        userPostureRaw: input.userPostureRaw ?? null,
        turnIndex,
        timeElapsedSeconds: input.timeElapsedSeconds,
        sessionDurationSeconds,
        minimumClosureSeconds,
        triggeredVideoIds: input.triggeredVideoIds,
        signal: input.signal,
        diagnosticTrace: diagnosticTraceEnabled,
      });
    } finally {
      input.onLatencySegment?.({
        type: "end",
        segment: "GM",
        service: "GM post-turn",
        durationMs: Math.round(performance.now() - gmStart),
      });
    }
  };
  // En diagnostic, le post-tour (qui prépare la suite et écrit son propre log)
  // ne démarre qu'après la mise en file locale durable de la réponse.
  let rawPostTurnPromise = diagnosticTraceEnabled ? null : runPostTurn();

  const summaryEvery = gameplay?.RAG_SUMMARY_EVERY_N_TURNS ?? 4;
  const lastSummarizedTurn = summaryRecord?.last_turn ?? 0;

  const traceId: string | null = null;
  let traceWriteMs = 0;
  if (diagnosticTraceEnabled) {
    if (!input.sessionId) {
      throw new Error("Diagnostic trace requires a persisted session");
    }
    const llmSettings = getLLMSettings();
    const requestedSettings = maxResult?.requestedSettings ?? maxFailureDiagnostic?.requestedSettings ?? {
      model: llmSettings.LLM_MODEL,
      temperature: llmSettings.LLM_TEMPERATURE,
      maxTokens: llmSettings.LLM_MAX_TOKENS,
      topP: llmSettings.LLM_TOP_P,
      reasoning: isReasoningEnabledForModel(llmSettings.LLM_MODEL, llmSettings),
      timeoutMs: MAX_LLM_RESPONSE_DEADLINE_MS,
    };
    const coreTotalMs = Math.round(performance.now() - t0);
    const recentContext = recentConversation.slice(-4).map((message) => message.content).join(" ");
    const trace: ConversationTurnTraceV1 = {
      schemaVersion: 1,
      identity: {
        sessionId: input.sessionId,
        turnId,
        turnIndex,
        characterName: input.characterName || "Max",
        createdAt: new Date().toISOString(),
        status: "causal_complete",
      },
      input: { userMessage: input.userMessage },
      memory: {
        totalHistoryMessages: input.conversationHistory.length,
        selectedHistory: maxConversationHistory,
        sessionSummary: summaryRecord?.summary ?? null,
        summaryLastTurn: lastSummarizedTurn,
        userRoleSummary: resolvedUserRoleSummary ?? null,
        userPostureRaw: input.userPostureRaw ?? null,
        postVideoContext: input.postVideoContext ?? null,
        temporalContext: maxInput.temporalContext!,
        gmGuidance: maxInput.gmGuidance?.guidance ?? null,
        gmTopicsCovered: maxInput.gmGuidance?.topicsCovered ?? [],
        structuredMemoryBefore: structuredMemory,
        memoryLastTurn: structuredMemory?.lastTurn ?? 0,
      },
      rag: {
        request: {
          userMessage: input.userMessage,
          recentContext: ragDetailed?.request.recentContext ?? recentContext,
          rewrittenQuery: ragDetailed?.request.rewrittenQuery ?? null,
          searchInput: ragDetailed?.searchInput || [input.userMessage, recentContext ? `Contexte récent: ${recentContext}` : ""].filter(Boolean).join("\n\n"),
          matchCount: ragDetailed?.request.matchCount ?? (gameplay?.RAG_TOP_K ?? 5),
          retrieveK: ragDetailed?.request.retrieveK ?? (gameplay?.RAG_RETRIEVE_K ?? 15),
          matchThreshold: ragDetailed?.request.matchThreshold ?? 0.3,
          characterId: ragDetailed?.request.characterId ?? null,
          provider: ragDetailed?.embeddingProvider ?? null,
          rerankRequested: ragDetailed?.request.rerankRequested ?? (gameplay?.RAG_RERANK_ENABLED ?? true),
        },
        matches: ragDetailed?.matches ?? [],
        formattedContext: (maxResult?.promptTrace ?? maxFailureDiagnostic?.promptTrace)?.injectedSections
          .find((section) => section.key === "rag_context")?.content ?? ragContext,
        knowledgeContext,
        embeddingProvider: ragDetailed?.embeddingProvider ?? null,
        embeddingProfile: ragDetailed?.embeddingProfile ?? null,
        documentEmbeddingModel: ragDetailed?.documentEmbeddingModel ?? null,
        queryEmbeddingModel: ragDetailed?.queryEmbeddingModel ?? null,
        embeddingDimension: ragDetailed?.embeddingDimension ?? null,
        embeddingDtype: ragDetailed?.embeddingDtype ?? null,
        rerankUsed: ragDetailed?.rerankUsed ?? false,
        rerankQuery: ragDetailed?.rerankQuery ?? null,
        error: ragError,
        ...(ragErrorKind ? { errorKind: ragErrorKind } : {}),
        rerankError: ragDetailed?.rerankError ?? null,
        serverLatencyMs: ragDetailed?.serverLatencyMs ?? null,

      },
      prompt: maxResult?.promptTrace ?? maxFailureDiagnostic?.promptTrace ?? null,
      maxCall: {
        messages: maxResult?.messages ?? maxFailureDiagnostic?.messages ?? [],
        diagnostic: maxResult?.diagnosticTrace ?? maxFailureDiagnostic?.diagnosticTrace ?? null,
        requestedSettings,
        error: maxError,
      },
      response: {
        rawLlmResponse: maxResult?.response ?? null,
        deliveredResponse: maxResponse,
        source: maxResult ? "llm" : "fallback",
      },
      gm: {
        causalGuidance: {
          guidance: maxInput.gmGuidance?.guidance ?? null,
          topicsCovered: maxInput.gmGuidance?.topicsCovered ?? [],
          source: maxInput.gmGuidance ? "previous_post_turn" : "none",
        },
        preTurnPlanner: { status: "not_executed", reason: "disabled_in_prd4_live" },
        validator: { status: "not_executed", reason: "disabled_in_prd4_live" },
        labelPass: { status: "pending", effect: "parallel_not_causal" },
        postTurn: { status: "pending", effect: "next_turn" },
      },
      timings: {
        summaryFetchMs,
        ragMs: rag_ms,
        promptBuildMs: maxResult?.promptBuildLatencyMs ?? maxFailureDiagnostic?.promptBuildLatencyMs ?? 0,
        maxClientMs: max_ms,
        maxProxyMs: (maxResult?.diagnosticTrace ?? maxFailureDiagnostic?.diagnosticTrace)?.proxyLatencyMs ?? null,
        maxUpstreamMs: (maxResult?.diagnosticTrace ?? maxFailureDiagnostic?.diagnosticTrace)?.upstreamLatencyMs ?? null,
        pipelineUninstrumentedMs: Math.max(0, coreTotalMs - rag_ms - max_ms),
        coreTotalMs,
        traceWriteMs: null,
        observedTotalMs: coreTotalMs,
      },
    };

    const compactTrace = compactConversationTurnTrace(trace);
    const enqueueResult = await enqueueConversationTurnTrace(compactTrace).catch((error) => {
      console.error("[PRD4 orchestrator] Diagnostic trace enqueue failed without blocking voice", error);
      return { durable: false, enqueueMs: 0 };
    });
    traceWriteMs = enqueueResult.enqueueMs;
    trace.timings.traceWriteMs = traceWriteMs;
    trace.timings.observedTotalMs = Math.round(performance.now() - t0);
    compactTrace.timings.traceWriteMs = traceWriteMs;
    compactTrace.timings.traceEnqueueMs = traceWriteMs;
    compactTrace.timings.observedTotalMs = trace.timings.observedTotalMs;
    void patchQueuedConversationTurnTrace(input.sessionId, turnIndex, ["timings"], compactTrace.timings).catch((error) => {
      console.warn("[PRD4 orchestrator] Deferred diagnostic timing patch failed", error);
    });
    rawPostTurnPromise = runPostTurn();
  }

  rawPostTurnPromise ??= runPostTurn();

  const labelPromise = rawLabelPromise.then(async (result) => {
    if (diagnosticTraceEnabled && input.sessionId) {
      await patchQueuedConversationTurnTrace(input.sessionId, turnIndex, ["gm", "labelPass"], {
        status: result.ok ? "complete" : "error",
        effect: "parallel_not_causal",
        latencyMs: result.latency_ms,
        model: result.model,
        labels: result.labels,
        diagnostic: result.diagnostic ?? null,
      });
    }
    return result;
  });

  const postTurnPromise = rawPostTurnPromise.then(async (result) => {
    if (diagnosticTraceEnabled && input.sessionId) {
      await patchQueuedConversationTurnTrace(input.sessionId, turnIndex, ["gm", "postTurn"], {
        status: result.diagnostic?.error ? "error" : "complete",
        effect: "next_turn",
        latencyMs: result.latency_ms ?? null,
        model: result.model ?? null,
        parsedOutput: result,
        diagnostic: result.diagnostic ?? null,
      });
    }
    return result;
  });

  if (
    input.sessionId &&
    summaryEvery > 0 &&
    turnIndex - lastSummarizedTurn >= summaryEvery
  ) {
    const pendingSummary = selectUnsummarizedConversation(
      [
        ...input.conversationHistory,
        { role: "user", content: input.userMessage, timestamp: Date.now() },
        { role: "max", content: maxResponse, timestamp: Date.now() },
      ],
      lastSummarizedTurn,
    );
    void summarizeSessionAsync(input.sessionId, pendingSummary, turnIndex);
  }

  return {
    maxResponse,
    timings: {
      rag_ms,
      max_ms,
      total_ms: Math.round(performance.now() - t0),
      ...(diagnosticTraceEnabled ? { trace_write_ms: traceWriteMs } : {}),
    },
    ragMatches: matchesCount,
    memory: {
      totalMessages: input.conversationHistory.length,
      recentMessages: maxConversationHistory.length,
      summaryLastTurn: lastSummarizedTurn,
    },
    postTurnPromise,
    labelPromise,
    traceId,
  };
}
