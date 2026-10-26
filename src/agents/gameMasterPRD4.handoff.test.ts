import { beforeEach, describe, expect, it, vi } from "vitest";
import publishedV7Prompt from "./fixtures/gm-published-sandbox-v7.txt?raw";
import { advanceHandoffTurn, assessHandoffTurn } from "@/services/characterHandoffState";
import { GM_RUNTIME_OUTPUT_INSTRUCTIONS } from "@/services/gameMasterContract";
vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getVideoTriggersCached } from "@/services/videoTriggerService";
import { persistPostTurnMemory } from "@/services/sessionConversationMemory";
import { evaluatePostTurnPRD4, commitHandoffCandidate, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "./gameMasterPRD4";
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
  it.each([{ label: 'code', prompt: undefined }, { label: 'v7 publié', prompt: publishedV7Prompt }])('conserve un état pertinent malgré deux répétitions — $label', async ({ prompt: systemPromptOverride }) => {
    const state = 'État propre actuel';
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
      next_speech_state: state }), ...llmMetadata });
    const result = await evaluatePostTurnPRD4({ ...input, systemPromptOverride, rugosite: 3,
      speechStates: [{ name: state, description: 'Déclencheur toujours présent dans la scène.' }],
      recentSpeechStates: [state, state], speechStatePlayed: state });
    expect(result.next_speech_state).toBe(state);
    expect(result.speech_state_played).toBe(state);
    const [messages, options] = vi.mocked(callLLMWithUsage).mock.calls[0];
    expect(messages[0].content).toContain('sans rotation obligatoire');
    expect(messages[0].content).not.toContain('Jamais un état inventé ni trois fois');
    expect(messages[1].content).toContain('déclencheurs');
    expect(options).toMatchObject({ max_tokens: 950, model: 'existing-gm' });
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
  });
  it("accepts a historical JSON without next_speech_state under the actual published v7 prompt", async () => {
    expect(publishedV7Prompt).not.toContain("next_speech_state");
    expect(historicalJson).not.toHaveProperty("next_speech_state");
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify(historicalJson), ...llmMetadata });
    const result = await evaluatePostTurnPRD4({ ...input, systemPromptOverride: publishedV7Prompt });
    expect(result.execution_status).toBe("executed");
    expect(result.next_speech_state).toBeNull();
    expect(result).toMatchObject(historicalJson);
    expect(result.handoff_assessment).toBeNull();
    expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(false);
  });
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
  it("cleans the additive contract with the code-owned prompt and unchanged budget or call count", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: JSON.stringify({ ...historicalJson,
      handoff_assessment: { ...validAssessment(), unknown: "discarded" } }), ...llmMetadata });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.handoff_assessment).toEqual(validAssessment());
    expect(result.player_switch_request).toEqual(historicalJson.player_switch_request);
    expect(result.action).toEqual(historicalJson.action);
    expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][0][0].content).toBe(`${EXPERIENCE_DIRECTOR_SYSTEM_PROMPT}\n${GM_RUNTIME_OUTPUT_INSTRUCTIONS}`);
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
    expect(CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS).toMatch(/"refusal":\s*false/);
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
      expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
      expect(result.relationship_transition?.accepted).toBe(false);
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


