import { beforeEach, describe, expect, it, vi } from "vitest";

const queriedKeys: string[] = [];
const writes = vi.hoisted(() => vi.fn(async () => ({ error: null })));
let storedLLM: Record<string, unknown> | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (column: string, key: string) => ({
          in: async () => {
            if (column === "key") queriedKeys.push(key);
            return { data: key === "ava_llm_settings" && storedLLM ? [{ environment_id: "prod", value: storedLLM }] : [], error: null };
          },
        }),
      }),
      upsert: writes,
      delete: () => ({ eq: () => Promise.resolve({}) }),
    }),
  },
}));

import {
  CHARACTER_MAX_TOKENS_CEILING,
  CHARACTER_MAX_TOKENS_FLOOR,
  clampCharacterMaxTokens,
  getAntiHallucinationValidatorSettings,
  getLLMSettings,
  getMaxPromptControlSettings,
  getVideoTriggerSettings,
  hydrateAllSettings,
  loadLLMSettingsFromDB,
  videoTriggerDefaults,
} from "./settingsService";

describe("settingsService recent additions", () => {
  beforeEach(() => {
    localStorage.clear();
    queriedKeys.length = 0; storedLLM = null; writes.mockClear();
  });

  it("merges stored video trigger settings with defaults", () => {
    localStorage.setItem(
      "ava_video_trigger_settings",
      JSON.stringify({ ENABLED: false, MIN_TURNS_BETWEEN: 7 }),
    );

    expect(getVideoTriggerSettings()).toEqual({
      ...videoTriggerDefaults,
      ENABLED: false,
      MIN_TURNS_BETWEEN: 7,
    });
  });

  it("defaults the anti-hallucination validator to off mode", () => {
    expect(getAntiHallucinationValidatorSettings().mode).toBe("off");
  });

  it("does not persist normalization from a read-only workshop bootstrap", async () => {
    storedLLM = { LLM_MODEL: "invalid-historical-model" };
    await hydrateAllSettings({ readOnly: true });
    expect(writes).not.toHaveBeenCalled();
    await loadLLMSettingsFromDB();
    expect(writes).toHaveBeenCalledOnce();
  });

  it("R1 — raises stored pre-R1 character budgets to the effective floor and caps them", () => {
    expect(clampCharacterMaxTokens(220)).toBe(CHARACTER_MAX_TOKENS_FLOOR);
    expect(clampCharacterMaxTokens(400)).toBe(400);
    expect(clampCharacterMaxTokens(2000)).toBe(CHARACTER_MAX_TOKENS_CEILING);
    expect(clampCharacterMaxTokens(Number.NaN)).toBe(CHARACTER_MAX_TOKENS_FLOOR);
    expect(getLLMSettings().LLM_MAX_TOKENS).toBe(360);
  });

  it("R1 — default response style asks for 2–3 sentences with a hook, not a reflex question", () => {
    const style = getMaxPromptControlSettings().responseStyle;
    expect(style).toContain("2 à 3 phrases");
    expect(style).toContain("accroche");
    expect(style).toContain("Tu ne termines PAS chaque réponse par une question");
  });

  it("hydrates video trigger settings on app start", async () => {
    await hydrateAllSettings();

    expect(queriedKeys).toContain("ava_video_trigger_settings");
  });
});
