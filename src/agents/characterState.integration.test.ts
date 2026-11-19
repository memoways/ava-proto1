/**
 * Lot D — the state radar reaches the character prompt and the GM contract.
 * Pure-ish: the LLM is mocked, nothing is added to the AI call count.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "google/gemini-2.5-flash", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn() }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { evaluatePostTurnPRD4 } from "./gameMasterPRD4";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";
import { buildOptimizedPromptAssembly } from "./maxOptimizedPromptCompiler";
import { buildGmOffEvaluation } from "@/services/gmSpeechGuidance";
import {
  STATE_LEVEL_TEXT, compileCharacterStateBlock, normalizeStateProfile, type CharacterStateProfile, type StateLevels,
} from "@/services/characterState";

const profile = normalizeStateProfile({ initial: { agitation: 2 } }) as CharacterStateProfile;
const levels: StateLevels = { combativite: 3, initiative: 3, lucidite: 3, ouverture: 3, agitation: 2 };

const base = JSON.stringify({
  labels: { themes: [], topics: [], intentions: [] },
  engagement_delta: 0, confusion_detected: false, role_usage_quality: "high", topics_covered: [],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: "Continue.",
  next_speech_state: null, end_recommended: false, moderation_flag: false, notes: "", trigger_video_id: null,
  action: { type: "none" }, player_switch_request: null, memory_delta: null,
});
const withDelta = (delta: unknown) => JSON.stringify({ ...JSON.parse(base), character_state_delta: delta });

const input = {
  sessionId: null, conversationHistory: [], userMessage: "Alors ?", maxResponse: "Je ne sais pas.",
  currentCharacter: "max" as const, userRole: null, turnIndex: 4, timeElapsedSeconds: 180,
  sessionDurationSeconds: 900, minimumClosureSeconds: 600,
};
const usage = { prompt_tokens: 5000, completion_tokens: 400, total_tokens: 5400 };
const meta = { generationId: "gen", model: "google/gemini-2.5-flash", latencyMs: 1000, diagnosticTrace: null };
const reply = (content: string) => vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...meta, content, finishReason: "stop", usage });

describe("GM post-turn: character_state_delta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the « ## ÉTAT DU PERSONNAGE » section with values, bounds and exact echo metadata", async () => {
    reply(base);
    await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("## ÉTAT DU PERSONNAGE");
    expect(prompt).toContain('"sourceTurn":4');
    expect(prompt).toContain("Agitation");
  });

  it("has no state section and no delta handling without a profile (behaviour unchanged)", async () => {
    reply(withDelta({ characterKey: "max", sourceTurn: 4, changes: { agitation: 1 } }));
    const result = await evaluatePostTurnPRD4(input);
    expect(String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content)).not.toContain("## ÉTAT DU PERSONNAGE");
    expect(result.character_state_after).toBeUndefined();
  });

  it("applies a valid delta for the next turn and logs used/after/applied", async () => {
    reply(withDelta({ characterKey: "max", sourceTurn: 4, changes: { agitation: 1, ouverture: -1 } }));
    const result = await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    expect(result.character_state_used).toEqual(levels);
    expect(result.character_state_after).toEqual({ ...levels, agitation: 3, ouverture: 2 });
    expect(result.character_state_applied).toEqual({ agitation: 1, ouverture: -1 });
  });

  it("clamps an over-large step and records the issue", async () => {
    reply(withDelta({ characterKey: "max", sourceTurn: 4, changes: { agitation: 4 } }));
    const result = await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    expect(result.character_state_after?.agitation).toBe(3);
    expect(result.validation_issues).toEqual(expect.arrayContaining([{ code: "state_delta_step_clamped" }]));
  });

  it("ignores a late result (wrong source turn) and keeps the state", async () => {
    reply(withDelta({ characterKey: "max", sourceTurn: 3, changes: { agitation: 1 } }));
    const result = await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    expect(result.character_state_after).toEqual(levels);
    expect(result.validation_issues).toEqual(expect.arrayContaining([{ code: "state_delta_wrong_turn" }]));
  });

  it("ignores a delta addressed to another character", async () => {
    reply(withDelta({ characterKey: "emma", sourceTurn: 4, changes: { agitation: 1 } }));
    const result = await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    expect(result.character_state_after).toEqual(levels);
  });

  it("keeps the state when the GM output is unreadable", async () => {
    reply("pas du json");
    const result = await evaluatePostTurnPRD4({ ...input, characterState: { profile, levels } });
    expect(result.execution_status).toBe("invalid");
    expect(result.character_state_after).toEqual(levels);
  });
});

describe("GM mode off", () => {
  it("logs the fixed initial state, with nothing applied", () => {
    const entry = buildGmOffEvaluation({
      characterKey: "max", turnIndex: 2, injected: { text: "", speechState: null, topicsCovered: [] },
      orchestrationVersionId: null, orchestrationConfig: null, characterState: levels,
    });
    expect(entry.character_state_used).toEqual(levels);
    expect(entry.character_state_after).toEqual(levels);
    expect(entry.character_state_applied).toEqual({});
  });
});

describe("character prompt: ÉTAT DU PERSONNAGE À CE TOUR", () => {
  const sheet = makeNotionMaxPrompt();
  const build = (characterState?: string) => buildOptimizedPromptAssembly({
    character: sheet, characterName: "Max", userMessage: "Alors ?", historyChars: 0, speechState: "Rugosité réglée.", characterState,
  });

  it("is absent without a state profile", () => {
    expect(build().finalSystemPrompt).not.toContain("ÉTAT DU PERSONNAGE À CE TOUR");
  });

  it("is compiled by axis level, placed with PAROLE DU TOUR, and changes with one level", () => {
    const a = build(compileCharacterStateBlock({ ...levels, agitation: 5 }, profile));
    const prompt = a.finalSystemPrompt;
    expect(prompt).toContain("ÉTAT DU PERSONNAGE À CE TOUR");
    expect(prompt).toContain(STATE_LEVEL_TEXT.agitation[5]);
    expect(prompt.indexOf("PAROLE DU TOUR")).toBeLessThan(prompt.indexOf("ÉTAT DU PERSONNAGE À CE TOUR"));
    const b = build(compileCharacterStateBlock({ ...levels, agitation: 0 }, profile));
    expect(b.finalSystemPrompt).toContain(STATE_LEVEL_TEXT.agitation[0]);
    expect(b.finalSystemPrompt).not.toContain(STATE_LEVEL_TEXT.agitation[5]);
    expect(a.budget?.withinBudget).toBe(true);
  });
});
