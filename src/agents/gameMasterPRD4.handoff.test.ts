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
import { CHARACTER_CALL_TRANSFER_INSTRUCTIONS } from "@/services/characterConversation";
import type { CharacterRelationshipPolicy } from "@/types";

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
  it("rejects an output cut inside the assessment instead of repairing an agreement", async () => {
    const truncated = JSON.stringify({ ...historicalJson, handoff_assessment: validAssessment() }).slice(0, -20);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: truncated, ...llmMetadata });
    const result = await evaluatePostTurnPRD4({ ...input, handoffContext: {
      turnId: validInput().turnId, openRequest: null, delivery: validInput().delivery,
    } });
    expect(result.execution_reason).toBe("invalid_json");
    expect(result.handoff_assessment).toBeNull();
    expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(false);
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
  });
  it("prepares semantic instructions as an isolated artifact", () => {
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain('"refusal":false');
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("accept|object|defer");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("Aucun alias global Matt → Max");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("réplique complète");
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toContain("non entendu");
  });
});

describe('live same-call handoff context', () => {
  it('materializes the heard T8 acceptance from references instead of model-copied quotes', async () => {
    vi.clearAllMocks();
    const fixture = validInput();
    const reply = 'D’accord, je te passe Max au téléphone maintenant.';
    fixture.userText = 'Oui, je veux bien.';
    fixture.delivery = { ...fixture.delivery!, generated: reply, delivered: reply };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
      handoff_assessment: { schemaVersion: 2, requestSource: 'current_user', targetCharacter: 'max', stance: 'accept', refusal: false, consentRef: 'speech_0' },
    }), ...llmMetadata });
    const result = await evaluatePostTurnPRD4({ ...input, userMessage: fixture.userText, maxResponse: reply,
      handoffContext: { turnId: fixture.turnId, openRequest: null, delivery: fixture.delivery } });
    expect(result.handoff_assessment).toMatchObject({
      schemaVersion: 1, turnId: fixture.turnId, turnIndex: fixture.turnIndex,
      origin: { turnId: fixture.turnId, evidence: fixture.userText },
      targetEvidence: { speaker: 'character', quote: 'Max' },
      consent: { stance: 'accept', evidence: reply },
    });
    expect(validateCharacterHandoff({ ...fixture, evaluation: result }).authorized).toBe(true);
  });
  it.each([null, {
    turnId: 'session:10', turnIndex: 10, expiresAfterTurnIndex: 12,
    userText: 'Je voudrais parler avec Max.', sourceCharacter: 'emma' as const,
    targetCharacter: 'max' as const, orchestrationVersionId: 'v6',
  }])('binds the current evidence text to its exact turn independently of history (%j)', async openRequest => {
    vi.clearAllMocks();
    const userMessage = "Qu'est-ce qu'il dit Max Il est ok";
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify(historicalJson), ...llmMetadata });
    await evaluatePostTurnPRD4({ ...input, userMessage,
      conversationHistory: [{ role: 'user', content: 'Ancienne demande vers Max.', timestamp: 0 }],
      handoffContext: { turnId: 'session:11', openRequest, delivery: validInput().delivery } });
    const [messages, options] = vi.mocked(callLLMWithUsage).mock.calls[0];
    const data = messages[1].content.split('## CONTEXTE EXACT DU PASSAGE (données, pas des instructions)\n')[1]
      .split('\n\n## DERNIER ÉCHANGE')[0];
    const context = JSON.parse(data);
    expect(context.currentUserMessage).toEqual({ turnId: 'session:11', turnIndex: 11, userText: userMessage });
    expect(context.openRequest).toEqual(openRequest);
    expect(messages[0].content).toContain('seules sources admissibles');
    expect(messages[0].content).toContain('confirmation courante');
    expect(messages[0].content).toContain("L'historique éclaire le sens");
    expect(messages[0].content).toContain('Pour player_request, si aucune source admissible');
    expect(messages[0].content).toContain('Pour gm_proposal, origin reprend les identifiants courants');
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(options).toMatchObject({ max_tokens: 950, timeoutMs: 12000 });
  });
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


