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
import {
  buildKnowledgeContextFromRAG,
  formatRAGContext,
  queryRAG,
} from "@/services/ragService";
import { getGameplaySettings } from "@/services/settingsService";
import type { ConversationMessage, PRD4PostTurnEvaluation, UserRoleProfile } from "@/types";

export interface PRD4TurnInput {
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  userRole: UserRoleProfile | null;
  timeElapsedSeconds: number;
  /** Personnage appelé (PRD4 : "max" toujours, autres grisés). */
  characterName?: string;
}

export interface PRD4TurnResult {
  maxResponse: string;
  timings: {
    rag_ms: number;
    max_ms: number;
    total_ms: number;
  };
  ragMatches: number;
  /** Promesse résolue quand le GM post-turn a fini (à attendre en arrière-plan). */
  postTurnPromise: Promise<PRD4PostTurnEvaluation>;
}

export async function processPRD4Turn(input: PRD4TurnInput): Promise<PRD4TurnResult> {
  const t0 = performance.now();
  const gameplay = (() => {
    try { return getGameplaySettings(); } catch { return null; }
  })();

  // --- RAG (best-effort, non-bloquant en cas d'erreur) -----------------------
  const ragStart = performance.now();
  let ragContext = "";
  let knowledgeContext = buildKnowledgeContextFromRAG([]);
  let matchesCount = 0;
  try {
    const recent = input.conversationHistory.slice(-4).map((m) => m.content).join(" ");
    const matches = await queryRAG(
      input.userMessage,
      recent,
      gameplay?.RAG_TOP_K ?? 5,
      undefined,
      {
        rerank: gameplay?.RAG_RERANK_ENABLED,
        retrieveK: gameplay?.RAG_RETRIEVE_K,
        provider: gameplay?.RAG_EMBEDDING_PROVIDER,
      },
    );
    matchesCount = matches.length;
    ragContext = formatRAGContext(matches);
    knowledgeContext = buildKnowledgeContextFromRAG(matches);
  } catch (err) {
    console.warn("[PRD4 orchestrator] RAG failed (non-fatal):", err);
  }
  const rag_ms = Math.round(performance.now() - ragStart);

  // --- Max --------------------------------------------------------------------
  const maxStart = performance.now();
  const maxInput: MaxAgentInput = {
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    ragContext: ragContext || undefined,
    session_id: input.sessionId ?? undefined,
    knowledgeContext,
    userRoleSummary: input.userRole?.summary_for_max,
  };
  const { response: maxResponse } = await simulateMaxResponse(maxInput, {
    characterName: input.characterName || "Max",
    featureKey: "prd4_chat",
  });
  const max_ms = Math.round(performance.now() - maxStart);

  // --- GM post-turn (void) ---------------------------------------------------
  const turnIndex = input.conversationHistory.filter((m) => m.role === "user").length + 1;
  const postTurnPromise = evaluatePostTurnPRD4({
    sessionId: input.sessionId,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    maxResponse,
    userRole: input.userRole,
    turnIndex,
    timeElapsedSeconds: input.timeElapsedSeconds,
  });

  return {
    maxResponse,
    timings: {
      rag_ms,
      max_ms,
      total_ms: Math.round(performance.now() - t0),
    },
    ragMatches: matchesCount,
    postTurnPromise,
  };
}
