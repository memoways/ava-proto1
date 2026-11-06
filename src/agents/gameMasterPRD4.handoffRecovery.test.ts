import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { evaluatePostTurnPRD4 } from "./gameMasterPRD4";
import { validateCharacterHandoff } from "@/services/characterHandoff";
import { candidateEvidence } from "@/services/handoffCoordinator";

/** Session 5e8c0d40 / bb1e433e (3-4 novembre 2026): the GM wrote « Max accepte » but its proof was rejected. */
const gmJson = {
  engagement_delta: 1, confusion_detected: false, role_usage_quality: "high", topics_covered: ["emma"],
  transition_recommended: true, cinematic_hint: null, next_turn_guidance: "Max transmet l'appel à Emma.",
  end_recommended: false, moderation_flag: false, notes: "Le joueur demande à parler à Emma, Max accepte.",
  trigger_video_id: null, labels: { themes: [], topics: [], intentions: [] }, memory_delta: null,
  action: { type: "none" }, player_switch_request: null,
};
const llm = { model: "existing-gm", usage: null, generationId: null, latencyMs: 1, diagnosticTrace: null };
const fragments = "Oui Max, en fait, je serais très curieux de pouvoir échanger avec Emma sur comment elle, elle se sent,"
  + " est-ce que tu pourrais me la passer s'il te plaît";
const reply = "Je peux te la passer, oui. Emma est dans la cuisine.";
const input = {
  sessionId: null, conversationHistory: [], userMessage: "s'il te plaît", maxResponse: reply, userRole: null,
  currentCharacter: "max" as const, turnIndex: 7, timeElapsedSeconds: 300, sessionDurationSeconds: 900,
  minimumClosureSeconds: 600, orchestrationVersionId: "v1",
  handoffContext: { turnId: "s:7", openRequest: null, delivery: null, candidateText: reply, userText: fragments },
};

describe("GM handoff proof recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["an invalid consent reference", { schemaVersion: 2, requestSource: "current_user", targetCharacter: "emma",
      stance: "accept", refusal: false, consentRef: "currentUserMessage" }],
    ["an omitted proof", null],
  ])("turns %s into a validated transfer when Max accepted", async (_label, assessment) => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...gmJson, handoff_assessment: assessment }), ...llm });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.action).toMatchObject({ type: "handoff", targetCharacter: "emma" });
    expect(result.handoff_assessment).toMatchObject({ targetCharacter: "emma", origin: { evidence: fragments } });
    expect(result.validation_issues).toContainEqual(expect.objectContaining({ code: "handoff_proof_recovered" }));
    const [messages] = vi.mocked(callLLMWithUsage).mock.calls[0];
    expect(messages.at(-1)!.content).toContain(fragments);
    expect(validateCharacterHandoff({ currentCharacter: "max", turnId: "s:7", turnIndex: 7, orchestrationVersionId: "v1",
      userText: fragments, delivery: candidateEvidence(reply, "s:7", 7, "max"), evaluation: result }).authorized).toBe(true);
  });

  it("keeps the GM deferral: no transfer is invented", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...gmJson, handoff_assessment: {
      schemaVersion: 2, requestSource: "current_user", targetCharacter: "emma", stance: "defer", refusal: false,
      consentRef: "speech_0" } }), ...llm });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.action).toEqual({ type: "none" });
    expect(result.validation_issues).not.toContainEqual(expect.objectContaining({ code: "handoff_proof_recovered" }));
  });

  it("does not recover a proof the player never asked for", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...gmJson, handoff_assessment: null }), ...llm });
    const result = await evaluatePostTurnPRD4({ ...input, handoffContext: { ...input.handoffContext, userText: "Comment elle va ?" } });
    expect(result.handoff_assessment).toBeNull();
    expect(result.action).toEqual({ type: "none" });
  });
});
