import { describe, expect, it } from "vitest";
import {
  deviceServicesDefaults,
  dropRedundantLegacyVoices,
  isLegacyDeviceServices,
  legacyVoiceConflicts,
  normalizeDeviceServices,
  resolveDeviceVoice,
  serializeDeviceServices,
  type DeviceServiceSettings,
} from "./deviceServices";

const own = { ttsProvider: null, legacyVoiceId: "" };
const base: DeviceServiceSettings = { output: "settings", avatarProvider: null, characters: { max: own, emma: own } };

describe("normalizeDeviceServices", () => {
  it("keeps today's behaviour by default", () => {
    expect(normalizeDeviceServices(undefined)).toEqual(deviceServicesDefaults);
    expect(deviceServicesDefaults.smartphone.output).toBe("voice");
    expect(deviceServicesDefaults.tablet.output).toBe("settings");
    expect(deviceServicesDefaults.desktop.output).toBe("settings");
    expect(deviceServicesDefaults.smartphone.characters).toEqual({ max: own, emma: own });
  });

  it("reads the new format: one engine per character and device, unknown values dropped", () => {
    const value = normalizeDeviceServices({
      version: 2,
      smartphone: { output: "voice", avatarProvider: "anam", characters: { max: { ttsProvider: "elevenlabs" }, emma: { ttsProvider: "acme" } } },
      desktop: { output: "hologram", characters: { max: { ttsProvider: null, legacyVoiceId: "x" } } },
    });
    expect(value.smartphone).toEqual({
      output: "voice",
      avatarProvider: "anam",
      characters: { max: { ttsProvider: "elevenlabs", legacyVoiceId: "" }, emma: own },
    });
    // A kept voice without an engine means nothing: dropped.
    expect(value.desktop).toEqual({ ...deviceServicesDefaults.desktop });
    expect(value.tablet).toEqual(deviceServicesDefaults.tablet);
  });

  it("migrates the former format without loss: shared engine for Max and Emma, typed IDs kept", () => {
    const legacy = {
      smartphone: { output: "voice", avatarProvider: null, ttsProvider: "elevenlabs", voiceIds: { max: "  e-max  ", emma: "" } },
      tablet: { output: "avatar", avatarProvider: "anam", ttsProvider: null, voiceIds: { max: "ignored", emma: "" } },
    };
    expect(isLegacyDeviceServices(legacy)).toBe(true);
    const value = normalizeDeviceServices(legacy);
    expect(value.smartphone.characters).toEqual({
      max: { ttsProvider: "elevenlabs", legacyVoiceId: "e-max" },
      emma: { ttsProvider: "elevenlabs", legacyVoiceId: "" },
    });
    expect(value.tablet).toEqual({ output: "avatar", avatarProvider: "anam", characters: { max: own, emma: own } });
    expect(value.desktop).toEqual(deviceServicesDefaults.desktop);

    // Same voices played before and after the migration (Max's typed ID, Emma's own when she uses that engine).
    const max = { ttsProvider: "gradium", ttsVoiceId: "g-max" };
    const emma = { ttsProvider: "elevenlabs", ttsVoiceId: "e-emma" };
    expect(resolveDeviceVoice(max, "max", value.smartphone, {})).toEqual({ ttsProvider: "elevenlabs", ttsVoiceId: "e-max" });
    expect(resolveDeviceVoice(emma, "emma", value.smartphone, {})).toEqual({ ttsProvider: "elevenlabs", ttsVoiceId: "e-emma" });

    // Saved form is the new format, read back identically.
    const stored = serializeDeviceServices(value);
    expect(stored.version).toBe(2);
    expect(isLegacyDeviceServices(stored)).toBe(false);
    expect(normalizeDeviceServices(JSON.parse(JSON.stringify(stored)))).toEqual(value);
  });

  it("flags kept IDs that differ from the catalogue and drops those that match", () => {
    const value = normalizeDeviceServices({
      smartphone: { output: "voice", ttsProvider: "elevenlabs", voiceIds: { max: "e-max", emma: "e-emma" } },
    });
    const catalogue = { max: { elevenlabs: "e-cat" }, emma: { elevenlabs: "e-emma" } };
    expect(legacyVoiceConflicts(value, catalogue)).toEqual([
      { device: "smartphone", character: "max", engine: "elevenlabs", legacyVoiceId: "e-max", catalogueVoiceId: "e-cat" },
    ]);
    const cleaned = dropRedundantLegacyVoices(value, catalogue);
    expect(cleaned.smartphone.characters.max.legacyVoiceId).toBe("e-max");
    expect(cleaned.smartphone.characters.emma.legacyVoiceId).toBe("");
  });
});

describe("resolveDeviceVoice", () => {
  const max = { ttsProvider: "gradium", ttsVoiceId: "g-max", portraitUrl: "p" };
  const withMax = (ttsProvider: DeviceServiceSettings["characters"]["max"]["ttsProvider"], legacyVoiceId = ""): DeviceServiceSettings =>
    ({ ...base, characters: { ...base.characters, max: { ttsProvider, legacyVoiceId } } });

  it("keeps the character's voice when the device chose no engine for it", () => {
    expect(resolveDeviceVoice(max, "max", base, { max: { elevenlabs: "e-cat" } })).toBe(max);
  });

  it("uses the catalogue voice of the character for the chosen engine", () => {
    expect(resolveDeviceVoice(max, "max", withMax("elevenlabs"), { max: { elevenlabs: "e-cat" } }))
      .toEqual({ ...max, ttsProvider: "elevenlabs", ttsVoiceId: "e-cat" });
  });

  it("a voice ID kept from the former format wins over the catalogue", () => {
    expect(resolveDeviceVoice(max, "max", withMax("elevenlabs", "e-old"), { max: { elevenlabs: "e-cat" } }))
      .toEqual({ ...max, ttsProvider: "elevenlabs", ttsVoiceId: "e-old" });
  });

  it("keeps the character's voice when it already uses that engine and the catalogue has none", () => {
    expect(resolveDeviceVoice(max, "max", withMax("gradium"), {}))
      .toEqual({ ...max, ttsProvider: "gradium", ttsVoiceId: "g-max" });
  });

  it("falls back to the engine's default voice otherwise, and leaves Emma untouched", () => {
    expect(resolveDeviceVoice(max, "max", withMax("cartesia"), {}))
      .toEqual({ ...max, ttsProvider: "cartesia", ttsVoiceId: null });
    expect(resolveDeviceVoice(max, "emma", withMax("cartesia"), {})).toBe(max);
  });
});
