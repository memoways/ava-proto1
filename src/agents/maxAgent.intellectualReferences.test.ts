import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLM: vi.fn(), callLLMWithUsage: vi.fn(), streamLLM: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: vi.fn(() => ({ MAX_PROMPT_VARIANT: "optimized_v3" })),
  getLLMSettings: vi.fn(() => ({})),
  getAntiHallucinationValidatorSettings: vi.fn(),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/characterPromptService", async () => {
  const { makeNotionMaxPrompt } = await import("./__fixtures__/maxNotionFixture");
  const sheet = makeNotionMaxPrompt();
  return {
    buildCharacterPromptSections: vi.fn(() => ""),
    loadCharacterPrompt: vi.fn(),
    loadCharacterPromptByName: vi.fn().mockResolvedValue(sheet),
    clearCharacterPromptCache: vi.fn(),
  };
});

import { buildMaxSystemPrompt } from "./maxAgent";

const REFERENCE = "Lectures scientifiques, histoire des crises et journalisme d'enquête.";
const input = { conversationHistory: [], userMessage: "Et alors ?" };

describe("evaluation switch: intellectual references out of the runtime", () => {
  it("plays the field by default and removes it in memory when set to false", async () => {
    const played = await buildMaxSystemPrompt(input, "Max", undefined, "optimized_v3");
    expect(played.finalSystemPrompt).toContain(REFERENCE);
    const without = await buildMaxSystemPrompt(input, "Max", undefined, "optimized_v3", { intellectualReferences: false });
    expect(without.finalSystemPrompt).not.toContain(REFERENCE);
    const again = await buildMaxSystemPrompt(input, "Max", undefined, "optimized_v3");
    expect(again.finalSystemPrompt).toContain(REFERENCE);
  });
});
