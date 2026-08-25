import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { writeEnvironmentStorage } from "@/services/environmentContext";
import {
  GRADIUM_VOICE_TUNING_DEFAULTS,
  getGradiumSettings,
  getGradiumVoiceTuning,
  patchGradiumCharacterTuning,
  resolveGradiumSettings,
  type GradiumSettings,
} from "./providerSettings";

const GRADIUM_KEY = "ava_tts_settings_gradium";

function baseSettings(overrides: Partial<GradiumSettings> = {}): GradiumSettings {
  return {
    voiceId: "voice-default",
    outputFormat: "opus",
    ...GRADIUM_VOICE_TUNING_DEFAULTS,
    streamingEnabled: true,
    streamingFormat: "pcm_24000",
    byCharacter: {},
    settingsVersion: 2,
    ...overrides,
  };
}

describe("Gradium per-character voice tuning", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to global tuning when the character has no override", () => {
    const settings = baseSettings({ temp: 0.4, cfgCoef: 3 });
    expect(getGradiumVoiceTuning(settings, "max")).toMatchObject({ temp: 0.4, cfgCoef: 3 });
    expect(getGradiumVoiceTuning(settings, "emma")).toMatchObject({ temp: 0.4, cfgCoef: 3 });
    expect(getGradiumVoiceTuning(settings)).toMatchObject({ temp: 0.4, cfgCoef: 3 });
  });

  it("applies Max and Emma overrides independently", () => {
    let settings = baseSettings({ temp: 0.7 });
    settings = patchGradiumCharacterTuning(settings, "max", { temp: 0.3, paddingBonus: -1 });
    settings = patchGradiumCharacterTuning(settings, "emma", { temp: 1.1, cfgCoef: 1.5 });

    expect(getGradiumVoiceTuning(settings, "max")).toMatchObject({
      temp: 0.3,
      cfgCoef: 2,
      paddingBonus: -1,
    });
    expect(getGradiumVoiceTuning(settings, "emma")).toMatchObject({
      temp: 1.1,
      cfgCoef: 1.5,
      paddingBonus: 0,
    });
    expect(getGradiumVoiceTuning(settings, "max").temp).not.toBe(getGradiumVoiceTuning(settings, "emma").temp);
  });

  it("resolves stored Gradium settings for the requested character", () => {
    writeEnvironmentStorage(GRADIUM_KEY, JSON.stringify({
      temp: 0.7,
      byCharacter: { emma: { temp: 1.2, rewriteRules: "fr" } },
    }));

    expect(resolveGradiumSettings("max").temp).toBe(0.7);
    expect(resolveGradiumSettings("emma").temp).toBe(1.2);
    expect(resolveGradiumSettings("emma").rewriteRules).toBe("fr");
    expect(resolveGradiumSettings().temp).toBe(0.7);
  });

  it("restores a missing byCharacter map from legacy stored settings", () => {
    writeEnvironmentStorage(GRADIUM_KEY, JSON.stringify({
      voiceId: "legacy",
      temp: 0.5,
      outputFormat: "opus",
      settingsVersion: 2,
    }));

    expect(getGradiumSettings().byCharacter).toEqual({});
    expect(getGradiumSettings().temp).toBe(0.5);
  });
});
