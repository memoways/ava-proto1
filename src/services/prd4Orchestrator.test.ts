import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agents/maxAgent", () => ({ simulateMaxResponse: vi.fn() }));
vi.mock("@/agents/gameMasterPRD4", () => ({ evaluatePostTurnPRD4: vi.fn() }));
vi.mock("@/agents/gameMasterLabelPRD4", () => ({ labelUserTurnPRD4: vi.fn() }));
vi.mock("@/services/ragService", () => ({
  queryRAG: vi.fn(),
  formatRAGContext: vi.fn(() => ""),
  buildKnowledgeContextFromRAG: vi.fn(() => ({
    allowedFacts: [],
    activeMemories: [],
    hypotheses: [],
    forbiddenTopics: [],
    blockedAssertions: [],
  })),
}));
vi.mock("@/services/characterPromptService", () => ({ resolveCharacterIdByName: vi.fn() }));
vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: vi.fn(() => ({
    TIMEOUT_SECONDS: 930,
    RAG_TOP_K: 5,
    RAG_RERANK_ENABLED: true,
    RAG_RETRIEVE_K: 15,
    RAG_EMBEDDING_PROVIDER: "voyage",
    RAG_SUMMARY_EVERY_N_TURNS: 4,
  })),
}));
vi.mock("@/services/sessionMemoryService", () => ({
  fetchSessionSummary: vi.fn(),
  summarizeSessionAsync: vi.fn(),
}));

import { simulateMaxResponse } from "@/agents/maxAgent";
import { evaluatePostTurnPRD4 } from "@/agents/gameMasterPRD4";
import { labelUserTurnPRD4 } from "@/agents/gameMasterLabelPRD4";
import { queryRAG } from "@/services/ragService";
import { resolveCharacterIdByName } from "@/services/characterPromptService";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { processPRD4Turn } from "@/services/prd4Orchestrator";
import { MAX_LLM_RESPONSE_DEADLINE_MS, TURN_RESPONSE_DEADLINE_MS } from "@/config/experienceRuntime";
import type { ConversationMessage, PRD4PostTurnEvaluation } from "@/types";

function makeConversation(turns: number): ConversationMessage[] {
  return Array.from({ length: turns }, (_, index) => index + 1).flatMap((turn) => [
    { role: "user" as const, content: `question-${turn}`, timestamp: turn * 2 },
    { role: "max" as const, content: `response-${turn}`, timestamp: turn * 2 + 1 },
  ]);
}

const postTurnResult: PRD4PostTurnEvaluation = {
  engagement_delta: 0,
  confusion_detected: false,
  role_usage_quality: "medium",
  topics_covered: [],
  transition_recommended: false,
  cinematic_hint: null,
  next_turn_guidance: "Continuer.",
  end_recommended: false,
  moderation_flag: false,
  notes: "test",
  trigger_video_id: null,
  labels: { themes: [], topics: [], intentions: [] },
};

