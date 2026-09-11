import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
}));
vi.mock("@/services/debugLogger", () => ({
  debugLogger: { log: vi.fn(), logError: vi.fn() },
}));
vi.mock("@/services/settingsService", () => ({
  getGMPromptSettings: () => ({ systemPrompt: "GM SYSTEM", preTurnPlannerPrompt: "GM PRETURN" }),
  getGameplaySettings: () => ({ TRUST_THRESHOLD: 5 }),
  getLLMSettings: () => ({ LLM_MODEL_GM: "test/model", LLM_MAX_TOKENS_GM: 200 }),
}));
vi.mock("@/services/characterPromptService", () => ({
  loadCharacterPrompt: vi.fn(),
  loadCharacterPromptByName: vi.fn(),
}));
vi.mock("@/services/ragService", () => ({ queryRAG: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));

import { planGameMasterTurnDetailed } from "./gameMasterAgent";
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import type { CharacterExecutionContext } from "@/services/characterIdentityGuard";

const EMMA_CONTEXT: CharacterExecutionContext = {
  characterKey: "emma",
  displayName: "Emma Munz",
  characterId: "22222222-2222-4222-8222-222222222222",
  notionPageId: "881122c973c943409daed13b3113b00e",
  environmentId: "prod",
  promptUpdatedAt: "2026-09-11T08:00:00.000Z",
};

const input = {
  conversationHistory: [{ role: "emma" as const, content: "Allô ?", timestamp: 1 }],
  userMessage: "Qui es-tu ?",
  currentTrustLevel: 0,
  triggeredIds: [],
  timeElapsedSeconds: 4,
  characterContext: EMMA_CONTEXT,
};

describe("Game Master character identity context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callLLMWithUsage).mockResolvedValue({
      content: "{}",
      model: "test/model",
      latencyMs: 1,
      usage: null,
    } as never);
  });

  it("conserve ensemble l'invariant exact et la situation éditoriale d'Emma", async () => {
    vi.mocked(loadCharacterPrompt).mockResolvedValue({
      character_id: EMMA_CONTEXT.characterId,
      name: "Emma Munz",
      situation_summary: "Emma est chez elle.",
      updated_at: EMMA_CONTEXT.promptUpdatedAt,
    } as never);

    const result = await planGameMasterTurnDetailed(input);

    expect(result.systemPrompt).toContain("Tu es Emma Munz");
    expect(result.systemPrompt).toContain(`character_id=${EMMA_CONTEXT.characterId}`);
    expect(result.systemPrompt).toContain("Emma est chez elle.");
    expect(result.userPrompt).toContain("prochain tour de Emma Munz");
    expect(result.userPrompt).not.toContain("prochain tour de Max");
  });

  it("refuse le Game Master quand la fiche exactement attribuée est absente", async () => {
    vi.mocked(loadCharacterPrompt).mockResolvedValue(null);

    await expect(planGameMasterTurnDetailed(input)).rejects.toThrow(/sheet unavailable/i);
    expect(callLLMWithUsage).not.toHaveBeenCalled();
  });
});
