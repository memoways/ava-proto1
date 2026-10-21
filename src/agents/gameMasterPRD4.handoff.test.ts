import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { persistPostTurnMemory } from "@/services/sessionConversationMemory";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "./gameMasterPRD4";
import { CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS, buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";
import { DEFAULT_DIRECTOR_CONFIG } from "@/services/experienceOrchestration";
import { validAssessment, validInput } from "@/services/characterHandoff.fixtures";
import { validateCharacterHandoff } from "@/services/characterHandoff";

const historicalJson = {
  engagement_delta: 1, confusion_detected: false, role_usage_quality: "high", topics_covered: ["max"],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: "Continue.", end_recommended: false,
  moderation_flag: false, notes: "historique", trigger_video_id: null,
  labels: { themes: [], topics: ["max"], intentions: [] }, memory_delta: null,
  action: { type: "handoff", targetCharacter: "max", reason: "accord", proposalGuidance: "Appeler Max" },
  player_switch_request: { targetCharacter: "max", stance: "accept" },
};
const llmMetadata = { model: "existing-gm", usage: null, generationId: null, latencyMs: 1, diagnosticTrace: null };
const input = {
  sessionId: null, conversationHistory: [], userMessage: validInput().userText, maxResponse: validInput().delivery!.generated,
  userRole: null, currentCharacter: "emma" as const, turnIndex: 11, timeElapsedSeconds: 100,
  sessionDurationSeconds: 900, minimumClosureSeconds: 600, orchestrationVersionId: "v6",
};

describe("GM optional structured handoff compatibility", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([undefined, null, {}, { schemaVersion: 2 }, { ...validAssessment(), consent: { stance: "accept", evidence: "" } }])(
    "keeps historical consumers usable when optional assessment is %j", async assessment => {
      vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
        ...(assessment === undefined ? {} : { handoff_assessment: assessment }) }), ...llmMetadata });
      const result = await evaluatePostTurnPRD4(input);
      expect(result.execution_status).toBe("executed");
      expect(result).toMatchObject(historicalJson);
      expect(result.handoff_assessment).toBeNull();
      expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(false);
    },
  );
  it("cleans the additive contract without changing the prompt, budget or call count", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
      handoff_assessment: { ...validAssessment(), unknown: "discarded" } }), ...llmMetadata });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.handoff_assessment).toEqual(validAssessment());
    expect(result.player_switch_request).toEqual(historicalJson.player_switch_request);
    expect(result.action).toEqual(historicalJson.action);
    expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][0][0].content).toBe(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT);
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][1]).toMatchObject({ max_tokens: 950, timeoutMs: 12000 });
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).not.toContain("handoff_assessment");
    expect(buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, DEFAULT_DIRECTOR_CONFIG)).not.toContain("handoff_assessment");
  });
  it("neutralizes the assessment if persistence fails", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson, handoff_assessment: validAssessment() }), ...llmMetadata });
    vi.mocked(persistPostTurnMemory).mockRejectedValueOnce(new Error("write failed"));
    const result = await evaluatePostTurnPRD4({ ...input, sessionId: "session" });
    expect(result.execution_status).toBe("failed");
    expect(result.handoff_assessment).toBeNull();
  });
  it("neutralizes the assessment when another GM validation fails", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: "{}", ...llmMetadata });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.execution_status).toBe("invalid");
    expect(result.handoff_assessment).toBeNull();
  });
  it("prepares semantic instructions as an isolated artifact", () => {
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain('"refusalEvidence": null');
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("accept|object|defer");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("Aucun alias global Matt → Max");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("réplique complète");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("non entendu");
  });
});

describe('live same-call handoff context', () => {
  it('adds exact ownership, open request and delivered evidence while retaining one 950-token call', async () => {
    const fixture = validInput();
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
      handoff_assessment: validAssessment() }), ...llmMetadata });
    const result = await evaluatePostTurnPRD4({ ...input, handoffContext: { turnId: fixture.turnId,
      openRequest: null, delivery: fixture.delivery } });
    const calls = vi.mocked(callLLMWithUsage).mock.calls;
    const last = calls.at(-1)!;
    expect(last[0][0].content).toContain(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS);
    expect(last[0][1].content).toContain('"turnId":"session:11"');
    expect(last[0][1].content).toContain('"orchestrationVersionId":"v6"');
    expect(last[0][1].content).toContain(JSON.stringify(fixture.delivery!.delivered));
    expect(last[1]).toMatchObject({ max_tokens: 950, timeoutMs: 12000 });
    expect(validateCharacterHandoff({ ...fixture, evaluation: result }).authorized).toBe(true);
  });
});
