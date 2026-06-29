import { beforeEach, describe, expect, it, vi } from "vitest";

const queriedKeys: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (column: string, key: string) => ({
          maybeSingle: async () => {
            if (column === "key") queriedKeys.push(key);
            return { data: null, error: null };
          },
        }),
      }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({}) }),
    }),
  },
}));

import {
  getAntiHallucinationValidatorSettings,
  getVideoTriggerSettings,
  hydrateAllSettings,
  videoTriggerDefaults,
} from "./settingsService";

describe("settingsService recent additions", () => {
  beforeEach(() => {
    localStorage.clear();
    queriedKeys.length = 0;
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

  it("hydrates video trigger settings on app start", async () => {
    await hydrateAllSettings();

    expect(queriedKeys).toContain("ava_video_trigger_settings");
  });
});
