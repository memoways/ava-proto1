import { describe, expect, it } from "vitest";
import { describeNextCall, leavesAvatarRoom, resolveCallVideo, type CallVideoInput } from "./callVideoRouting";
import { streamingAvatarDefaults } from "./streamingAvatar/settings";
import type { CharacterVideoLink, StreamingAvatarSettings } from "./streamingAvatar/types";

const sonia: CharacterVideoLink = { provider: "nuance", personaId: "sonia", expressiveness: 1.4, drive: "verbatim" };

function linked(links: Record<string, CharacterVideoLink>): StreamingAvatarSettings {
  return { ...streamingAvatarDefaults, characterLinks: links };
}

function input(patch: Partial<CallVideoInput> = {}): CallVideoInput {
  return {
    character: "max",
    configuredMode: "streaming_avatar",
    deviceClass: "tablet",
    deviceServices: { output: "settings", avatarProvider: null },
    avatar: streamingAvatarDefaults,
    ...patch,
  };
}

describe("resolveCallVideo without a link", () => {
  it("keeps today's mode and provider for Max", () => {
    const decision = resolveCallVideo(input());
    expect(decision).toMatchObject({ mode: "streaming_avatar", reason: "settings" });
    expect(decision.avatar).toBe(streamingAvatarDefaults);
    expect(resolveCallVideo(input({ configuredMode: "tts" }))).toMatchObject({ mode: "tts", reason: "settings" });
  });

  it("uses the device provider for Max", () => {
    const decision = resolveCallVideo(input({ deviceServices: { output: "avatar", avatarProvider: "tavus" } }));
    expect(decision).toMatchObject({ mode: "streaming_avatar", reason: "device_settings" });
    expect(decision.avatar.activeProvider).toBe("tavus");
  });

  it("keeps Emma voice-only, also when only Max is linked", () => {
    expect(resolveCallVideo(input({ character: "emma", avatar: linked({ max: sonia }) })))
      .toMatchObject({ mode: "tts", reason: "character_voice_only" });
  });
});

describe("resolveCallVideo with a link", () => {
  it("opens Emma's Nuance persona on a tablet with the global switch on video", () => {
    const decision = resolveCallVideo(input({ character: "emma", avatar: linked({ emma: sonia }) }));
    expect(decision).toMatchObject({ mode: "streaming_avatar", reason: "character_link" });
    expect(decision.avatar.activeProvider).toBe("nuance");
    expect(decision.avatar.nuance).toMatchObject({ personaId: "sonia", expressiveness: 1.4, drive: "verbatim" });
  });

  it("wins over the provider fixed on the device", () => {
    const decision = resolveCallVideo(input({
      avatar: linked({ max: sonia }),
      deviceServices: { output: "avatar", avatarProvider: "heygen" },
    }));
    expect(decision.reason).toBe("character_link");
    expect(decision.avatar.activeProvider).toBe("nuance");
  });

  it("never sends the character prompt to Nuance", () => {
    const decision = resolveCallVideo(input({ avatar: linked({ max: sonia }) }));
    expect(decision.avatar.nuance.systemPrompt).toBe(streamingAvatarDefaults.nuance.systemPrompt);
  });

  it.each([
    ["smartphone", "voice", "device_smartphone"],
    ["desktop", "voice", "device_settings"],
  ] as const)("stays voice-only on a %s set to voice", (deviceClass, output, reason) => {
    const decision = resolveCallVideo(input({
      character: "emma", deviceClass, avatar: linked({ emma: sonia }),
      deviceServices: { output, avatarProvider: null },
    }));
    expect(decision).toMatchObject({ mode: "tts", reason });
  });

  it("applies the same rule to a later character (Léo)", () => {
    expect(resolveCallVideo(input({ character: "leo", avatar: linked({ leo: { provider: "tavus" } }) })))
      .toMatchObject({ mode: "streaming_avatar", reason: "character_link" });
  });
});

describe("resolveCallVideo with the global switch on voice (27 November)", () => {
  it("stays voice-only even with Max's Tavus link", () => {
    const decision = resolveCallVideo(input({ configuredMode: "tts", avatar: linked({ max: { provider: "tavus" } }) }));
    expect(decision).toMatchObject({ mode: "tts", reason: "settings" });
    expect(decision.avatar.activeProvider).toBe(streamingAvatarDefaults.activeProvider);
  });

  it("stays voice-only for Emma's Nuance link", () => {
    expect(resolveCallVideo(input({ character: "emma", configuredMode: "tts", avatar: linked({ emma: sonia }) })))
      .toMatchObject({ mode: "tts", reason: "settings" });
  });

  it("keeps a device explicitly set to the live avatar on its own choice", () => {
    const decision = resolveCallVideo(input({
      configuredMode: "tts",
      avatar: linked({ max: { provider: "tavus" } }),
      deviceServices: { output: "avatar", avatarProvider: null },
    }));
    expect(decision).toMatchObject({ mode: "streaming_avatar", reason: "character_link" });
  });
});

describe("resolveCallVideo with « Pas de vidéo »", () => {
  it("gives Max a voice-only call while the global switch is on video", () => {
    const decision = resolveCallVideo(input({ avatar: linked({ max: { provider: "none" } }) }));
    expect(decision).toMatchObject({ mode: "tts", reason: "character_no_video" });
  });

  it("wins over a device set to the live avatar", () => {
    expect(resolveCallVideo(input({
      avatar: linked({ max: { provider: "none" } }),
      deviceServices: { output: "avatar", avatarProvider: "tavus" },
    }))).toMatchObject({ mode: "tts", reason: "character_no_video" });
  });

  it("leaves the other characters' links alone", () => {
    const avatar = linked({ max: { provider: "none" }, emma: sonia });
    expect(resolveCallVideo(input({ character: "emma", avatar }))).toMatchObject({ mode: "streaming_avatar", reason: "character_link" });
  });
});

describe("describeNextCall", () => {
  it.each([
    [input({ avatar: linked({ max: { provider: "tavus" } }) }), "Vidéo Tavus"],
    [input({ configuredMode: "tts", avatar: linked({ max: { provider: "tavus" } }) }), "Voix seule, car le réglage global est sur Voix"],
    [input({ avatar: linked({ max: { provider: "none" } }) }), "Voix seule, choisie pour ce personnage"],
    [input({ character: "emma" }), "Voix seule : sans service vidéo propre, seul Max suit le réglage global"],
  ])("says what the next call gives (%#)", (value, label) => {
    expect(describeNextCall(value)).toBe(label);
  });
});

describe("leavesAvatarRoom", () => {
  it.each([["emma", "max"], ["max", "emma"]])("drops to voice from %s's room to %s", (room, target) => {
    expect(leavesAvatarRoom("streaming_avatar", room, target)).toBe(true);
  });

  it("keeps the room for its own character and ignores a voice call", () => {
    expect(leavesAvatarRoom("streaming_avatar", "emma", "emma")).toBe(false);
    expect(leavesAvatarRoom("tts", "emma", "max")).toBe(false);
    expect(leavesAvatarRoom(undefined, "max", "emma")).toBe(false);
  });
});
