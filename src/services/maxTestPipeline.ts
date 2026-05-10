import { queryRAGDetailed, formatRAGContext, buildKnowledgeContextFromRAG, rewriteRAGQuery, type RAGMatch } from "./ragService";
import { planGameMasterTurnDetailed, type PlanGameMasterDetailed } from "@/agents/gameMasterAgent";
import { simulateMaxResponse, validateMaxResponseDetailed, type SimulateMaxResult, type ValidateMaxDetailed } from "@/agents/maxAgent";
import type { ConversationMessage, MaxTurnKnowledgeContext } from "@/types";
import { getGameplaySettings } from "./settingsService";

export interface StepStatus {
  status: "pending" | "running" | "ok" | "error" | "skipped";
  startedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface MaxTestStepStates {
  rewrite: StepStatus & { original?: string; rewritten?: string | null };
  rag: StepStatus & { matches?: RAGMatch[]; threshold?: number; topK?: number; embeddingProvider?: string; rerankUsed?: boolean };
  knowledge: StepStatus & { context?: MaxTurnKnowledgeContext };
  gmPre: StepStatus & { detail?: PlanGameMasterDetailed };
  max: StepStatus & { detail?: SimulateMaxResult };
  validator: StepStatus & { detail?: ValidateMaxDetailed };
}

export interface MaxTestPipelineInput {
  characterName: string;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  ragTopK?: number;
  ragThreshold?: number;
  currentTrustLevel?: number;
  triggeredIds?: string[];
  timeElapsedSeconds?: number;
  skipRAG?: boolean;
  skipGM?: boolean;
  skipValidator?: boolean;
}

export type StepKey = keyof MaxTestStepStates;

export function emptyStepStates(): MaxTestStepStates {
  return {
    rewrite: { status: "pending" },
    rag: { status: "pending" },
    knowledge: { status: "pending" },
    gmPre: { status: "pending" },
    max: { status: "pending" },
    validator: { status: "pending" },
  };
}

/**
 * Parse a free-form history textarea like:
 *   USER: bonjour
 *   MAX: salut, qui es-tu ?
 */
export function parseHistory(text: string): ConversationMessage[] {
  const lines = text.split(/\r?\n/);
  const out: ConversationMessage[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(USER|MAX|UTILISATEUR|ASSISTANT)\s*[:\-]\s*(.+)$/i);
    if (!m) continue;
    const role = /USER|UTILISATEUR/i.test(m[1]) ? "user" : "max";
    out.push({ role, content: m[2].trim(), timestamp: Date.now() });
  }
  return out;
}

/**
 * Run the full Max test pipeline. Calls onUpdate after each step so the UI
 * can render the chronology incrementally.
 */
export async function runMaxTestPipeline(
  input: MaxTestPipelineInput,
  onUpdate: (states: MaxTestStepStates) => void,
): Promise<MaxTestStepStates> {
  const states = emptyStepStates();
  const gameplay = getGameplaySettings();
  const topK = input.ragTopK ?? gameplay.RAG_TOP_K;
  const threshold = input.ragThreshold ?? 0.3;
  const recentText = input.conversationHistory.slice(-4).map((m) => m.content).join(" ");

  // 1. RAG
  let ragContext = "";
  let knowledgeContext: MaxTurnKnowledgeContext = {};
  if (input.skipRAG) {
    states.rag = { status: "skipped" };
    states.knowledge = { status: "skipped" };
  } else {
    states.rag = { status: "running", startedAt: performance.now(), topK, threshold };
    onUpdate({ ...states });
    const ragRes = await queryRAGDetailed(input.userMessage, recentText, topK, threshold);
    states.rag = {
      status: ragRes.error ? "error" : "ok",
      durationMs: ragRes.latencyMs,
      matches: ragRes.matches,
      threshold,
      topK,
      error: ragRes.error,
    };
    onUpdate({ ...states });
    ragContext = formatRAGContext(ragRes.matches);

    // 2. Knowledge build
    const t0 = performance.now();
    states.knowledge = { status: "running", startedAt: t0 };
    onUpdate({ ...states });
    knowledgeContext = buildKnowledgeContextFromRAG(ragRes.matches);
    states.knowledge = { status: "ok", durationMs: Math.round(performance.now() - t0), context: knowledgeContext };
    onUpdate({ ...states });
  }

  // 3. GM pre-turn
  if (input.skipGM) {
    states.gmPre = { status: "skipped" };
  } else {
    states.gmPre = { status: "running", startedAt: performance.now() };
    onUpdate({ ...states });
    try {
      const gmDetail = await planGameMasterTurnDetailed({
        conversationHistory: input.conversationHistory,
        userMessage: input.userMessage,
        currentTrustLevel: input.currentTrustLevel ?? 0,
        triggeredIds: input.triggeredIds ?? [],
        timeElapsedSeconds: input.timeElapsedSeconds ?? 0,
        knowledgeContext,
      });
      states.gmPre = { status: gmDetail.error ? "error" : "ok", durationMs: gmDetail.latencyMs, detail: gmDetail, error: gmDetail.error };
    } catch (err) {
      states.gmPre = { status: "error", error: err instanceof Error ? err.message : String(err) };
    }
    onUpdate({ ...states });
  }

  // 4. Max response
  states.max = { status: "running", startedAt: performance.now() };
  onUpdate({ ...states });
  let maxDetail: SimulateMaxResult | undefined;
  try {
    maxDetail = await simulateMaxResponse(
      {
        conversationHistory: input.conversationHistory,
        userMessage: input.userMessage,
        ragContext: ragContext || undefined,
        knowledgeContext,
      },
      { characterName: input.characterName, featureKey: "max_prompt_test_full" },
    );
    states.max = { status: "ok", durationMs: maxDetail.latencyMs, detail: maxDetail };
  } catch (err) {
    states.max = { status: "error", error: err instanceof Error ? err.message : String(err) };
    onUpdate({ ...states });
    return states;
  }
  onUpdate({ ...states });

  // 5. Validator
  if (input.skipValidator || !maxDetail) {
    states.validator = { status: "skipped" };
  } else {
    states.validator = { status: "running", startedAt: performance.now() };
    onUpdate({ ...states });
    try {
      const valDetail = await validateMaxResponseDetailed({
        userMessage: input.userMessage,
        response: maxDetail.response,
        ragContext: ragContext || undefined,
        knowledgeContext,
      });
      states.validator = { status: "ok", durationMs: valDetail.latencyMs, detail: valDetail };
    } catch (err) {
      states.validator = { status: "error", error: err instanceof Error ? err.message : String(err) };
    }
    onUpdate({ ...states });
  }

  return states;
}

/** Cheap token estimate for client-side display when no API usage info. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function totalLatencyMs(states: MaxTestStepStates): number {
  return Object.values(states).reduce((sum, s) => sum + (s.durationMs || 0), 0);
}

export function totalTokens(states: MaxTestStepStates): number {
  let t = 0;
  if (states.gmPre.detail?.usage?.total_tokens) t += states.gmPre.detail.usage.total_tokens;
  if (states.max.detail?.usage?.total_tokens) t += states.max.detail.usage.total_tokens;
  if (states.validator.detail?.usage?.total_tokens) t += states.validator.detail.usage.total_tokens;
  return t;
}
