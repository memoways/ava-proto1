/**
 * Lot A — the GM settings act whatever the pinned orchestration version:
 * the settings block is compiled at runtime from the pinned config, including
 * for `builtin://` versions (sandbox-romed, sandbox-benoit), and the GM
 * temperature setting reaches the call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import publishedV7Prompt from "./fixtures/gm-published-sandbox-v7.txt?raw";

const llmSettings: { LLM_MODEL_GM: string; LLM_MAX_TOKENS_GM: number; LLM_GM_TEMPERATURE?: number } = {
  LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950,
};
vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => llmSettings }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, resolveDirectorSystemPrompt } from "./gameMasterPRD4";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "@/services/experienceOrchestration";
import { buildExperienceDirectorPrompt, GM_SETTINGS_BLOCK_HEADER } from "@/services/gameMasterPromptBuilder";
import { GM_RUNTIME_OUTPUT_INSTRUCTIONS } from "@/services/gameMasterContract";

const reply = {
  engagement_delta: 0, confusion_detected: false, role_usage_quality: "high", topics_covered: [],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: "Continue.", end_recommended: false,
  moderation_flag: false, notes: "", trigger_video_id: null, labels: { themes: [], topics: [], intentions: [] },
  memory_delta: null, action: { type: "none" }, player_switch_request: null,
};
const meta = { model: "existing-gm", usage: null, generationId: null, latencyMs: 1, diagnosticTrace: null };
const input = {
  sessionId: null, conversationHistory: [], userMessage: "Bonjour", maxResponse: "Bonjour.", userRole: null,
  currentCharacter: "max" as const, turnIndex: 3, timeElapsedSeconds: 60, sessionDurationSeconds: 600,
  minimumClosureSeconds: 480, persist: false,
};
/** The builtin baseline config actually pinned in sandbox-romed and sandbox-benoit (read 19 November 2026). */
const builtinBaselineConfig = normalizeDirectorConfig({ handoffTarget: "emma", schemaVersion: 1, directorTimeoutMs: 12000,
  minimumHandoffTurn: 4, maximumHandoffsPerSession: 1 } as never);
const systemOf = (call = 0) => vi.mocked(callLLMWithUsage).mock.calls[call][0][0].content as string;
const countOf = (text: string, needle: string) => text.split(needle).length - 1;

describe("GM settings at runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete llmSettings.LLM_GM_TEMPERATURE;
    vi.mocked(callLLMWithUsage).mockResolvedValue({ content: JSON.stringify(reply), ...meta });
  });

  it("a builtin:// version receives the settings block compiled from its pinned config", async () => {
    const config = normalizeDirectorConfig({ ...builtinBaselineConfig,
      editor: { ...builtinBaselineConfig.editor, tone: "directive", customInstructions: "Rester très sobre." } });
    await evaluatePostTurnPRD4({ ...input, systemPromptOverride: "builtin://experience-director/v1", orchestrationConfig: config });
    const system = systemOf();
    expect(system.startsWith(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT.trim())).toBe(true);
    expect(countOf(system, GM_SETTINGS_BLOCK_HEADER)).toBe(1);
    expect(system).toContain("Posture du directeur : Directif");
    expect(system).toContain("Rester très sobre.");
    expect(system).toContain("au maximum 1 fois");
    expect(system).toContain(GM_RUNTIME_OUTPUT_INSTRUCTIONS);
  });

  it("a published version gets its frozen block replaced, never doubled", async () => {
    const config = normalizeDirectorConfig({ ...DEFAULT_DIRECTOR_CONFIG,
      editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, guidanceLength: "short" } });
    await evaluatePostTurnPRD4({ ...input, systemPromptOverride: publishedV7Prompt, orchestrationConfig: config });
    const system = systemOf();
    expect(countOf(system, GM_SETTINGS_BLOCK_HEADER)).toBe(1);
    expect(countOf(system, "## CONTEXTE DU PROJET")).toBe(1);
    expect(system).toContain("Longueur de next_turn_guidance : Très courte");
    expect(system).not.toContain("Longueur de next_turn_guidance : Équilibrée");
  });

  it("a draft prompt saved by the admin is sent exactly as compiled", () => {
    const saved = buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, DEFAULT_DIRECTOR_CONFIG);
    expect(resolveDirectorSystemPrompt(saved, DEFAULT_DIRECTOR_CONFIG)).toBe(saved);
    expect(resolveDirectorSystemPrompt("builtin://experience-director/v1", DEFAULT_DIRECTOR_CONFIG)).toBe(saved);
  });

  it("without a pinned config the stored or code prompt is kept as is", () => {
    expect(resolveDirectorSystemPrompt(publishedV7Prompt, null)).toBe(publishedV7Prompt.trim());
    expect(resolveDirectorSystemPrompt("builtin://experience-director/v1", null)).toBe(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT);
    expect(resolveDirectorSystemPrompt(null, undefined)).toBe(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT);
  });

  it("the comparison baseline can ask for the code prompt without the settings block", async () => {
    await evaluatePostTurnPRD4({ ...input, systemPromptOverride: EXPERIENCE_DIRECTOR_SYSTEM_PROMPT,
      orchestrationConfig: DEFAULT_DIRECTOR_CONFIG, compileSettingsBlock: false });
    expect(systemOf()).not.toContain(GM_SETTINGS_BLOCK_HEADER);
  });

  it("uses 0.2 by default and the GM temperature setting when set", async () => {
    await evaluatePostTurnPRD4(input);
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][1]).toMatchObject({ temperature: 0.2 });
    llmSettings.LLM_GM_TEMPERATURE = 0.55;
    await evaluatePostTurnPRD4(input);
    expect(vi.mocked(callLLMWithUsage).mock.calls[1][1]).toMatchObject({ temperature: 0.55 });
  });
});