describe("processPRD4Turn — Phase 2 endurance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCharacterIdByName).mockResolvedValue("character-max");
    vi.mocked(queryRAG).mockResolvedValue([]);
    vi.mocked(fetchSessionSummary).mockResolvedValue({
      session_id: "session-soak",
      summary: "- L'utilisateur cherche Ava.",
      last_turn: 32,
      updated_at: new Date().toISOString(),
    });
    vi.mocked(simulateMaxResponse).mockResolvedValue({ response: "Je vous écoute.", systemPrompt: "system" });
    vi.mocked(labelUserTurnPRD4).mockResolvedValue({
      labels: { themes: [], topics: [], intentions: [] },
      latency_ms: 1,
      model: "test",
      ok: true,
    });
    vi.mocked(evaluatePostTurnPRD4).mockResolvedValue(postTurnResult);
    vi.mocked(summarizeSessionAsync).mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a 36th turn bounded and refreshes only unsummarized memory", async () => {
    const history = makeConversation(35);
    const result = await processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: history,
      userMessage: "question-36",
      userRole: null,
      timeElapsedSeconds: 14 * 60,
    });

    expect(result.memory).toEqual({ totalMessages: 70, recentMessages: 10, summaryLastTurn: 32 });
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0]).toMatchObject({
      conversationHistory: history.slice(-10),
      sessionSummary: "- L'utilisateur cherche Ava.",
    });
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0][1]).toHaveLength(8);
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0][1][0].content).toBe("question-33");
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0][1].at(-1)?.content).toBe("Je vous écoute.");
    await result.labelPromise;
    await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0]).toMatchObject({
      conversationHistory: expect.any(Array),
      sessionDurationSeconds: 930,
      minimumClosureSeconds: 744,
    });
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0].conversationHistory).toHaveLength(10);
  });

  it("skips summarization when the cached summary is recent enough", async () => {
    vi.mocked(fetchSessionSummary).mockResolvedValue({
      session_id: "session-soak",
      summary: "- L'utilisateur cherche Ava.",
      last_turn: 34,
      updated_at: new Date().toISOString(),
    });

    const result = await processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: makeConversation(35),
      userMessage: "question-36",
      userRole: null,
      timeElapsedSeconds: 14 * 60,
    });

    expect(result.memory.summaryLastTurn).toBe(34);
    expect(summarizeSessionAsync).not.toHaveBeenCalled();
    await Promise.all([result.labelPromise, result.postTurnPromise]);
  });

  it("falls back from a stalled RAG after two seconds and still answers", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchSessionSummary).mockResolvedValue(null);
    vi.mocked(queryRAG).mockImplementation(() => new Promise(() => {}));

    const turnPromise = processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: [],
      userMessage: "Vous êtes là ?",
      userRole: null,
      timeElapsedSeconds: 60,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await turnPromise;

    expect(result.maxResponse).toBe("Je vous écoute.");
    expect(simulateMaxResponse).toHaveBeenCalledOnce();
    expect(result.timings.total_ms).toBeLessThanOrEqual(TURN_RESPONSE_DEADLINE_MS);
  });

  it("preserves a full Max generation window after a stalled RAG", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchSessionSummary).mockResolvedValue(null);
    vi.mocked(queryRAG).mockImplementation(() => new Promise(() => {}));
    vi.mocked(simulateMaxResponse).mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ response: "Réponse complète de Max.", systemPrompt: "system" }), 3_500);
    }));

    const turnPromise = processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: [],
      userMessage: "Alors, comment vas-tu ?",
      userRole: null,
      timeElapsedSeconds: 60,
    });
    await vi.advanceTimersByTimeAsync(5_500);
    const result = await turnPromise;

    expect(result.maxResponse).toBe("Réponse complète de Max.");
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][1]?.timeoutMs).toBe(MAX_LLM_RESPONSE_DEADLINE_MS);
    expect(result.timings.total_ms).toBeLessThanOrEqual(TURN_RESPONSE_DEADLINE_MS);
  });

  it("keeps ordering and bounded context across thirty simulated 35-turn sessions", async () => {
    vi.mocked(fetchSessionSummary).mockResolvedValue(null);
    vi.mocked(simulateMaxResponse).mockImplementation(async (input) => ({
      response: `max:${input.userMessage}`,
      systemPrompt: "system",
    }));

    for (let session = 1; session <= 30; session += 1) {
      const history: ConversationMessage[] = [];
      for (let turn = 1; turn <= 35; turn += 1) {
        const userMessage = `session-${session}-turn-${turn}`;
        const result = await processPRD4Turn({
          sessionId: `session-${session}`,
          conversationHistory: history,
          userMessage,
          userRole: null,
          timeElapsedSeconds: Math.floor((turn / 35) * 930),
        });
        expect(result.memory.recentMessages).toBeLessThanOrEqual(10);
        history.push(
          { role: "user", content: userMessage, timestamp: turn * 2 },
          { role: "max", content: result.maxResponse, timestamp: turn * 2 + 1 },
        );
        await Promise.all([result.labelPromise, result.postTurnPromise]);
      }

      expect(history).toHaveLength(70);
      expect(history.at(-2)?.content).toBe(`session-${session}-turn-35`);
      expect(history.at(-1)?.content).toBe(`max:session-${session}-turn-35`);
    }
  });
});
