import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agents/maxAgent", () => ({ simulateMaxResponse: vi.fn() }));
vi.mock("@/agents/gameMasterPRD4", () => ({ evaluatePostTurnPRD4: vi.fn() }));
vi.mock("@/agents/gameMasterLabelPRD4", () => ({ labelUserTurnPRD4: vi.fn() }));
vi.mock("@/services/ragService", () => ({
  queryRAGDetailed: vi.fn(),
  formatRAGContext: vi.fn(() => ""),
  formatMaxRAGContext: vi.fn(() => ""),
  buildKnowledgeContextFromRAG: vi.fn(() => ({
    allowedFacts: [],
    activeMemories: [],
    hypotheses: [],
    forbiddenTopics: [],
    blockedAssertions: [],
  })),
}));
vi.mock("@/services/conversationTraceOutbox", () => ({
  enqueueConversationTurnTrace: vi.fn(),
  patchQueuedConversationTurnTrace: vi.fn(),
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
  getLLMSettings: vi.fn(() => ({
    LLM_MODEL: "openai/gpt-4.1-mini",
    LLM_TEMPERATURE: 0.7,
    LLM_MAX_TOKENS: 120,
    LLM_TOP_P: 0.9,
  })),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/sessionMemoryService", () => ({
  fetchSessionSummary: vi.fn(),
  summarizeSessionAsync: vi.fn(),
}));
vi.mock("@/services/sessionConversationMemory", () => ({
  fetchConversationMemory: vi.fn(),
}));

