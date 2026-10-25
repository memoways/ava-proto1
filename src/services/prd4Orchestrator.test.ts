import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agents/maxAgent", async (importOriginal) => ({
  ...await importOriginal<typeof import('@/agents/maxAgent')>(), simulateMaxResponse: vi.fn(),
}));
vi.mock("@/agents/gameMasterPRD4", () => ({ evaluatePostTurnPRD4: vi.fn() }));
vi.mock("@/services/experienceOrchestration", () => ({
  fetchPinnedDirectorRuntime: vi.fn(async () => ({ versionId: "gm-v1", versionNumber: 1, prompt: "DIRECTOR", config: null })),
  fetchCharacterSpeechRuntime: vi.fn(async () => ({ rugosite: 0, settingsVersion: "test-v1", environmentId: "sandbox-ulrich", recentStates: [] })),
}));
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
vi.mock("@/services/characterPromptService", () => ({
  loadCharacterPrompt: vi.fn(async (characterId: string) => ({
    character_id: characterId,
    name: characterId === "22222222-2222-4222-8222-222222222222" ? "Emma Munz" : "Max Lorenzo",
    identite_fondamentale: "Identité de test attribuée.",
    qui_tu_es: "Voix de test.",
    ce_que_tu_ne_fais_jamais: "Ne jamais changer d'identité.",
    ce_que_tu_sais_utilisateur: "Un inconnu appelle.",
    dynamique_conversation: "Comprendre l'intention de l'appel.",
    sujets_sensibles: "Le fusil :: confiance :: après une relation construite",
    references_intellectuelles: "",
    timeline: "Aujourd'hui.",
    situation_summary: "Lausanne, aujourd'hui.",
    updated_at: "2026-09-11T00:00:00Z",
  })),
}));

import { simulateMaxResponse } from "@/agents/maxAgent";
import { evaluatePostTurnPRD4 } from "@/agents/gameMasterPRD4";
import { queryRAGDetailed } from "@/services/ragService";
import { enqueueConversationTurnTrace, patchQueuedConversationTurnTrace } from "@/services/conversationTraceOutbox";
import { materializeConversationTurnTrace } from "@/services/conversationTraceFormat";
import { fetchSessionSummary, summarizeSessionAsync } from "@/services/sessionMemoryService";
import { fetchConversationMemory } from "@/services/sessionConversationMemory";
import { fetchCharacterSpeechRuntime } from "@/services/experienceOrchestration";
import { loadCharacterPrompt } from '@/services/characterPromptService';
import speechSheets from '@/agents/__fixtures__/speechSandbox20261025.json';
import { getGameplaySettings } from "@/services/settingsService";
import { streamPRD4Turn, processPRD4Turn as processPRD4TurnImpl, type PRD4TurnInput } from "@/services/prd4Orchestrator";
import {
  MAX_LLM_RESPONSE_DEADLINE_MS,
  RAG_DEGRADED_MODE_DEADLINE_MS,
  SUMMARY_FETCH_DEADLINE_MS,
  TURN_RESPONSE_DEADLINE_MS,
  TURN_RESPONSE_FINALIZATION_RESERVE_MS,
} from "@/config/experienceRuntime";
import type { ConversationMessage, PRD4PostTurnEvaluation } from "@/types";

const MAX_CONTEXT = {
  characterKey: "max" as const,
  displayName: "Max Lorenzo",
  characterId: "11111111-1111-4111-8111-111111111111",
  notionPageId: "30362322e5958011ad7bffb1ed6772bc",
  environmentId: "prod",
  promptUpdatedAt: "2026-08-21T00:00:00.000Z",
};
const EMMA_CONTEXT = {
  characterKey: "emma" as const,
  displayName: "Emma Munz",
  characterId: "22222222-2222-4222-8222-222222222222",
  notionPageId: "881122c973c943409daed13b3113b00e",
  environmentId: "prod",
  promptUpdatedAt: "2026-08-21T00:00:00.000Z",
};

