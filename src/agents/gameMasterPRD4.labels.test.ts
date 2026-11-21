import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { evaluatePostTurnPRD4, parseGmTurnLabels } from "./gameMasterPRD4";

describe("parseGmTurnLabels", () => {
  it("keeps the cap of 4 on themes, topics and intentions, and does not spend it on emotions or stakes", () => {
    const labels = parseGmTurnLabels({
      themes: ["famille", "secrets", "deuil", "violence", "mémoire"],
      topics: ["soeur", "enfance"],
      intentions: ["question", "doute"],
      emotions: ["angoisse", "peur"],
      stakes: ["proteger", "trahir"],
    });
    expect(labels.themes).toEqual(["famille", "secrets", "deuil", "violence"]);
    expect(labels.topics).toEqual([]);
    expect(labels.intentions).toEqual([]);
    expect(labels.emotions).toEqual(["angoisse", "peur"]);
    expect(labels.stakes).toEqual(["proteger", "trahir"]);
  });

  it("keeps a value that is not in the current list, after the same cleaning", () => {
    const labels = parseGmTurnLabels({
      themes: ["  Patricarcat "],
      topics: ["Ava"],
      intentions: [],
      emotions: ["Angoisse"],
      stakes: ["x".repeat(40), "dire la vérité"],
    });
    expect(labels.themes).toEqual(["patricarcat"]);
    expect(labels.topics).toEqual(["ava"]);
    expect(labels.intentions).toEqual([]);
    expect(labels.emotions).toEqual(["angoisse"]);
    expect(labels.stakes).toEqual(["dire la vérité"]);
  });

  it("still parses topics and intentions when the new lists are absent", () => {
    expect(parseGmTurnLabels({ themes: ["famille"], topics: ["couteau"], intentions: ["question"] })).toEqual({
      themes: ["famille"],
      topics: ["couteau"],
      intentions: ["question"],
      emotions: [],
      stakes: [],
    });
    expect(parseGmTurnLabels(null)).toEqual({ themes: [], topics: [], intentions: [], emotions: [], stakes: [] });
  });
});

describe("post-turn vocabulary block", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appends the current lists and keeps an out-of-list emotion", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({
      content: JSON.stringify({
        labels: { themes: ["famille"], topics: ["ava"], intentions: ["question"], emotions: ["angoisse"], stakes: ["protéger"] },
        engagement_delta: 0, confusion_detected: false, role_usage_quality: "high", topics_covered: ["ava"],
        transition_recommended: false, cinematic_hint: null, next_speech_state: null, next_turn_guidance: "Continuer.",
        end_recommended: false, moderation_flag: false, notes: "", trigger_video_id: null,
        action: { type: "none" }, player_switch_request: null, memory_delta: null,
      }),
      model: "existing-gm", latencyMs: 1, usage: null, generationId: null, diagnosticTrace: null,
    } as never);
    const result = await evaluatePostTurnPRD4({
      sessionId: null, conversationHistory: [], userMessage: "J'ai peur pour Ava.", maxResponse: "Je sais.",
      userRole: null, currentCharacter: "max", turnIndex: 2, timeElapsedSeconds: 30, sessionDurationSeconds: 900,
      minimumClosureSeconds: 600, persist: false,
      videoVocabulary: { themes: ["famille"], emotions: ["peur"], stakes: ["protéger"], on_screen: ["Max"] },
    });
    const system = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][0].content);
    expect(system).toContain("LISTE COURANTE DES VIDÉOS");
    expect(system).toContain("themes : famille");
    expect(system).toContain("emotions : peur");
    expect(result.labels.emotions).toEqual(["angoisse"]);
    expect(result.labels.topics).toEqual(["ava"]);
    expect(result.labels.stakes).toEqual(["protéger"]);
  });
});
