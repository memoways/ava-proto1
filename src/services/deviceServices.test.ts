import { describe, expect, it } from "vitest";
import { deviceServicesDefaults, normalizeDeviceServices, resolveDeviceVoice } from "./deviceServices";

const base = { output: "settings" as const, avatarProvider: null, ttsProvider: null, voiceIds: { max: "", emma: "" } };

describe("normalizeDeviceServices", () => {
  it("keeps today's behaviour by default", () => {
    expect(normalizeDeviceServices(undefined)).toEqual(deviceServicesDefaults);
    expect(deviceServicesDefaults.smartphone.output).toBe("voice");
    expect(deviceServicesDefaults.tablet.output).toBe("settings");
    expect(deviceServicesDefaults.desktop.output).toBe("settings");
  });

  it("drops unknown values and trims voices", () => {
    const value = normalizeDeviceServices({
      smartphone: { output: "hologram", avatarProvider: "anam", ttsProvider: "elevenlabs", voiceIds: { max: "  abc  ", emma: 3 } },
      desktop: { output: "avatar", avatarProvider: "nope", ttsProvider: "acme" },
    });
    expect(value.smartphone).toEqual({ output: "voice", avatarProvider: "anam", ttsProvider: "elevenlabs", voiceIds: { max: "abc", emma: "" } });
    expect(value.desktop).toEqual({ output: "avatar", avatarProvider: null, ttsProvider: null, voiceIds: { max: "", emma: "" } });
    expect(value.tablet).toEqual(deviceServicesDefaults.tablet);
  });
});

describe("resolveDeviceVoice", () => {
  const max = { ttsProvider: "gradium", ttsVoiceId: "g-max", portraitUrl: "p" };

  it("keeps the character's voice when the device chose no engine", () => {
    expect(resolveDeviceVoice(max, "max", base)).toBe(max);
  });

  it("uses the device voice for the chosen engine", () => {
    expect(resolveDeviceVoice(max, "max", { ...base, ttsProvider: "elevenlabs", voiceIds: { max: "e-max", emma: "" } }))
      .toEqual({ ...max, ttsProvider: "elevenlabs", ttsVoiceId: "e-max" });
  });

  it("keeps the character's voice when it already uses that engine", () => {
    expect(resolveDeviceVoice(max, "max", { ...base, ttsProvider: "gradium" }))
      .toEqual({ ...max, ttsProvider: "gradium", ttsVoiceId: "g-max" });
  });

  it("falls back to the engine's default voice otherwise", () => {
    expect(resolveDeviceVoice(max, "emma", { ...base, ttsProvider: "elevenlabs", voiceIds: { max: "e-max", emma: "" } }))
      .toEqual({ ...max, ttsProvider: "elevenlabs", ttsVoiceId: null });
  });
});