describe("current wire contract and bounded diagnostic reasons", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([undefined, null, "État absent de la fiche", "Retenue"])("ignores optional unknown state %j without dropping the proof", async state => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({
      ...historicalJson, next_speech_state: state, handoff_assessment: validAssessment(),
    }) });
    const result = await evaluatePostTurnPRD4({ ...input, speechStates: [{ name: "Retenue", description: "" }] });
    expect(result.execution_status).toBe("executed");
    expect(result.next_speech_state).toBe(state === "Retenue" ? state : null);
    expect(result.validation_issues).toEqual(state === "État absent de la fiche" ? [{ code: "unknown_speech_state" }] : []);
    expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
    expect(result).not.toHaveProperty("diagnostic");
  });
  it.each(["not JSON", "null", "[]", "{}", "missing-action"])("distinguishes unreadable JSON from incomplete schemas: %s", async value => {
    const { action: _action, ...incomplete } = historicalJson;
    const content = value === "missing-action" ? JSON.stringify({ ...incomplete, handoff_assessment: validAssessment() }) : value;
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content });
    const result = await evaluatePostTurnPRD4({ ...input, diagnosticTrace: true });
    expect(result.execution_reason).toBe(value === "not JSON" ? "invalid_json" : "incomplete_schema");
    expect(result.validation_issues?.[0].code).toBe(value === "not JSON" ? "json_unreadable" : "schema_incomplete");
    if (value === "missing-action") expect(result.validation_issues?.[0].missing_fields).toEqual(["action"]);
    expect(result.action).toEqual({ type: "none" });
    expect(result.handoff_assessment).toBeNull();
    expect(result.diagnostic?.error).toBeTruthy();
  });
  it("persists missing proof fields without storing raw response or quotes in metadata", async () => {
    vi.mocked(persistPostTurnMemory).mockResolvedValueOnce(null);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({
      ...historicalJson, handoff_assessment: { schemaVersion: 2, requestSource: "current_user", targetCharacter: "max", stance: "accept", refusal: false },
    }) });
    const result = await evaluatePostTurnPRD4({ ...input, sessionId: "session" });
    expect(result.validation_issues).toEqual([{ code: "handoff_assessment_invalid", reason: "assessment_invalid", missing_fields: ["consentRef"] }]);
    expect(persistPostTurnMemory).toHaveBeenCalledWith("session", expect.objectContaining({ validation_issues: result.validation_issues }), null, 11, "emma");
    expect(result).not.toHaveProperty("diagnostic");
    expect(result.handoff_assessment).toBeNull();
  });
  it.each(["speech_99", "speech_0"])("explains rejected proof reference %s", async consentRef => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({ ...historicalJson,
      handoff_assessment: { schemaVersion: 2, requestSource: "current_user", targetCharacter: "max", stance: "accept", refusal: false, consentRef },
    }) });
    const fixture = validInput();
    const delivery = { ...fixture.delivery!, delivered: "Je vais", status: "interrupted" as const };
    const result = await evaluatePostTurnPRD4({ ...input, handoffContext: {
      turnId: fixture.turnId, openRequest: null,
      delivery,
    } });
    expect(result.validation_issues).toContainEqual({ code: "handoff_proof_rejected",
      reason: consentRef === "speech_99" ? "consent_evidence_missing" : "consent_not_delivered" });
    expect(validateCharacterHandoff({ ...fixture, delivery, evaluation: result }).authorized).toBe(false);
  });
  it.each(["max", "emma"] as const)("evaluates deferred then confirmed pronoun request from %s with old JSON and published prompt", async source => {
    const target = source === "max" ? "emma" : "max";
    const name = target === "max" ? "Max" : "Emma";
    const fixture = validInput();
    let state = advanceHandoffTurn(null, { sessionId: "session", sourceCharacter: source,
      orchestrationVersionId: "v6", turnId: "session:10", turnIndex: 10 });
    for (const [offset, reply] of ["Je vais lui demander.", `D’accord. Je te passe ${name}.`].entries()) {
      const index = 10 + offset;
      const userText = offset === 0 ? `Je voudrais parler avec ${name}.` : "Oui, je veux bien lui parler.";
      const delivery = { ...fixture.delivery!, turnId: `session:${index}`, turnIndex: index,
        character: source, generated: reply, delivered: reply };
      state = advanceHandoffTurn(state, { ...state, turnId: delivery.turnId, turnIndex: index });
      const action = offset === 0 ? { type: "none" } : { type: "handoff", targetCharacter: target, reason: "Accord", proposalGuidance: "Passer l’appel" };
      vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({
        ...historicalJson, action, player_switch_request: { targetCharacter: target, stance: offset ? "accept" : "defer" },
        handoff_assessment: { schemaVersion: 2, requestSource: offset ? "open_request" : "current_user",
          targetCharacter: target, stance: offset ? "accept" : "defer", refusal: false, consentRef: offset ? "speech_1" : "speech_0" },
      }) });
      const result = await evaluatePostTurnPRD4({ ...input, currentCharacter: source, turnIndex: index,
        userMessage: userText, maxResponse: reply, systemPromptOverride: publishedV7Prompt,
        handoffContext: { turnId: delivery.turnId, delivery, openRequest: state.openRequest } });
      expect(result.execution_status).toBe("executed");
      expect(result.next_speech_state).toBeNull();
      state = assessHandoffTurn(state, { ...fixture, currentCharacter: source, turnIndex: index,
        turnId: delivery.turnId, userText, delivery, openRequest: state.openRequest, evaluation: result }).state;
      expect(state.state).toBe(offset ? "available" : "awaiting_character");
      const system = vi.mocked(callLLMWithUsage).mock.calls.at(-1)![0][0].content;
      expect(system.startsWith(publishedV7Prompt)).toBe(true);
      expect(system.indexOf(GM_RUNTIME_OUTPUT_INSTRUCTIONS)).toBeGreaterThan(system.indexOf("EXACTEMENT cet objet"));
    }
    expect(callLLMWithUsage).toHaveBeenCalledTimes(2);
    expect(state.offer?.targetCharacter).toBe(target);
  });
});


