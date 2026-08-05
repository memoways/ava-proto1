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

describe("Game Master PRD4 — memory_delta", () => {
  beforeEach(() => vi.clearAllMocks());

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
        memory_delta: delta,
      }),
      model: "openai/gpt-4.1-mini",
      latencyMs: 10,
      usage: null,
      generationId: null,
      diagnosticTrace: null,
    } as never);
    const memoryAfter = mergeConversationMemory(createEmptyConversationMemory(), delta as never, 1);
    vi.mocked(persistPostTurnMemory).mockResolvedValue(memoryAfter);

    const result = await evaluatePostTurnPRD4({
      sessionId: "session-1",
      conversationHistory: [],
      userMessage: "Je m'appelle Alice, je suis médecin. Tu contrôles Emma.",
      maxResponse: "Oui. J'ai décidé à sa place.",
      userRole: null,
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
    );
  });
});
