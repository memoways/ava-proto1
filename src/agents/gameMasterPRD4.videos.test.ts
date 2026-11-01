import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn() }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { evaluatePostTurnPRD4 } from "./gameMasterPRD4";

const row = (id: string, extra: Partial<VideoTriggerRow>): VideoTriggerRow => ({
  id, notion_id: null, title: id, type: "mid_conversation", themes: [], video_url: "https://video", context: null,
  description: null, priority: null, transition_style: null, post_video_context: null, updated_at: null, ...extra,
});

const catalog = [
  row("extract-max", { nature: "extract", characters: ["max"] }),
  row("transformed-all", { nature: "transformed", characters: ["all"] }),
  row("transformed-emma", { nature: "transformed", characters: ["emma"] }),
  row("intro", { type: "intro" }),
];

function gmReply(videoId: string) {
  return {
    content: JSON.stringify({
      labels: { themes: [], topics: [], intentions: [] }, engagement_delta: 0, confusion_detected: false,
      role_usage_quality: "high", topics_covered: [], transition_recommended: false, cinematic_hint: null,
      next_speech_state: null, next_turn_guidance: "Continuer.", end_recommended: false, moderation_flag: false,
      notes: "", trigger_video_id: videoId, action: { type: "cinematic", videoId, reason: "pertinent", confidence: 0.8 },
      player_switch_request: null, memory_delta: null,
    }),
    model: "existing-gm", latencyMs: 1, usage: null, generationId: null, diagnosticTrace: null,
  } as never;
}

const baseInput = {
  sessionId: null, conversationHistory: [], userMessage: "Montre-moi.", maxResponse: "Regarde.", userRole: null,
  currentCharacter: "max" as const, turnIndex: 5, timeElapsedSeconds: 120, sessionDurationSeconds: 900,
  minimumClosureSeconds: 600, persist: false,
};

describe("Game Master PRD4 — eligible video candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoTriggersCached).mockResolvedValue(catalog);
  });

  it("lists only eligible videos for the seen path and drops an ineligible trigger", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("extract-max"));
    const result = await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "seen" });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("id=transformed-all");
    expect(prompt).not.toContain("id=extract-max");
    expect(prompt).not.toContain("id=transformed-emma");
    expect(prompt).not.toContain("id=intro");
    expect(result.trigger_video_id).toBeNull();
  });

  it("offers extracts first on the unseen path", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("extract-max"));
    const result = await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "unseen", minExtractsBeforeCinematic: 2 });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("id=extract-max");
    expect(prompt).not.toContain("id=transformed-all");
    expect(result.trigger_video_id).toBe("extract-max");
  });
});