describe('lot 3 — historical references and GM lifetime', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([['builtin', undefined], ['v7', publishedV7Prompt]])('rejects the actual T9 reference without repair under effective prompt %s', async (_name, systemPromptOverride) => {
    const fixture = validInput();
    const reply = 'D’accord… je vais lui dire. Un instant.';
    const delivery = { ...fixture.delivery!, generated: reply, delivered: reply };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({ ...historicalJson,
      handoff_assessment: { schemaVersion: 2, requestSource: 'current_user', targetCharacter: 'max',
        stance: 'accept', refusal: false, consentRef: 'currentUserMessage' } }) });
    const result = await evaluatePostTurnPRD4({ ...input, maxResponse: reply, systemPromptOverride,
      handoffContext: { turnId: fixture.turnId, delivery, openRequest: null } });
    expect(result.handoff_assessment).toBeNull();
    expect(result.validation_issues).toContainEqual({ code: 'handoff_proof_rejected', reason: 'consent_reference_invalid' });
    const system = vi.mocked(callLLMWithUsage).mock.calls[0][0][0].content;
    expect(system).toContain('speech_N');
    expect(system).toContain('JAMAIS des consentRef');
    expect(validateCharacterHandoff({ ...fixture, delivery, evaluation: result }).authorized).toBe(false);
    expect(callLLMWithUsage).toHaveBeenCalledOnce();
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][1]).toMatchObject({ max_tokens: 950, timeoutMs: 12000 });
  });
  it.each([['max', 'emma'], ['emma', 'max']] as const)('evaluates delivered T12 evidence through v7 %s → %s', async (source, target) => {
    const fixture = validInput();
    const reply = 'Non… pas encore. J’ai dit que j’allais lui annoncer. Je te la passe maintenant.';
    const userMessage = `Tu as pu me passer ${target} ou pas ?`;
    const delivery = { ...fixture.delivery!, character: source, generated: reply, delivered: reply };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({ ...historicalJson,
      action: { type: 'handoff', targetCharacter: target, reason: 'Accord courant', proposalGuidance: 'Propose le passage.' },
      handoff_assessment: { schemaVersion: 2, requestSource: 'current_user', targetCharacter: target,
        stance: 'accept', refusal: false, consentRef: 'speech_3' } }) });
    const result = await evaluatePostTurnPRD4({ ...input, currentCharacter: source, userMessage, maxResponse: reply,
      systemPromptOverride: publishedV7Prompt, handoffContext: { turnId: fixture.turnId, delivery, openRequest: null } });
    expect(result.validation_issues).toEqual([]);
    expect(result.handoff_assessment?.consent.evidence).toBe('Je te la passe maintenant.');
    expect(validateCharacterHandoff({ ...fixture, currentCharacter: source, userText: userMessage, delivery, evaluation: result }).authorized).toBe(true);
  });
  it('classifies cancellation during GM persistence without calling it an unexplained persistence failure', async () => {
    const controller = new AbortController();
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata,
      content: JSON.stringify({ ...historicalJson, handoff_assessment: validAssessment() }) });
    vi.mocked(persistPostTurnMemory).mockImplementationOnce(async () => {
      controller.abort('new-user-turn'); throw new DOMException('Obsolete GM persistence', 'AbortError');
    });
    const result = await evaluatePostTurnPRD4({ ...input, sessionId: 'session', signal: controller.signal });
    expect(result.execution_reason).toBe('parent_aborted');
    expect(result.handoff_assessment).toBeNull();
    expect(result.action).toEqual({ type: 'none' });
  });
});