import { simulateMaxResponse } from "@/agents/maxAgent";
import { evaluatePostTurnPRD4 } from "@/agents/gameMasterPRD4";
import { labelUserTurnPRD4 } from "@/agents/gameMasterLabelPRD4";
import { queryRAGDetailed } from "@/services/ragService";
import { enqueueConversationTurnTrace, patchQueuedConversationTurnTrace } from "@/services/conversationTraceOutbox";
import { materializeConversationTurnTrace } from "@/services/conversationTraceFormat";
import { resolveCharacterIdByName } from "@/services/characterPromptService";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { fetchConversationMemory } from "@/services/sessionConversationMemory";
import { getGameplaySettings } from "@/services/settingsService";
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
    vi.mocked(queryRAGDetailed).mockResolvedValue({
      matches: [],
      retrievalMatches: [],
      latencyMs: 1,
      embeddingProvider: "voyage",
      rerankUsed: true,
      serverLatencyMs: 1,
      searchInput: "question",
      request: {
        userMessage: "question",
        recentContext: "",
        rewrittenQuery: null,
        matchCount: 5,
        matchThreshold: 0.3,
        characterId: "character-max",
        rerankRequested: true,
        retrieveK: 15,
        rerankModel: "rerank-2.5",
        rerankTruncation: true,
      },
    });
    vi.mocked(fetchSessionSummary).mockResolvedValue({
      session_id: "session-soak",
      summary: "- L'utilisateur cherche Ava.",
      last_turn: 32,
      updated_at: new Date().toISOString(),
    });
    vi.mocked(fetchConversationMemory).mockResolvedValue({
      version: 1,
      lastTurn: 0,
      interlocutor: { name: null, role: null, traits: [] },
      userFacts: [],
      maxDisclosures: [],
      commitments: [],
      openThreads: [],
      topics: [],
      relationship: { depth: "surface", trust: "neutre", emotionalState: null, sourceTurn: 0 },
      lastExchange: null,
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
    vi.mocked(enqueueConversationTurnTrace).mockResolvedValue({ durable: true, enqueueMs: 3 });
    vi.mocked(patchQueuedConversationTurnTrace).mockResolvedValue();
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
    expect(vi.mocked(queryRAGDetailed).mock.calls[0][0]).toBe("question-36");
    expect(vi.mocked(queryRAGDetailed).mock.calls[0][1]).toBe("question-35 response-35");
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

  it("injecte la mémoire structurée, étend les tours non résumés et récupère un vivier RAG", async () => {
    vi.mocked(getGameplaySettings).mockReturnValue({
      TIMEOUT_SECONDS: 930,
      RAG_TOP_K: 3,
      RAG_RERANK_ENABLED: true,
      RAG_RETRIEVE_K: 15,
      RAG_SUMMARY_EVERY_N_TURNS: 4,
      MAX_PROMPT_VARIANT: "optimized_v3",
    } as ReturnType<typeof getGameplaySettings>);
    const structuredMemory = {
      version: 1 as const,
      lastTurn: 5,
      interlocutor: { name: "Alice", role: "médecin", traits: [] },
      userFacts: [],
      maxDisclosures: [],
      commitments: [],
      openThreads: [],
      topics: [],
      relationship: { depth: "fissure" as const, trust: "ouverte" as const, emotionalState: null, sourceTurn: 5 },
      lastExchange: "Alice a confronté Max.",
    };
    vi.mocked(fetchConversationMemory).mockResolvedValue(structuredMemory);
    const matches = Array.from({ length: 6 }, (_, index) => ({
      id: `rag-${index + 1}`,
      source_table: "storyworld",
      source_id: `source-${index + 1}`,
      content: `souvenir-${index + 1}`,
      similarity: 0.9 - index * 0.01,
    }));
    vi.mocked(queryRAGDetailed).mockResolvedValue({
      matches,
      retrievalMatches: matches,
      latencyMs: 1,
      embeddingProvider: "voyage",
      rerankUsed: true,
      serverLatencyMs: 1,
      searchInput: "question",
      request: {
        userMessage: "question-9",
        recentContext: "",
        rewrittenQuery: null,
        matchCount: 6,
        matchThreshold: 0.3,
        characterId: "character-max",
        rerankRequested: true,
        retrieveK: 15,
        rerankModel: "rerank-2.5",
        rerankTruncation: true,
      },
    });

    const history = makeConversation(8);
    const result = await processPRD4Turn({
      sessionId: "session-optimized",
      conversationHistory: history,
      userMessage: "question-9",
      userRole: null,
      timeElapsedSeconds: 300,
    });
    const maxInput = vi.mocked(simulateMaxResponse).mock.calls[0][0];
    expect(vi.mocked(queryRAGDetailed).mock.calls[0][2]).toBe(6);
    expect(maxInput.conversationMemory).toEqual(structuredMemory);
    expect(maxInput.conversationHistory).toEqual(history.slice(-6));
    expect(maxInput.ragCandidates).toHaveLength(6);
    await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0].conversationMemoryBefore).toEqual(structuredMemory);
  });

  it("transmet le contexte temporel et la guidance GM à Max", async () => {
    const result = await processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: makeConversation(6),
      userMessage: "question-7",
      userRole: null,
      timeElapsedSeconds: 5 * 60,
      gmGuidance: "Laisse un silence, puis évoque Emma.",
      gmTopicsCovered: ["ava", "lausanne"],
    });

    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0]).toMatchObject({
      temporalContext: {
        timeElapsedSeconds: 300,
        sessionDurationSeconds: 930,
        turnIndex: 7,
      },
      gmGuidance: {
        guidance: "Laisse un silence, puis évoque Emma.",
        topicsCovered: ["ava", "lausanne"],
      },
    });
    await Promise.all([result.labelPromise, result.postTurnPromise]);
  });

  it("n'attache pas de guidance GM quand elle est vide", async () => {
    const result = await processPRD4Turn({
      sessionId: "session-soak",
      conversationHistory: [],
      userMessage: "Allô ?",
      userRole: null,
      timeElapsedSeconds: 10,
      gmGuidance: "   ",
    });

    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0].gmGuidance).toBeUndefined();
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0].temporalContext).toMatchObject({ turnIndex: 1 });
    await Promise.all([result.labelPromise, result.postTurnPromise]);
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
    vi.mocked(queryRAGDetailed).mockImplementation(() => new Promise(() => {}));

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
    vi.mocked(queryRAGDetailed).mockImplementation(() => new Promise(() => {}));
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

  it("does not persist or request detailed LLM payloads for a normal session", async () => {
    const result = await processPRD4Turn({
      sessionId: "session-normal",
      conversationHistory: [],
      userMessage: "Bonjour Max",
      userRole: null,
      timeElapsedSeconds: 5,
    });

    expect(enqueueConversationTurnTrace).not.toHaveBeenCalled();
    expect(patchQueuedConversationTurnTrace).not.toHaveBeenCalled();
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][1]).toMatchObject({ diagnosticTrace: false });
    expect(result.traceId).toBeNull();
    await Promise.all([result.labelPromise, result.postTurnPromise]);
  });

  it("queues a compact exact trace locally before returning a diagnostic response", async () => {
    vi.mocked(queryRAGDetailed).mockResolvedValue({
      matches: [{
        id: "chunk-1",
        source_table: "characters",
        source_id: "source-1",
        content: "Ava habite à Lausanne.",
        similarity: 0.91,
        retrieval_similarity: 0.83,
        rerank_score: 0.91,
        character_id: "character-max",
      }],
      retrievalMatches: [],
      latencyMs: 11,
      embeddingProvider: "voyage",
      rerankUsed: true,
      serverLatencyMs: 8,
      searchInput: "Où habite Ava ?\n\nContexte récent: Ava",
      request: {
        userMessage: "Où habite Ava ?",
        recentContext: "Ava",
        rewrittenQuery: null,
        matchCount: 5,
        matchThreshold: 0.3,
        characterId: "character-max",
        rerankRequested: true,
        retrieveK: 15,
        rerankModel: "rerank-2.5",
        rerankTruncation: true,
      },
    });
    vi.mocked(simulateMaxResponse).mockResolvedValue({
      response: "Elle habite à Lausanne.",
      systemPrompt: "SYSTEM EXACT",
      promptTrace: {
        baseSystemPrompt: "BASE",
        baseSource: { kind: "database", characterId: "character-max", canonicalName: "Max", updatedAt: "2026-07-21" },
        characterPrompt: { characterId: "character-max", canonicalName: "Max", updatedAt: "2026-07-21", renderedSections: "FICHE" },
        technicalRules: "RULES",
        injectedSections: [],
        finalSystemPrompt: "SYSTEM EXACT",
      },
      messages: [
        { role: "system", content: "SYSTEM EXACT" },
        { role: "user", content: "Où habite Ava ?" },
      ],
      diagnosticTrace: {
        clientPayload: { model: "openai/gpt-4.1-mini" },
        upstreamPayload: { model: "openai/gpt-4.1-mini", temperature: 0.7 },
        requestedModel: "openai/gpt-4.1-mini",
        returnedModel: "openai/gpt-4.1-mini-2025-04-14",
        provider: "OpenAI",
        generationId: "generation-1",
        usage: { prompt_tokens: 50, completion_tokens: 8, total_tokens: 58 },
        upstreamLatencyMs: 120,
        proxyLatencyMs: 125,
      },
      promptBuildLatencyMs: 2,
      requestedSettings: {
        model: "openai/gpt-4.1-mini",
        temperature: 0.7,
        maxTokens: 120,
        topP: 0.9,
        reasoning: false,
        timeoutMs: 8000,
      },
    });

    const result = await processPRD4Turn({
      sessionId: "session-traced",
      conversationHistory: [],
      userMessage: "Où habite Ava ?",
      userRole: null,
      timeElapsedSeconds: 15,
      turnId: "turn-stable-1",
      diagnosticTraceEnabled: true,
    });

    expect(result.traceId).toBeNull();
    expect(enqueueConversationTurnTrace).toHaveBeenCalledOnce();
    const compactTrace = vi.mocked(enqueueConversationTurnTrace).mock.calls[0][0];
    expect(compactTrace.schemaVersion).toBe(2);
    const trace = materializeConversationTurnTrace(compactTrace);
    expect(trace.identity).toMatchObject({ sessionId: "session-traced", turnId: "turn-stable-1", turnIndex: 1 });
    expect(trace.prompt?.finalSystemPrompt).toBe("SYSTEM EXACT");
    expect(trace.maxCall.messages[0].content).toBe(trace.prompt?.finalSystemPrompt);
    expect(trace.maxCall.diagnostic?.upstreamPayload).toEqual({
      model: "openai/gpt-4.1-mini",
      temperature: 0.7,
      messages: trace.maxCall.messages,
    });
    expect(trace.rag.matches[0]).toMatchObject({ retrieval_similarity: 0.83, rerank_score: 0.91 });
    expect(trace.response).toMatchObject({ rawLlmResponse: "Elle habite à Lausanne.", deliveredResponse: "Elle habite à Lausanne.", source: "llm" });
    await Promise.all([result.labelPromise, result.postTurnPromise]);
    expect(patchQueuedConversationTurnTrace).toHaveBeenCalledWith("session-traced", 1, ["gm", "labelPass"], expect.objectContaining({ effect: "parallel_not_causal" }));
    expect(patchQueuedConversationTurnTrace).toHaveBeenCalledWith("session-traced", 1, ["gm", "postTurn"], expect.objectContaining({ effect: "next_turn" }));
  });

  it("releases Max even when durable local persistence is temporarily unavailable", async () => {
    vi.mocked(enqueueConversationTurnTrace).mockResolvedValue({ durable: false, enqueueMs: 100 });

    const result = await processPRD4Turn({
      sessionId: "session-traced",
      conversationHistory: [],
      userMessage: "Question sensible",
      userRole: null,
      timeElapsedSeconds: 10,
      diagnosticTraceEnabled: true,
    });

    expect(result.maxResponse).toBe("Je vous écoute.");
    expect(result.traceId).toBeNull();
    expect(evaluatePostTurnPRD4).toHaveBeenCalledOnce();
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
