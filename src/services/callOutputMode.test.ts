import { describe, expect, it } from "vitest";
import { conversationLayoutFor, resolveCallOutputMode, touchFirstFor } from "./callOutputMode";

describe("resolveCallOutputMode", () => {
  it.each(["streaming_avatar", "tts"] as const)("keeps a smartphone voice-only even when the setting is %s", (configuredMode) => {
    for (const startingCharacter of ["max", "emma"] as const) {
      expect(resolveCallOutputMode({ startingCharacter, configuredMode, deviceClass: "smartphone" }))
        .toEqual({ mode: "tts", reason: "device_smartphone" });
    }
  });

  it.each(["tablet", "desktop"] as const)("keeps the configured mode for Max on %s", (deviceClass) => {
    expect(resolveCallOutputMode({ startingCharacter: "max", configuredMode: "streaming_avatar", deviceClass }))
      .toEqual({ mode: "streaming_avatar", reason: "settings" });
    expect(resolveCallOutputMode({ startingCharacter: "max", configuredMode: "tts", deviceClass }))
      .toEqual({ mode: "tts", reason: "settings" });
  });

  it.each(["tablet", "desktop"] as const)("starts Emma voice-only on %s, as before", (deviceClass) => {
    expect(resolveCallOutputMode({ startingCharacter: "emma", configuredMode: "streaming_avatar", deviceClass }))
      .toEqual({ mode: "tts", reason: "character_voice_only" });
  });
});

describe("resolveCallOutputMode with a device choice", () => {
  it("connects the avatar on a smartphone set to avatar, for Max only", () => {
    expect(resolveCallOutputMode({ startingCharacter: "max", configuredMode: "tts", deviceClass: "smartphone", deviceOutput: "avatar" }))
      .toEqual({ mode: "streaming_avatar", reason: "device_settings" });
    expect(resolveCallOutputMode({ startingCharacter: "emma", configuredMode: "tts", deviceClass: "smartphone", deviceOutput: "avatar" }))
      .toEqual({ mode: "tts", reason: "character_voice_only" });
  });

  it("puts a desktop set to voice in a voice call whatever the switch says", () => {
    expect(resolveCallOutputMode({ startingCharacter: "max", configuredMode: "streaming_avatar", deviceClass: "desktop", deviceOutput: "voice" }))
      .toEqual({ mode: "tts", reason: "device_settings" });
  });

  it("follows the switch when the device says settings, even on a smartphone", () => {
    expect(resolveCallOutputMode({ startingCharacter: "max", configuredMode: "streaming_avatar", deviceClass: "smartphone", deviceOutput: "settings" }))
      .toEqual({ mode: "streaming_avatar", reason: "settings" });
  });
});

describe("conversationLayoutFor", () => {
  it("shows the call screen on smartphones only", () => {
    expect(conversationLayoutFor("smartphone")).toBe("call");
    expect(conversationLayoutFor("smartphone", "tts")).toBe("call");
    expect(conversationLayoutFor("tablet")).toBe("video");
    expect(conversationLayoutFor("desktop")).toBe("video");
  });

  it("shows the video screen on a smartphone using the live avatar", () => {
    expect(conversationLayoutFor("smartphone", "streaming_avatar")).toBe("video");
  });
});

describe("touchFirstFor", () => {
  it("is on for touch devices and off for desktop", () => {
    expect(touchFirstFor("tablet")).toBe(true);
    expect(touchFirstFor("smartphone")).toBe(true);
    expect(touchFirstFor("desktop")).toBe(false);
  });
});
