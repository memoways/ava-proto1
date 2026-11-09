import { describe, expect, it } from "vitest";
import { describeEffectiveVoice, type EffectiveVoiceInput } from "./effectiveVoice";
import { resolveDeviceVoice, type DeviceServiceSettings } from "./deviceServices";
import { resolveCallOutputMode } from "./callOutputMode";
import { getTTSSettings } from "./settingsService";
import { getCartesiaSettings, getFishSettings, getGradiumSettings, getInworldSettings } from "./tts/providerSettings";
import { streamingAvatarDefaults } from "./streamingAvatar/settings";
import { DEVICE_CLASSES } from "./deviceClass";

const followSwitch: DeviceServiceSettings = {
  output: "settings",
  avatarProvider: null,
  characters: { max: { ttsProvider: null, legacyVoiceId: "" }, emma: { ttsProvider: null, legacyVoiceId: "" } },
};

/** Same engine for Max (with an optional kept voice ID) on this device. */
function maxEngine(engine: DeviceServiceSettings["characters"]["max"]["ttsProvider"], legacyVoiceId = ""): DeviceServiceSettings["characters"] {
  return { ...followSwitch.characters, max: { ttsProvider: engine, legacyVoiceId } };
}

function input(patch: Partial<EffectiveVoiceInput> = {}): EffectiveVoiceInput {
  return {
    device: "smartphone",
    character: "max",
    profile: { ttsProvider: "elevenlabs", ttsVoiceId: "VK9GO2Vntd9rcY7Tg6wl" },
    deviceServices: { ...followSwitch, output: "voice" },
    configuredOutput: "tts",
    avatar: streamingAvatarDefaults,
    activeProvider: "elevenlabs",
    catalogue: { max: { elevenlabs: "VK9GO2Vntd9rcY7Tg6wl" } },
    engines: {
      elevenlabs: { ...getTTSSettings(), modelId: "eleven_v4_turbo", stability: 0.38, style: 0.38, speed: 1 },
      gradium: getGradiumSettings(),
      fish: getFishSettings(),
      inworld: getInworldSettings(),
      cartesia: getCartesiaSettings(),
    },
    ...patch,
  };
}