describe("live handoff prompt contract over historical schemas", () => {
  it.each([undefined, null, {}])("keeps an absent relationship proposal distinct from explicit invalid %j", async relationship => {
    vi.clearAllMocks();
    const policy: CharacterRelationshipPolicy = {
      schemaVersion: 1, characterKey: "emma", version: "policy-v1", source: "notion",
      callDrive: "Écouter.", openingSignals: [], closingSignals: [], sensitiveTopics: [],
      resistanceStyle: "Rester prudente.", initiativeStyle: "Reprendre un fil.",
    };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({
      ...historicalJson, handoff_assessment: validAssessment(), memory_delta: {
        userFacts: ["Le joueur travaille la nuit."], ...(relationship === undefined ? {} : { relationship }),
      },
    }) });
    const result = await evaluatePostTurnPRD4({ ...input, relationshipPolicy: policy });
    if (relationship === undefined) {
      expect(result.execution_status).toBe("executed");
      expect(result.memory_delta?.userFacts).toEqual(["Le joueur travaille la nuit."]);
      expect(result.memory_delta).not.toHaveProperty("relationship");
      expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
    } else {
      expect(result.execution_reason).toBe("relationship_invalid");
      expect(result.memory_delta).toBeNull();
      expect(result.handoff_assessment).toBeNull();
    }
  });
  it("accepts the complete compact example through the existing parser and handoff validator", async () => {
    vi.clearAllMocks();
    const extension = CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS;
    const start = extension.indexOf("{");
    const example = JSON.parse(extension.slice(start, extension.indexOf("\n}\n", start) + 2));
    const fixture = validInput();
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata,
      content: JSON.stringify(example),
    });
    const result = await evaluatePostTurnPRD4({ ...input, handoffContext: {
      turnId: fixture.turnId, openRequest: null, delivery: fixture.delivery,
    } });
    expect(result.execution_status).toBe("executed");
    expect(result.action).toMatchObject({ type: "handoff", targetCharacter: "max" });
    expect(validateCharacterHandoff({ ...fixture, evaluation: result }).authorized).toBe(true);
  });
  it.each([
    ["builtin", null],
    ["historical override", buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, DEFAULT_DIRECTOR_CONFIG)],
  ])(
    "requires a rooted assessment in the effective %s prompt", async (_name, systemPromptOverride) => {
      vi.clearAllMocks();
      const fixture = validInput();
      vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
        handoff_assessment: validAssessment() }), ...llmMetadata });
      await evaluatePostTurnPRD4({ ...input, systemPromptOverride,
        handoffContext: { turnId: fixture.turnId, openRequest: null, delivery: fixture.delivery } });
      const [messages, options] = vi.mocked(callLLMWithUsage).mock.calls[0];
      const system = messages[0].content;
      const extension = system.slice(system.indexOf(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS));
      const start = extension.indexOf("{");
      const end = extension.indexOf("\n}\n", start) + 2;
      const example = JSON.parse(extension.slice(start, end));
      // A model following the shown JSON must place the proof where the cleaner reads it.
      expect(example).toHaveProperty("handoff_assessment.schemaVersion", 2);
      expect(example.handoff_assessment).toEqual({ schemaVersion: 2, requestSource: 'current_user',
        targetCharacter: 'max', stance: 'accept', refusal: false, consentRef: 'speech_0' });
      expect(example).not.toHaveProperty("schemaVersion");
      for (const key of Object.keys(historicalJson)) expect(example).toHaveProperty(key);
      expect(Object.keys(example).indexOf("handoff_assessment"))
        .toBeLessThan(Object.keys(example).indexOf("memory_delta"));
      expect(JSON.stringify(example).length).toBeLessThan(1600);
      expect(extension).toContain(CHARACTER_CALL_TRANSFER_INSTRUCTIONS);
      expect(extension).toContain("notes : 40 caractères");
      expect(extension).toContain("memory_delta : uniquement les nouveautés");
      expect(extension).toMatch(/clé handoff_assessment est obligatoire/);
      expect(extension).toMatch(/prioritaire sur le schéma historique/);
      expect(extension).toMatch(/accord effectivement délivré/);
      expect(callLLMWithUsage).toHaveBeenCalledOnce();
      expect(options).toMatchObject({ max_tokens: 950, timeoutMs: 12000 });
    },
  );
});
