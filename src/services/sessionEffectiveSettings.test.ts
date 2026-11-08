import { describe, expect, it } from "vitest";
import { buildSessionEffectiveSettings, readSessionEffectiveSettings } from "./sessionEffectiveSettings";
import type { EffectiveVoice } from "./effectiveVoice";

const voice = (patch: Partial<EffectiveVoice>): EffectiveVoice => ({
  device: "smartphone", character: "max", output: "tts", outputReason: "device_smartphone", avatarProvider: null,
  speaker: "ava", engine: "elevenlabs", model: "eleven_v4_turbo", settings: [], voiceId: "VK9GO2Vntd9rcY7Tg6wl",
  voiceSource: "catalogue", summary: "ElevenLabs · eleven_v4_turbo · voix VK9G… (catalogue)", ...patch,
});

describe("buildSessionEffectiveSettings", () => {
  it("records models, starting voice, output and settings version", () => {
    const record = buildSessionEffectiveSettings({
      settings: { environmentId: "sandbox-ulrich", source: "database", settingsUpdatedAt: "2026-11-08T15:42:00Z",
        environmentKeys: ["ava_llm_settings"], inheritedFromProd: [], defaultKeys: [], durationMs: 120 },
      llm: { LLM_MODEL: "openai/gpt-5.6-luna", LLM_MODEL_GM: "google/gemini-2.5-flash" },
      startingCharacter: "max",
      outputMode: "tts",
      outputModeReason: "device_smartphone",
      voices: { max: voice({}), emma: voice({ character: "emma", engine: "gradium", model: null, voiceId: "g-emma" }) },
      now: new Date("2026-11-08T16:00:00Z"),
    });
    expect(record).toMatchObject({
      version: 1, recorded_at: "2026-11-08T16:00:00.000Z", settings_source: "database", settings_environment: "sandbox-ulrich",
      settings_updated_at: "2026-11-08T15:42:00Z", max_model: "openai/gpt-5.6-luna", gm_model: "google/gemini-2.5-flash",
      tts_provider: "elevenlabs", tts_model: "eleven_v4_turbo", voice_id: "VK9GO2Vntd9rcY7Tg6wl", voice_source: "catalogue",
      output_mode: "tts", avatar_provider: null,
    });
    expect(record.characters.emma).toMatchObject({ engine: "gradium", voice_id: "g-emma" });
    expect(readSessionEffectiveSettings({ browser_family: "safari", effective_settings: record })).toEqual(record);
  });

  it("older sessions have no record", () => {
    expect(readSessionEffectiveSettings(null)).toBeNull();
    expect(readSessionEffectiveSettings({ browser_family: "safari" })).toBeNull();
  });
});