function processPRD4Turn(input: Omit<PRD4TurnInput, "characterContext"> & Partial<Pick<PRD4TurnInput, "characterContext">>) {
  return processPRD4TurnImpl({ ...input, characterContext: input.characterContext ?? MAX_CONTEXT });
}

function makeConversation(turns: number): ConversationMessage[] {
  return Array.from({ length: turns }, (_, index) => index + 1).flatMap((turn) => [
    { role: "user" as const, content: `question-${turn}`, timestamp: turn * 2 },
    { role: "max" as const, content: `response-${turn}`, timestamp: turn * 2 + 1 },
  ]);
}

// jsdom 20 predates this browser API; preserve its real cancellation semantics.
function cancellableTurn() {
  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'throwIfAborted', { value: () => {
    if (controller.signal.aborted) throw controller.signal.reason;
  } });
  return controller;
}

const postTurnResult: PRD4PostTurnEvaluation = {
  engagement_delta: 0,
  confusion_detected: false,
  role_usage_quality: "medium",
  topics_covered: [],
  transition_recommended: false,
  cinematic_hint: null,
  next_speech_state: null, next_turn_guidance: "Continuer.",
  end_recommended: false,
  moderation_flag: false,
  notes: "test",
  trigger_video_id: null,
  labels: { themes: [], topics: [], intentions: [] },
};

