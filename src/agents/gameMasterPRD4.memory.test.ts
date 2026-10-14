import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLMWithUsage: vi.fn(),
  LLMProxyRequestError: class extends Error {},
}));
vi.mock("@/services/settingsService", () => ({
  getLLMSettings: () => ({ LLM_MODEL_GM: "openai/gpt-4.1-mini", LLM_MAX_TOKENS_GM: 800 }),
}));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn() }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { persistPostTurnMemory } from "@/services/sessionConversationMemory";
import { evaluatePostTurnPRD4 } from "./gameMasterPRD4";
import { createEmptyConversationMemory, mergeConversationMemory } from "@/services/conversationMemoryV1";
import type { CharacterRelationshipPolicy } from "@/types";
import { TimeoutError } from "@/services/asyncUtils";

const relationshipPolicy: CharacterRelationshipPolicy = {
  schemaVersion: 1,
  characterKey: "max",
  version: "policy-v1",
  callDrive: "Comprendre pourquoi cette personne appelle.",
  openingSignals: ["franchise"],
  closingSignals: ["insistance"],
  sensitiveTopics: [],
  resistanceStyle: "Répondre partiellement.",
  initiativeStyle: "Reprendre un fil précis.",
  source: "notion",
};

describe("Game Master PRD4 — memory_delta", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["timeout", "parent-abort"])("keeps a failed %s GM separate from delivered speech and permissions", async kind => {
    const parent = new AbortController();
    const failure = kind === "timeout" ? new TimeoutError("llm", 12000) : new DOMException("superseded", "AbortError");
    if (kind === "parent-abort") parent.abort("superseded-turn");
    vi.mocked(callLLMWithUsage).mockRejectedValueOnce(failure);
    const before = createEmptyConversationMemory();
    vi.mocked(persistPostTurnMemory).mockResolvedValueOnce(before);
    const result = await evaluatePostTurnPRD4({ sessionId: "p1-session", conversationHistory: [],
      userMessage: "Attends", maxResponse: "Je t'écoute.", currentCharacter: "max", userRole: null,
      turnIndex: 4, timeElapsedSeconds: 90, sessionDurationSeconds: 900, minimumClosureSeconds: 600,
      conversationMemoryBefore: before, relationshipPolicy, signal: parent.signal });
    expect(result.execution_status).toBe("failed");
    expect(result.execution_reason).toBe(kind === "timeout" ? "client_timeout" : "parent_aborted");
    expect(result.memory_delta).toBeNull();
    expect(result.memory_after).toEqual(before);
    expect(result.action).toEqual({ type: "none" });
    expect(result.player_switch_request).toBeNull();
    expect(result.trigger_video_id).toBeNull();
    expect(result.end_recommended).toBe(false);
    expect(persistPostTurnMemory).toHaveBeenCalledWith("p1-session", expect.objectContaining({ execution_status: "failed" }), null, 4, "max", parent.signal);
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][1]).toMatchObject({ timeoutMs: 12000, signal: parent.signal });
  });

  it("publie un span GM disponible en échec sans le confondre avec le tour vocal", async () => {
    vi.mocked(callLLMWithUsage).mockRejectedValueOnce(new TimeoutError("llm", 12000));
    vi.mocked(persistPostTurnMemory).mockResolvedValueOnce(createEmptyConversationMemory());
    let observation: { spans: Array<{ name: string; status: string }> } | null = null;
    const result = await evaluatePostTurnPRD4({
      sessionId: "session-observation",
      conversationHistory: [], userMessage: "Bonjour", maxResponse: "Je t'écoute.",
      currentCharacter: "max", userRole: null, turnIndex: 2,
      timeElapsedSeconds: 20, sessionDurationSeconds: 900, minimumClosureSeconds: 600,
      onGmObserved: (_service, spans) => { observation = spans; },
    });
    expect(result.execution_reason).toBe("client_timeout");
    expect(observation?.spans).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "gm_generation", status: "failed" }),
      expect.objectContaining({ name: "gm_persistence", status: "ok" }),
      expect.objectContaining({ name: "gm_available", status: "failed" }),
    ]));
  });

  it("produit et persiste le delta dans le même appel LLM", async () => {
    const delta = {
      interlocutor: { name: "Alice", role: "médecin", traits: ["elle confronte Max"] },
      userFacts: ["Alice a une sœur"],
      maxDisclosures: ["Max reconnaît avoir contrôlé Emma"],
      commitments: [],
      openThreads: ["Ce que Max dira à Emma"],
      resolvedThreadIds: [],
      topics: ["contrôle"],
      relationship: { depth: "fissure", trust: "ouverte", emotionalState: "tendue" },
      lastExchange: "Alice confronte Max à son besoin de contrôle.",
    };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({
      content: JSON.stringify({
        labels: { themes: ["famille"], topics: ["emma"], intentions: ["défi"] },
        engagement_delta: 1,
        confusion_detected: false,
        role_usage_quality: "high",
        topics_covered: ["emma"],
        transition_recommended: false,
        cinematic_hint: null,
        next_turn_guidance: "Répondre par un fait concret.",
        end_recommended: false,
        moderation_flag: false,
        notes: "",
        trigger_video_id: null,
        action: { type: "none" },
        player_switch_request: null,
        memory_delta: delta,
      }),
      model: "openai/gpt-4.1-mini",
      latencyMs: 10,
      usage: null,
      generationId: null,
      diagnosticTrace: null,
    } as never);
    const memoryAfter = mergeConversationMemory(createEmptyConversationMemory(), delta as never, 1, "max");
    vi.mocked(persistPostTurnMemory).mockResolvedValue(memoryAfter);

    const result = await evaluatePostTurnPRD4({
      sessionId: "session-1",
      conversationHistory: [],
      userMessage: "Je m'appelle Alice, je suis médecin. Tu contrôles Emma.",
      maxResponse: "Oui. J'ai décidé à sa place.",
      userRole: null,
      currentCharacter: "max",
      turnIndex: 1,
      timeElapsedSeconds: 30,
      sessionDurationSeconds: 900,
      minimumClosureSeconds: 600,
    });

    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(result.memory_delta).toMatchObject({ interlocutor: { name: "Alice", role: "médecin" } });
    expect(result.memory_after).toEqual(memoryAfter);
    expect(persistPostTurnMemory).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ turn_index: 1 }),
      expect.objectContaining({ topics: ["contrôle"] }),
      1,
      "max",
    );
  });

  it("transmet les métadonnées du tour courant et accepte une progression valide", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({
      content: JSON.stringify({
        labels: { themes: [], topics: [], intentions: ["empathie"] },
        engagement_delta: 1,
        confusion_detected: false,
        role_usage_quality: "medium",
        topics_covered: [],
        transition_recommended: false,
        cinematic_hint: null,
        next_turn_guidance: "Garder cette ouverture mesurée.",
        end_recommended: false,
        moderation_flag: false,
        notes: "",
        trigger_video_id: null,
        action: { type: "none" },
        player_switch_request: null,
        memory_delta: {
          relationship: {
            tier: "link",
            topicOpenness: {},
            justification: "L'interlocuteur a répondu avec franchise.",
            evidence: ["honesty"],
            sourceTurn: 4,
            characterKey: "max",
            policyVersion: "policy-v1",
          },
        },
      }),
      model: "openai/gpt-4.1-mini",
      latencyMs: 10,
      usage: null,
      generationId: null,
      diagnosticTrace: null,
    } as never);

    const result = await evaluatePostTurnPRD4({
      sessionId: null,
      conversationHistory: [],
      conversationMemoryBefore: createEmptyConversationMemory(),
      userMessage: "Je vais être franc avec toi.",
      maxResponse: "Je t'écoute.",
      userRole: null,
      currentCharacter: "max",
      relationshipPolicy,
      turnIndex: 4,
      timeElapsedSeconds: 90,
      sessionDurationSeconds: 900,
      minimumClosureSeconds: 600,
      diagnosticTrace: true,
    });

    expect(result.relationship_transition).toMatchObject({ accepted: true, next: { tier: "link", sourceTurn: 4 } });
    expect(result.diagnostic?.messages[1].content).toContain(
      '"sourceTurn":4,"characterKey":"max","policyVersion":"policy-v1"',
    );
  });

  it("ne persiste aucun delta lorsqu'une proposition relationnelle est rejetée", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({
      content: JSON.stringify({
        labels: { themes: [], topics: [], intentions: [] },
        engagement_delta: 0,
        confusion_detected: false,
        role_usage_quality: "medium",
        topics_covered: [],
        transition_recommended: false,
        cinematic_hint: null,
        next_turn_guidance: "",
        end_recommended: false,
        moderation_flag: false,
        notes: "",
        trigger_video_id: null,
        action: { type: "none" },
        player_switch_request: null,
        memory_delta: {
          userFacts: ["fait qui ne doit pas passer"],
          relationship: { tier: "trust", topicOpenness: {}, justification: "hors tour", evidence: ["honesty"], sourceTurn: 99, characterKey: "max", policyVersion: "policy-v1" },
        },
      }),
      model: "openai/gpt-4.1-mini", latencyMs: 10, usage: null, generationId: null, diagnosticTrace: null,
    } as never);
    vi.mocked(persistPostTurnMemory).mockResolvedValueOnce(createEmptyConversationMemory());
    const result = await evaluatePostTurnPRD4({
      sessionId: "session-invalid-relationship", conversationHistory: [], userMessage: "Bonjour", maxResponse: "Je t'écoute.",
      currentCharacter: "max", userRole: null, turnIndex: 4, timeElapsedSeconds: 20,
      sessionDurationSeconds: 900, minimumClosureSeconds: 600, relationshipPolicy,
    });
    expect(result.execution_status).toBe("invalid");
    expect(result.execution_reason).toBe("relationship_invalid");
    expect(result.memory_delta).toBeNull();
    expect(persistPostTurnMemory).toHaveBeenCalledWith("session-invalid-relationship", expect.anything(), null, 4, "max");
  });

});