describe("describeEffectiveVoice", () => {
  it("smartphone voice call: ElevenLabs model, main sliders and catalogue voice", () => {
    const voice = describeEffectiveVoice(input());
    expect(voice).toMatchObject({
      output: "tts", speaker: "ava", engine: "elevenlabs", model: "eleven_v4_turbo",
      voiceId: "VK9GO2Vntd9rcY7Tg6wl", voiceSource: "catalogue", avatarProvider: null,
    });
    expect(voice.summary).toBe("ElevenLabs · eleven_v4_turbo · stabilité 0,38 · style 0,38 · vitesse 1 · voix VK9G… (catalogue)");
  });

  it("names a profile voice missing from the catalogue as profile", () => {
    const voice = describeEffectiveVoice(input({ catalogue: {} }));
    expect(voice.voiceSource).toBe("profile");
    expect(voice.summary).toContain("(profil)");
  });

  it("device engine takes the catalogue voice of the character for that engine", () => {
    const voice = describeEffectiveVoice(input({
      deviceServices: { ...followSwitch, output: "voice", characters: maxEngine("gradium") },
      catalogue: { max: { gradium: "g-cat", elevenlabs: "VK9GO2Vntd9rcY7Tg6wl" } },
    }));
    expect(voice).toMatchObject({ engine: "gradium", voiceId: "g-cat", voiceSource: "catalogue", model: null });
    expect(voice.summary.startsWith("Gradium · température")).toBe(true);
  });

  it("a voice ID kept from the former format wins and is named", () => {
    const voice = describeEffectiveVoice(input({
      deviceServices: { ...followSwitch, output: "voice", characters: maxEngine("gradium", "g-dev") },
      catalogue: { max: { gradium: "g-cat" } },
    }));
    expect(voice).toMatchObject({ engine: "gradium", voiceId: "g-dev", voiceSource: "device" });
    expect(voice.summary).toContain("(ancien ID appareil)");
  });

  it("Emma keeps her own voice when only Max has a device engine", () => {
    const voice = describeEffectiveVoice(input({
      character: "emma",
      profile: { ttsProvider: "gradium", ttsVoiceId: "g-emma" },
      deviceServices: { ...followSwitch, output: "voice", characters: maxEngine("cartesia") },
    }));
    expect(voice).toMatchObject({ engine: "gradium", voiceId: "g-emma", voiceSource: "profile" });
  });

  it("device engine without a voice falls back to the engine's own voice", () => {
    const voice = describeEffectiveVoice(input({
      deviceServices: { ...followSwitch, output: "voice", characters: maxEngine("cartesia") },
    }));
    expect(voice).toMatchObject({ engine: "cartesia", voiceSource: "engine_default", voiceId: getCartesiaSettings().voiceId });
  });

  it("ElevenLabs without any voice says the engine default", () => {
    const voice = describeEffectiveVoice(input({ profile: null, catalogue: {} }));
    expect(voice).toMatchObject({ engine: "elevenlabs", voiceId: null, voiceSource: "engine_default" });
    expect(voice.summary).toContain("voix par défaut du moteur");
  });

  it("profile without an engine uses the TTS Config active engine", () => {
    const voice = describeEffectiveVoice(input({ profile: { ttsProvider: null, ttsVoiceId: null }, activeProvider: "fish" }));
    expect(voice.engine).toBe("fish");
  });

  it("Anam avatar: the avatar's own voice", () => {
    const voice = describeEffectiveVoice(input({
      device: "desktop", configuredOutput: "streaming_avatar", deviceServices: followSwitch,
      avatar: { ...streamingAvatarDefaults, activeProvider: "anam" },
    }));
    expect(voice).toMatchObject({ output: "streaming_avatar", avatarProvider: "anam", speaker: "avatar", voiceSource: "avatar" });
    expect(voice.summary).toBe("Anam · voix de l'avatar Anam");
  });

  it("HeyGen with ElevenLabs: HeyGen's ElevenLabs model and sliders", () => {
    const avatar = {
      ...streamingAvatarDefaults,
      heygen: {
        ...streamingAvatarDefaults.heygen,
        voiceId: "heygen-voice-123",
        voiceSettings: { ...streamingAvatarDefaults.heygen.voiceSettings, engine: "elevenLabs" as const },
      },
    };
    const voice = describeEffectiveVoice(input({ device: "tablet", configuredOutput: "streaming_avatar", deviceServices: followSwitch, avatar }));
    expect(voice).toMatchObject({ avatarProvider: "heygen", engine: "heygen:elevenlabs", model: "eleven_flash_v2_5", voiceId: "heygen-voice-123" });
    expect(voice.summary).toMatch(/^HeyGen · eleven_flash_v2_5 · stabilité .* · ElevenLabs via HeyGen · voix HeyGen heyg…$/);
  });

  it("Tavus with Ava's voice plays Ava's engine; with the Tavus source, the PAL voice", () => {
    const tavus = { ...streamingAvatarDefaults, activeProvider: "tavus" as const };
    const ava = describeEffectiveVoice(input({ device: "desktop", configuredOutput: "streaming_avatar", deviceServices: followSwitch, avatar: tavus }));
    expect(ava).toMatchObject({ avatarProvider: "tavus", speaker: "ava", engine: "elevenlabs" });
    expect(ava.summary.startsWith("Tavus · voix Ava : ElevenLabs · eleven_v4_turbo")).toBe(true);
    const pal = describeEffectiveVoice(input({
      device: "desktop", configuredOutput: "streaming_avatar", deviceServices: followSwitch,
      avatar: { ...tavus, tavus: { ...tavus.tavus, characters: { max: { voiceSource: "tavus" }, emma: {} } } },
    }));
    expect(pal).toMatchObject({ speaker: "avatar", voiceSource: "avatar" });
    expect(pal.summary).toBe("Tavus · voix de la source Tavus (PAL)");
  });

  it("device avatar provider overrides the Streaming Avatar provider", () => {
    const voice = describeEffectiveVoice(input({
      device: "desktop", configuredOutput: "tts", deviceServices: { ...followSwitch, output: "avatar", avatarProvider: "anam" },
    }));
    expect(voice.avatarProvider).toBe("anam");
  });

  it("Emma starts voice-only even when the avatar is configured", () => {
    const voice = describeEffectiveVoice(input({
      device: "desktop", character: "emma", configuredOutput: "streaming_avatar", deviceServices: followSwitch,
      profile: { ttsProvider: "gradium", ttsVoiceId: "g-emma" },
    }));
    expect(voice).toMatchObject({ output: "tts", outputReason: "character_voice_only", engine: "gradium", voiceId: "g-emma" });
  });

  it("matches the experience rules (resolveDeviceVoice and resolveCallOutputMode) on every combination", () => {
    const profiles = [null, { ttsProvider: "gradium", ttsVoiceId: "g-max" }, { ttsProvider: "elevenlabs", ttsVoiceId: null }];
    const services: DeviceServiceSettings[] = [
      followSwitch,
      { ...followSwitch, output: "voice", characters: maxEngine("elevenlabs", "e-max") },
      { ...followSwitch, output: "voice", characters: maxEngine("gradium") },
      { ...followSwitch, output: "voice", characters: maxEngine("fish") },
    ];
    const catalogues = [{}, { max: { gradium: "g-cat", fish: "f-cat" } }];
    for (const device of DEVICE_CLASSES) for (const profile of profiles) for (const deviceServices of services) for (const catalogue of catalogues) {
      const voice = describeEffectiveVoice(input({ device, profile, deviceServices, catalogue }));
      const played = resolveDeviceVoice(profile ?? { ttsProvider: null, ttsVoiceId: null }, "max", deviceServices, catalogue);
      const mode = resolveCallOutputMode({ startingCharacter: "max", configuredMode: "tts", deviceClass: device, deviceOutput: deviceServices.output });
      expect(voice.output).toBe(mode.mode);
      expect(voice.engine).toBe(played.ttsProvider ?? "elevenlabs");
      if (played.ttsVoiceId) expect(voice.voiceId).toBe(played.ttsVoiceId);
    }
  });
});
