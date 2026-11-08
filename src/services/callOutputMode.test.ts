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

describe("conversationLayoutFor", () => {
  it("shows the call screen on smartphones only", () => {
    expect(conversationLayoutFor("smartphone")).toBe("call");
    expect(conversationLayoutFor("tablet")).toBe("video");
    expect(conversationLayoutFor("desktop")).toBe("video");
  });
});

describe("touchFirstFor", () => {
  it("is on for touch devices and off for desktop", () => {
    expect(touchFirstFor("tablet")).toBe(true);
    expect(touchFirstFor("smartphone")).toBe(true);
    expect(touchFirstFor("desktop")).toBe(false);
  });
});