describe('lot 3 — late evaluation cannot supply the next turn agreement', () => {
  it.each(['generation', 'persistence'] as const)('ignores an adapter that resolves after abort during %s; the fresh turn can confirm', async phase => {
    vi.clearAllMocks();
    const controller = new AbortController();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const fixture = validInput();
    const oldReply = 'Je te passe Max.';
    const oldDelivery = { ...fixture.delivery!, generated: oldReply, delivered: oldReply };
    const raw = { ...historicalJson, handoff_assessment: { schemaVersion: 2, requestSource: 'current_user',
      targetCharacter: 'max', stance: 'accept', refusal: false, consentRef: 'speech_0' } };
    vi.mocked(callLLMWithUsage).mockImplementationOnce(async () => {
      if (phase === 'generation') { entered(); await gate; }
      return { ...llmMetadata, content: JSON.stringify(raw) };
    });
    vi.mocked(persistPostTurnMemory).mockImplementationOnce(async () => {
      if (phase === 'persistence') { entered(); await gate; }
      return null;
    });
    const pending = evaluatePostTurnPRD4({ ...input, sessionId: 'session', signal: controller.signal,
      maxResponse: oldReply, handoffContext: { turnId: fixture.turnId, delivery: oldDelivery, openRequest: null } });
    await started;
    controller.abort('new-user-turn'); release();
    const late = await pending;
    expect(late.execution_reason).toBe('parent_aborted');
    expect(late.handoff_assessment).toBeNull();
    expect(late.action).toEqual({ type: 'none' });
    const currentTurn = { currentCharacter: 'emma' as const, turnId: 'session:12', turnIndex: 12,
      orchestrationVersionId: 'v6', userText: 'Tu as pu me passer Max ou pas ?' };
    const state = advanceHandoffTurn(null, { sessionId: 'session', sourceCharacter: 'emma', ...currentTurn });
    expect(assessHandoffTurn(state, { ...fixture, delivery: oldDelivery, evaluation: late }).validation.reason).toBe('gm_late');
    const reply = 'Non… pas encore. Je te le passe maintenant.';
    const delivery = { ...oldDelivery, turnId: currentTurn.turnId, turnIndex: currentTurn.turnIndex, generated: reply, delivered: reply };
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata,
      content: JSON.stringify({ ...raw, handoff_assessment: { ...raw.handoff_assessment, consentRef: 'speech_2' } }) });
    const current = await evaluatePostTurnPRD4({ ...input, turnIndex: 12, userMessage: currentTurn.userText,
      maxResponse: reply, handoffContext: { turnId: currentTurn.turnId, delivery, openRequest: null } });
    expect(assessHandoffTurn(state, { ...currentTurn, delivery, evaluation: current }).state.state).toBe('available');
    expect(callLLMWithUsage).toHaveBeenCalledTimes(2);
  });
});


it('F1 T21: preserves independently valid handoff when relationship is invalid', async () => {
  vi.clearAllMocks();
  const policy: CharacterRelationshipPolicy = { schemaVersion: 1, characterKey: 'emma', version: 'policy-v1', source: 'notion',
    callDrive: 'Écouter.', openingSignals: [], closingSignals: [], sensitiveTopics: [], resistanceStyle: 'Prudente.', initiativeStyle: 'Écouter.' };
  vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({ ...historicalJson,
    handoff_assessment: validAssessment(), memory_delta: { relationship: {} } }) });
  const result = await evaluatePostTurnPRD4({ ...input, relationshipPolicy: policy });
  expect(result.memory_delta).toBeNull();
  expect(result.relationship_transition?.accepted).toBe(false);
  expect(validateCharacterHandoff({ ...validInput(), evaluation: result }).authorized).toBe(true);
});


it('F1: un candidat ne devient ni souvenir ni état joué avant le reçu réel', async () => {
  vi.clearAllMocks();
  const fixture = validInput();
  vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...llmMetadata, content: JSON.stringify({ ...historicalJson,
    handoff_assessment: validAssessment(), next_speech_state: 'Attente', memory_delta: { userFacts: ['Fait candidat'] } }) });
  const result = await evaluatePostTurnPRD4({ ...input, persist: false, sessionId: 'session', speechStatePlayed: null,
    handoffContext: { turnId: fixture.turnId, openRequest: null, delivery: null, candidateText: fixture.delivery!.generated } });
  expect(persistPostTurnMemory).not.toHaveBeenCalled();
  expect(getVideoTriggersCached).not.toHaveBeenCalled();
  expect(result.speech_state_played).toBeNull();
  const committed = await commitHandoffCandidate({ sessionId: 'session', userText: fixture.userText, openRequest: null },
    result, { ...fixture.delivery!, delivered: '', status: 'interrupted' }, true);
  expect(committed.handoff_assessment).toBeNull();
  expect(committed.memory_delta).toBeNull();
  expect(committed.speech_state_played).toBeNull();
  expect(committed.next_speech_state).toBeNull();
  expect(persistPostTurnMemory).toHaveBeenCalledWith('session', expect.anything(), null, 11, 'emma', expect.any(AbortSignal));
  expect(callLLMWithUsage).toHaveBeenCalledOnce();
});
