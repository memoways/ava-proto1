/**
 * PRD4 — Orchestrateur lean d'un tour de conversation.
 *
 * Différences vs `processConversationTurn` (legacy A/B) :
 *  - Pas de GM pré-tour LLM (rapport coût/bénéfice trop faible en live).
 *  - Pas de validateur anti-hallucination (gardé pour le banc d'essai).
 *  - Injecte le `summary_for_max` du profil joueur dans le system prompt de Max.
 *  - Fire-and-forget : évaluation PRD4 post-tour (jamais bloquante pour le TTS).
 */
import { simulateMaxResponse, type MaxAgentInput } from "@/agents/maxAgent";
import { evaluatePostTurnPRD4 } from "@/agents/gameMasterPRD4";
import { labelUserTurnPRD4, type PRD4LabelResult } from "@/agents/gameMasterLabelPRD4";
import {
  buildKnowledgeContextFromRAG,
  formatRAGContext,
  queryRAG,
} from "@/services/ragService";
import { resolveCharacterIdByName } from "@/services/characterPromptService";
import { getGameplaySettings } from "@/services/settingsService";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { selectRecentConversation, selectUnsummarizedConversation } from "@/services/conversationMemory";
import { withTimeout } from "@/services/asyncUtils";
import {
  RAG_DEGRADED_MODE_DEADLINE_MS,
  SUMMARY_FETCH_DEADLINE_MS,
  TURN_RESPONSE_DEADLINE_MS,
} from "@/config/experienceRuntime";
import type { ConversationMessage, PRD4PostTurnEvaluation, UserRoleProfile } from "@/types";

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
  onLatencySegment?: (event: PRD4LatencySegmentEvent) => void;
  /** Abort when the UI has moved to a newer turn or ended the session. */
  signal?: AbortSignal;
}