describe("processPRD4Turn — Phase 2 endurance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        characterId: MAX_CONTEXT.characterId,
        rerankRequested: true,
        retrieveK: 15,
        rerankModel: "rerank-2.5",
        rerankTruncation: true,
      },
    });
    vi.mocked(fetchSessionSummary).mockResolvedValue({
      session_id: "session-soak",
      character_key: "max",
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
      relationship: {
        depth: "surface",
        trust: "neutre",
        emotionalState: null,
        tier: "contact",
        topicOpenness: {},
        justification: "Premier contact",
        evidence: [],
        characterKey: "max",
        policyVersion: "unversioned",
        sourceTurn: 0,
      },
      lastExchange: null,
    });
    vi.mocked(simulateMaxResponse).mockResolvedValue({ response: "Je vous écoute.", systemPrompt: "system" });
    vi.mocked(evaluatePostTurnPRD4).mockResolvedValue(postTurnResult);
    vi.mocked(summarizeSessionAsync).mockResolvedValue();
    vi.mocked(enqueueConversationTurnTrace).mockResolvedValue({ durable: true, enqueueMs: 3 });
    vi.mocked(patchQueuedConversationTurnTrace).mockResolvedValue();
  });

  it("streams with the shared Emma frame and waits for delivered text before GM", async () => {
    let deliver!: (text: string) => void;
    const delivery = new Promise<string>(resolve => { deliver = resolve; });
    const events: string[] = [];
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
      opts?.onSpeechToken?.('{"goal":"Écouter","points":[]}\n<speech>\nBonjour. Une confidence privée. ');
      return { response: opts?.finishSpeech?.() ?? '', systemPrompt: 'system' };
    });
    const result = await streamPRD4Turn({ sessionId: 'session-stream', characterContext: EMMA_CONTEXT,
      conversationHistory: [], userMessage: 'Bonjour', userRole: null, hasSeenFilm: 'pas_vu', timeElapsedSeconds: 30 },
      event => events.push(event.type), delivery);
    expect(simulateMaxResponse).toHaveBeenCalledTimes(1);
    expect(evaluatePostTurnPRD4).not.toHaveBeenCalled();
    expect(events).toEqual(['intent','segment','complete']);
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0].experienceFrame).toBeTruthy();
    deliver('Bonjour.'); await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0]).toMatchObject({maxResponse:'Bonjour.',currentCharacter:'emma'});
  });

  it("does not evaluate an unheard response and preserves the batch call graph", async () => {
    const delivery = Promise.resolve('');
    const result = await streamPRD4Turn({ sessionId: null, characterContext: MAX_CONTEXT,
      conversationHistory: [], userMessage: 'Bonjour', userRole: null, timeElapsedSeconds: 30 }, ()=>{}, delivery);
    await expect(result.postTurnPromise).rejects.toThrow('No confirmed delivery');
    expect(evaluatePostTurnPRD4).not.toHaveBeenCalled();
  });

  it.each([MAX_CONTEXT, EMMA_CONTEXT])('$characterKey logs only the declared, validated and delivered state, never the GM suggestion', async context => {
    const sheet = speechSheets.find(sheet => sheet.name.startsWith(context.displayName))!;
    for (const declaration of [sheet.speech_states[0].name, 'ÉTAT INCONNU', undefined]) {
      vi.mocked(fetchCharacterSpeechRuntime).mockResolvedValueOnce({ rugosite: context.characterKey === 'max' ? 3 : 2,
        settingsVersion: 'snapshot-a1', environmentId: 'sandbox-ulrich', recentStates: [sheet.speech_states[1].name, sheet.speech_states[1].name] });
      vi.mocked(loadCharacterPrompt).mockResolvedValueOnce(sheet as never);
      const intent = { goal: 'Écouter', points: [], ...(declaration ? { parole: declaration } : {}) };
      vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
        opts?.onSpeechToken?.(JSON.stringify(intent) + '\n<speech>\nJe… je sais pas. ');
        return { response: opts?.finishSpeech?.() ?? '', responseIntent: intent, systemPrompt: 'system' };
      });
      let deliver!: (text: string) => void;
      const delivery = new Promise<string>(resolve => { deliver = resolve; });
      const count = vi.mocked(evaluatePostTurnPRD4).mock.calls.length;
      const result = await streamPRD4Turn({ sessionId: 'speech-delivery', characterContext: context,
        conversationHistory: [], userMessage: 'Et demain ?', userRole: null, timeElapsedSeconds: 30,
        gmSpeechState: sheet.speech_states[1].name }, () => {}, delivery);
      expect(evaluatePostTurnPRD4).toHaveBeenCalledTimes(count);
      expect(vi.mocked(simulateMaxResponse).mock.calls.at(-1)![0].speechStateDirective).toBe(sheet.speech_states[1].name);
      deliver('Je… je sais pas.'); await result.postTurnPromise;
      expect(vi.mocked(evaluatePostTurnPRD4).mock.calls.at(-1)![0]).toMatchObject({
        speechStatePlayed: declaration === sheet.speech_states[0].name ? declaration : null,
        currentCharacter: context.characterKey,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([MAX_CONTEXT, EMMA_CONTEXT])("continues $characterKey batch replies when speech settings are unavailable", async (characterContext) => {
    vi.mocked(fetchCharacterSpeechRuntime).mockRejectedValueOnce(new Error("Speech profile unavailable"));
    const result = await processPRD4Turn({ sessionId: "session-speech-error", characterContext,
      conversationHistory: [], userMessage: "Bonjour", userRole: null, timeElapsedSeconds: 0,
      diagnosticTraceEnabled: true, gmSpeechState: "Bloqué" });
    expect(result.maxResponse).toBe("Je vous écoute.");
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][0]).toMatchObject({ rugosite: 0, speechStateHistory: [], speechStateDirective: null });
    await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0]).toMatchObject({ currentCharacter: characterContext.characterKey, rugosite: 0, speechSettingsVersion: undefined });
    expect(vi.mocked(enqueueConversationTurnTrace).mock.calls[0][0].memory).toMatchObject({ speechRuntimeStatus: "unavailable", rugosite: 0, speechSettingsVersion: undefined });
  });

  it.each([MAX_CONTEXT, EMMA_CONTEXT])("streams $characterKey after the 600ms speech deadline without using late settings", async (characterContext) => {
    vi.useFakeTimers();
    let resolveRuntime: ((value: Awaited<ReturnType<typeof fetchCharacterSpeechRuntime>>) => void) | undefined;
    vi.mocked(fetchCharacterSpeechRuntime).mockImplementationOnce(() => new Promise(resolve => { resolveRuntime = resolve; }));
    const events: string[] = [];
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
      opts?.onSpeechToken?.('{"goal":"Écouter","points":[]}\n<speech>\nJe vous écoute. ');
      return { response: opts?.finishSpeech?.() ?? "", systemPrompt: "system" };
    });
    const pending = streamPRD4Turn({ sessionId: "session-speech-slow", characterContext,
      conversationHistory: [], userMessage: "Bonjour", userRole: null, timeElapsedSeconds: 0,
      diagnosticTraceEnabled: true }, event => events.push(event.type), Promise.resolve("Je vous écoute."));
    await vi.advanceTimersByTimeAsync(SUMMARY_FETCH_DEADLINE_MS - 1);
    expect(simulateMaxResponse).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(events).toEqual(["intent", "segment", "complete"]);
    expect(result.maxResponse).toBe("Je vous écoute.");
    resolveRuntime?.({ rugosite: 3, settingsVersion: "late", environmentId: "sandbox-ulrich", recentStates: ["Bloqué"] });
    await result.postTurnPromise;
    expect(result.speechPerformanceContext?.rugosite).toBe(0);
    expect(vi.mocked(enqueueConversationTurnTrace).mock.calls[0][0].memory).toMatchObject({ speechRuntimeStatus: "timeout", speechSettingsVersion: undefined });
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0]).toMatchObject({ maxResponse: "Je vous écoute.", rugosite: 0, speechSettingsVersion: undefined });
  });

  it("preserves the authorized speech snapshot when available on the next turn", async () => {
    vi.mocked(fetchCharacterSpeechRuntime).mockRejectedValueOnce(new Error("denied"));
    const input = { sessionId: "session-speech-retry", conversationHistory: [], userMessage: "Bonjour", userRole: null, timeElapsedSeconds: 0 };
    await processPRD4Turn(input);
    vi.mocked(fetchCharacterSpeechRuntime).mockResolvedValueOnce({ rugosite: 3, settingsVersion: "saved-v3", environmentId: "sandbox-ulrich", recentStates: ["Bloqué", null] });
    const result = await processPRD4Turn(input);
    await result.postTurnPromise;
    expect(vi.mocked(simulateMaxResponse).mock.calls[1][0]).toMatchObject({ rugosite: 3, speechStateHistory: ["Bloqué", null] });
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[1][0]).toMatchObject({ rugosite: 3, speechSettingsVersion: "saved-v3" });
    expect(fetchCharacterSpeechRuntime).toHaveBeenCalledTimes(2);
  });

  it.each(["vu", "pas_vu"])("transmits the initial %s answer identically to the GM and character without a published frame", async (hasSeenFilm) => {
    const result = await processPRD4Turn({
      sessionId: "session-film-choice",
      conversationHistory: [],
      userMessage: "Bonjour",
      userRole: null,
      hasSeenFilm,
      timeElapsedSeconds: 0,
    });
    await result.postTurnPromise;
    const characterFrame = vi.mocked(simulateMaxResponse).mock.calls[0]?.[0].experienceFrame;
    const gmFrame = vi.mocked(evaluatePostTurnPRD4).mock.calls[0]?.[0].experienceFrame;
    expect(characterFrame).toBeTruthy();
    expect(characterFrame).toContain(hasSeenFilm);
    expect(gmFrame).toBe(characterFrame);
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
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0][3]).toMatchObject({ characterKey: "max" });
    expect(fetchSessionSummary).toHaveBeenCalledWith("session-soak", "max");
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
      version: 2 as const,
      lastTurn: 5,
      interlocutor: { name: "Alice", role: "médecin", traits: [] },
      userFacts: [],
      maxDisclosures: [],
      commitments: [],
      openThreads: [],
      topics: [],
      relationship: {
        depth: "fissure" as const,
        trust: "ouverte" as const,
        emotionalState: null,
        tier: "trust" as const,
        topicOpenness: {},
        justification: "Relation déjà ouverte",
        evidence: ["honesty" as const],
        characterKey: "max",
        policyVersion: "unversioned",
        sourceTurn: 5,
      },
      lastExchange: "Alice a confronté Max.",
      characterItems: [],
      characterStates: {},
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
        characterId: MAX_CONTEXT.characterId,
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
    expect(maxInput.conversationMemory).toMatchObject({ ...structuredMemory, version: 4 });
    expect(maxInput.conversationHistory).toEqual(history.slice(-6));
    expect(maxInput.ragCandidates).toHaveLength(6);
    await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0].conversationMemoryBefore)
      .toMatchObject({ ...structuredMemory, version: 4 });
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

  it("préserve le tour global sans transmettre le résumé ni la mémoire privée de Max à Emma", async () => {
    vi.mocked(getGameplaySettings).mockReturnValue({
      TIMEOUT_SECONDS: 930,
      RAG_TOP_K: 3,
      RAG_RERANK_ENABLED: true,
      RAG_RETRIEVE_K: 15,
      RAG_SUMMARY_EVERY_N_TURNS: 4,
      MAX_PROMPT_VARIANT: "optimized_v3",
    } as ReturnType<typeof getGameplaySettings>);
    vi.mocked(fetchSessionSummary).mockImplementation(async (_sessionId, character) => {
      if (character === "emma") return null;
      return {
        session_id: "session-handoff",
        character_key: "max",
        summary: "- L'utilisateur cherche Ava.",
        last_turn: 5,
        updated_at: new Date().toISOString(),
      };
    });
    vi.mocked(fetchConversationMemory).mockResolvedValue({
      version: 2,
      lastTurn: 5,
      interlocutor: { name: "Alice", role: "médecin", traits: [] },
      userFacts: [{ id: "legacy-secret", text: "Secret confié à Max", sourceTurn: 3 }],
      maxDisclosures: [],
      commitments: [],
      openThreads: [],
      topics: [],
      relationship: {
        depth: "fissure",
        trust: "ouverte",
        emotionalState: null,
        tier: "trust",
        topicOpenness: {},
        justification: "Relation privée avec Max",
        evidence: ["honesty"],
        characterKey: "max",
        policyVersion: "unversioned",
        sourceTurn: 5,
      },
      lastExchange: "Échange privé avec Max",
      characterItems: [
        { id: "secret", text: "Secret confié à Max", sourceTurn: 3, sourceCharacter: "max", visibility: "private", visibleTo: ["max"], provenance: "user" },
        { id: "shared-role", text: "Alice est médecin", sourceTurn: 1, sourceCharacter: "max", visibility: "shared", visibleTo: ["max", "emma"], provenance: "user" },
      ],
    });
    const emmaHistory: ConversationMessage[] = [
      { role: "emma", content: "Bonjour, Max m'a demandé de prendre le relais.", timestamp: 1 },
      { role: "user", content: "Merci Emma.", timestamp: 2 },
    ];

    const result = await processPRD4Turn({
      sessionId: "session-handoff",
      conversationHistory: emmaHistory,
      userMessage: "Que savez-vous de la situation ?",
      userRole: null,
      characterContext: EMMA_CONTEXT,
      turnIndex: 6,
      timeElapsedSeconds: 400,
    });
    const emmaInput = vi.mocked(simulateMaxResponse).mock.calls[0][0];

    expect(queryRAGDetailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      undefined,
      expect.objectContaining({ characterId: EMMA_CONTEXT.characterId }),
    );
    expect(emmaInput.temporalContext?.turnIndex).toBe(6);
    expect(emmaInput.conversationHistory).toEqual(emmaHistory);
    expect(fetchSessionSummary).toHaveBeenCalledWith("session-handoff", "emma");
    expect(emmaInput.sessionSummary).toBeUndefined();
    expect(emmaInput.conversationMemory?.userFacts).toEqual([]);
    expect(emmaInput.conversationMemory?.interlocutor).toMatchObject({ name: "Alice", role: "médecin" });
    expect(emmaInput.conversationMemory?.lastExchange).toBeNull();
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0]?.[1].some((message) => message.content.includes("Secret confié à Max"))).toBeFalsy();
    expect(vi.mocked(summarizeSessionAsync).mock.calls[0]?.[3]).toMatchObject({ characterKey: "emma" });
    await result.postTurnPromise;
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0]).toMatchObject({
      turnIndex: 6,
      currentCharacter: "emma",
    });
  });

  it.each([
    "Non, je suis Max, ton compagnon. On est rentrés de la montagne hier.",
    "Ah, salut Emma. C'est Max. Ça va ?",
  ])("bloque l'inversion des captures avant diffusion et sans second appel LLM", async (unsafeResponse) => {
    vi.mocked(simulateMaxResponse).mockResolvedValue({ response: unsafeResponse, systemPrompt: "system" });
    const result = await processPRD4Turn({
      sessionId: "session-emma",
      conversationHistory: [],
      userMessage: "Qui es-tu ?",
      userRole: null,
      characterContext: EMMA_CONTEXT,
      turnIndex: 1,
      timeElapsedSeconds: 10,
    });

    expect(result.maxResponse).toBe("C’est bien Emma. Reprenons.");
    expect(simulateMaxResponse).toHaveBeenCalledTimes(1);
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0].maxResponse).toBe(result.maxResponse);
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
      character_key: "max",
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

  it("retries the exact recognized text before asking the player to repeat", async () => {
    vi.mocked(simulateMaxResponse).mockRejectedValueOnce(new Error('LLM error: 503'));
    const text = 'Emma m’a passé votre appel, je cherche Ava.';
    const result = await processPRD4Turn({ sessionId: 'session-soak', conversationHistory: [],
      userMessage: text, userRole: null, timeElapsedSeconds: 60 });
    expect(simulateMaxResponse).toHaveBeenCalledTimes(2);
    expect(vi.mocked(simulateMaxResponse).mock.calls.map(([input]) => input.userMessage)).toEqual([text, text]);
    expect(result.maxResponse).toBe('Je vous écoute.');
    await Promise.all([result.labelPromise, result.postTurnPromise]);
  });

  it("varies technical recovery by character without inventing comprehension", async () => {
    vi.mocked(simulateMaxResponse).mockRejectedValue(new Error('LLM error: 503'));
    const input = { sessionId: 'session-soak', conversationHistory: [], userMessage: 'Une confidence privée.',
      userRole: null, timeElapsedSeconds: 60 };
    const max = await processPRD4Turn(input);
    const next = await processPRD4Turn({ ...input,
      conversationHistory: [{ role: 'max', content: max.maxResponse, timestamp: 1 }] });
    const emma = await processPRD4Turn({ ...input, characterContext: EMMA_CONTEXT });
    expect(next.maxResponse).not.toBe(max.maxResponse);
    expect(emma.maxResponse).not.toBe(max.maxResponse);
    for (const result of [max, next, emma]) {
      expect(result.maxResponse).not.toMatch(/ligne accroche|Une confidence privée/);
      await Promise.all([result.labelPromise, result.postTurnPromise]);
    }
  });

  it.each(['missing header', 'incomplete sentence'])('recovers %s with the same text and no private intent replay', async failure => {
    const text = 'Que savez-vous de la disparition ?';
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
      opts?.onSpeechToken?.(failure === 'missing header' ? 'PRIVATE_MALFORMED_HEADER' : '{"goal":"PRIVATE_INTENT","points":[]}\n<speech>\nUne phrase sans sa fin');
      opts?.finishSpeech?.();
      return { response: '', systemPrompt: 'system' };
    }).mockResolvedValueOnce({ response: 'Je préfère prendre mon temps.', systemPrompt: 'same character' });
    const events: Array<{ type: string; text?: string }> = [];
    const result = await streamPRD4Turn({ sessionId: 'session-soak', conversationHistory: [],
      userMessage: text, userRole: null, timeElapsedSeconds: 60, characterContext: MAX_CONTEXT },
    event => events.push(event), Promise.resolve('Je préfère prendre mon temps.'));
    expect(vi.mocked(simulateMaxResponse).mock.calls.map(([input]) => input.userMessage)).toEqual([text, text]);
    expect(vi.mocked(simulateMaxResponse).mock.calls[1][1]?.onSpeechToken).toBeUndefined();
    expect(events.filter(event => event.type === 'segment').map(event => event.text)).toEqual(['Je préfère prendre mon temps.']);
    expect(events.some(event => event.type === 'reset')).toBe(true);
    await Promise.all([result.labelPromise, result.postTurnPromise]);
  });

  it('never retries after a safe phrase has already been submitted', async () => {
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
      opts?.onSpeechToken?.('{"goal":"Écouter","points":[]}\n<speech>\nBonjour. ');
      throw new Error('LLM response incomplete (length)');
    });
    await expect(streamPRD4Turn({ sessionId: 'session-soak', conversationHistory: [], userMessage: 'Bonjour',
      userRole: null, timeElapsedSeconds: 60, characterContext: MAX_CONTEXT }, () => {}, Promise.resolve('Bonjour.')))
      .rejects.toThrow('incomplete');
    expect(simulateMaxResponse).toHaveBeenCalledOnce();
  });

  it.each([MAX_CONTEXT, EMMA_CONTEXT])('finishes T2 for $characterKey without a second generation after submitted audio', async characterContext => {
    const speech = 'Je vous écoute.';
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async (_input, opts) => {
      opts?.onSpeechToken?.('{"goal":"PRIVATE","points":[]}\n<speech>\n' + speech + '\n');
      opts?.onSpeechToken?.('</speech');
      return { response: opts?.finishSpeech?.(true) ?? '', systemPrompt: 'system' };
    });
    const segments: string[] = [];
    const result = await streamPRD4Turn({ sessionId: 'session-soak', characterContext, conversationHistory: [],
      userMessage: 'Je voudrais comprendre.', userRole: null, timeElapsedSeconds: 60 }, event => {
      if (event.type === 'segment') segments.push(event.text);
    }, Promise.resolve(speech));
    expect(result.maxResponse).toBe(speech);
    expect(segments).toEqual([speech]);
    expect(simulateMaxResponse).toHaveBeenCalledOnce();
    await result.postTurnPromise;
    expect(evaluatePostTurnPRD4).toHaveBeenCalledOnce();
  });

  it('reports the recovered speech if the consumer fails after recovery', async () => {
    vi.mocked(simulateMaxResponse).mockRejectedValueOnce(new Error('Missing response intent'))
      .mockResolvedValueOnce({ response: 'Je vous écoute.', systemPrompt: 'system' });
    const failures: Array<{ generated: string; intent: unknown }> = [];
    await expect(streamPRD4Turn({ sessionId: 'session-soak', conversationHistory: [], userMessage: 'Bonjour',
      userRole: null, timeElapsedSeconds: 60, characterContext: MAX_CONTEXT }, event => {
      if (event.type === 'complete') throw new Error('consumer failed');
      if (event.type === 'failed') failures.push(event);
    }, Promise.resolve('Je vous écoute.'))).rejects.toThrow('consumer failed');
    expect(failures).toEqual([expect.objectContaining({ generated: 'Je vous écoute.', intent: null })]);
  });

  it('shares transfer provenance identically with character and GM without foreign confidences', async () => {
    const history: ConversationMessage[] = [{ role: 'max', content: 'Allô.', timestamp: 1, spokenWith: 'max',
      callTransfer: { from: 'emma', returning: false } }, ...makeConversation(12)];
    const result = await processPRD4Turn({ sessionId: 'session-soak', conversationHistory: history,
      userMessage: 'Bonjour', userRole: null, timeElapsedSeconds: 60 });
    await Promise.all([result.labelPromise, result.postTurnPromise]);
    const characterFrame = vi.mocked(simulateMaxResponse).mock.calls[0][0].experienceFrame;
    expect(characterFrame).toContain('Emma');
    expect(characterFrame).toContain('sans connaître ses mots');
    expect(vi.mocked(evaluatePostTurnPRD4).mock.calls[0][0].experienceFrame).toBe(characterFrame);
  });

  it('bounds stalled generation and retries without cancelling the parent turn', async () => {
    vi.useFakeTimers();
    const parent = cancellableTurn();
    vi.mocked(simulateMaxResponse).mockImplementationOnce(() => new Promise(() => {}));
    const pending = processPRD4Turn({ sessionId: 'session-soak', conversationHistory: [], userMessage: 'Ma parole est transcrite.',
      userRole: null, timeElapsedSeconds: 60, signal: parent.signal });
    await vi.advanceTimersByTimeAsync(MAX_LLM_RESPONSE_DEADLINE_MS + 1);
    expect(simulateMaxResponse).toHaveBeenCalledTimes(2);
    const result = await pending;
    expect(result.maxResponse).toBe('Je vous écoute.');
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(parent.signal.aborted).toBe(false);
  });

  it('never retries a cancelled turn', async () => {
    const parent = cancellableTurn();
    vi.mocked(simulateMaxResponse).mockImplementationOnce(async () => { parent.abort(); throw new DOMException('Cancelled', 'AbortError'); });
    await expect(processPRD4Turn({ sessionId: 'session-soak', conversationHistory: [], userMessage: 'Bonjour',
      userRole: null, timeElapsedSeconds: 60, signal: parent.signal })).rejects.toThrow();
    expect(simulateMaxResponse).toHaveBeenCalledOnce();
  });

  it("falls back after the configured stalled-RAG deadline and still answers", async () => {
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
    await vi.advanceTimersByTimeAsync(RAG_DEGRADED_MODE_DEADLINE_MS + 1);
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
    await vi.advanceTimersByTimeAsync(RAG_DEGRADED_MODE_DEADLINE_MS + 3_501);
    const result = await turnPromise;

    expect(result.maxResponse).toBe("Réponse complète de Max.");
    expect(vi.mocked(simulateMaxResponse).mock.calls[0][1]?.timeoutMs).toBe(
      Math.min(MAX_LLM_RESPONSE_DEADLINE_MS, TURN_RESPONSE_DEADLINE_MS - RAG_DEGRADED_MODE_DEADLINE_MS - TURN_RESPONSE_FINALIZATION_RESERVE_MS),
    );
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
        character_id: MAX_CONTEXT.characterId,
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
        characterId: MAX_CONTEXT.characterId,
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
        baseSource: { kind: "database", characterId: MAX_CONTEXT.characterId, canonicalName: "Max", updatedAt: "2026-07-21" },
        characterPrompt: { characterId: MAX_CONTEXT.characterId, canonicalName: "Max", updatedAt: "2026-07-21", renderedSections: "FICHE" },
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
    expect(trace.identity).toMatchObject({
      sessionId: "session-traced",
      turnId: "turn-stable-1",
      turnIndex: 1,
      characterKey: "max",
      characterId: MAX_CONTEXT.characterId,
      notionPageId: MAX_CONTEXT.notionPageId,
      environmentId: MAX_CONTEXT.environmentId,
      promptUpdatedAt: MAX_CONTEXT.promptUpdatedAt,
    });
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
    expect(trace.gm.labelPass).toMatchObject({ status: "not_executed", reason: "consolidated_into_post_turn" });
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
    await result.postTurnPromise;
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