export interface PRD4TurnResult {
  maxResponse: string;
  timings: {
    rag_ms: number;
    max_ms: number;
    total_ms: number;
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
}

export type PRD4LatencySegmentEvent =
  | { type: "start"; segment: "RAG" | "LLM" | "GM"; service: string }
  | { type: "end"; segment: "RAG" | "LLM" | "GM"; service: string; durationMs: number };

const MAX_FALLBACK_RESPONSE =
  "Je vous entends, mais la ligne accroche. Répétez juste l'essentiel, s'il vous plaît.";

export async function processPRD4Turn(input: PRD4TurnInput): Promise<PRD4TurnResult> {
  const t0 = performance.now();
  const responseDeadlineAt = t0 + TURN_RESPONSE_DEADLINE_MS;
  const turnIndex = input.conversationHistory.filter((m) => m.role === "user").length + 1;
  const recentConversation = selectRecentConversation(input.conversationHistory);
  const gameplay = (() => {
    try { return getGameplaySettings(); } catch { return null; }
  })();
  const summaryPromise = input.sessionId
    ? withTimeout(
        "prd4_summary_fetch",
        fetchSessionSummary(input.sessionId),
        SUMMARY_FETCH_DEADLINE_MS,
      ).catch(() => null)
    : Promise.resolve(null);

  // --- RAG (best-effort, non-bloquant en cas d'erreur) -----------------------
  const ragStart = performance.now();
  input.onLatencySegment?.({ type: "start", segment: "RAG", service: "RAG" });
  let ragContext = "";
  let knowledgeContext = buildKnowledgeContextFromRAG([]);
  let matchesCount = 0;
  try {
    const recent = recentConversation.slice(-4).map((m) => m.content).join(" ");
    // Cloisonnement RAG : on ne récupère QUE les chunks du personnage courant
    // (les chunks shared/storyworld avec character_id NULL restent visibles).
    const characterId = await resolveCharacterIdByName(input.characterName || "Max");
    const matches = await withTimeout(
      "prd4_rag",
      queryRAG(
        input.userMessage,
        recent,
        gameplay?.RAG_TOP_K ?? 5,
        undefined,
        {
          characterId,
          rerank: gameplay?.RAG_RERANK_ENABLED,
          retrieveK: gameplay?.RAG_RETRIEVE_K,
          provider: gameplay?.RAG_EMBEDDING_PROVIDER,
          signal: input.signal,
          timeoutMs: RAG_DEGRADED_MODE_DEADLINE_MS,
        },
      ),
      RAG_DEGRADED_MODE_DEADLINE_MS,
    );
    matchesCount = matches.length;
    ragContext = formatRAGContext(matches);
    knowledgeContext = buildKnowledgeContextFromRAG(matches);
  } catch (err) {
    console.warn("[PRD4 orchestrator] RAG failed (non-fatal):", err);
  }
  const rag_ms = Math.round(performance.now() - ragStart);
  input.onLatencySegment?.({ type: "end", segment: "RAG", service: "RAG", durationMs: rag_ms });

  // --- GM Label Pass (parallèle à Max) ---------------------------------------
  const labelPromise: Promise<PRD4LabelResult> = labelUserTurnPRD4({
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    conversationHistory: recentConversation,
    userPostureRaw: input.userPostureRaw ?? null,
    signal: input.signal,
  });

  // --- Max --------------------------------------------------------------------
  const maxStart = performance.now();
  input.onLatencySegment?.({ type: "start", segment: "LLM", service: "Max LLM" });
  const summaryRecord = await summaryPromise;
  const postureSummary = input.userPostureRaw?.trim()
    ? `L'utilisateur a démarré la conversation en exprimant ceci (à garder en mémoire tout au long de l'échange comme contexte de qui il est et de ce qu'il vient chercher) : « ${input.userPostureRaw.trim()} »`
    : undefined;
  const maxInput: MaxAgentInput = {
    conversationHistory: recentConversation,
    userMessage: input.userMessage,
    ragContext: ragContext || undefined,
    postVideoContext: input.postVideoContext,
    session_id: input.sessionId ?? undefined,
    knowledgeContext,
    sessionSummary: summaryRecord?.summary,
    userRoleSummary: input.userRole?.summary_for_max ?? postureSummary,
  };
  let maxResponse = "";
  let max_ms = 0;
  try {
    const remainingMs = Math.floor(responseDeadlineAt - performance.now());
    if (remainingMs < 250) throw new Error("PRD4 response deadline exhausted after RAG");
    const { response } = await simulateMaxResponse(maxInput, {
      characterName: input.characterName || "Max",
      featureKey: "prd4_chat",
      timeoutMs: Math.min(4_000, remainingMs),
      signal: input.signal,
    });
    maxResponse = response;
  } catch (err) {
    console.warn("[PRD4 orchestrator] Max LLM failed (fallback response):", err);
    maxResponse = MAX_FALLBACK_RESPONSE;
  } finally {
    max_ms = Math.round(performance.now() - maxStart);
    input.onLatencySegment?.({ type: "end", segment: "LLM", service: "Max LLM", durationMs: max_ms });
  }

  // --- GM post-turn (void) ---------------------------------------------------
  const postTurnPromise = (async () => {
    const gmStart = performance.now();
    input.onLatencySegment?.({ type: "start", segment: "GM", service: "GM post-turn" });
    try {
      return await evaluatePostTurnPRD4({
        sessionId: input.sessionId,
        conversationHistory: recentConversation,
        userMessage: input.userMessage,
        maxResponse,
        userRole: input.userRole,
        userPostureRaw: input.userPostureRaw ?? null,
        turnIndex,
        timeElapsedSeconds: input.timeElapsedSeconds,
        triggeredVideoIds: input.triggeredVideoIds,
        signal: input.signal,
      });
    } finally {
      input.onLatencySegment?.({
        type: "end",
        segment: "GM",
        service: "GM post-turn",
        durationMs: Math.round(performance.now() - gmStart),
      });
    }
  })();

  const summaryEvery = gameplay?.RAG_SUMMARY_EVERY_N_TURNS ?? 4;
  const lastSummarizedTurn = summaryRecord?.last_turn ?? 0;
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
    },
    ragMatches: matchesCount,
    memory: {
      totalMessages: input.conversationHistory.length,
      recentMessages: recentConversation.length,
      summaryLastTurn: lastSummarizedTurn,
    },
    postTurnPromise,
    labelPromise,
  };
}
