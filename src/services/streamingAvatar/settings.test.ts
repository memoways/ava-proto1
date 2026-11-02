import { describe, expect, it } from "vitest";
import { normalizeStreamingAvatarSettings, streamingAvatarDefaults } from "./settings";
import type { StreamingAvatarSettings } from "./types";

const normalize = (value: unknown) =>
  normalizeStreamingAvatarSettings(value as Partial<StreamingAvatarSettings>);

describe("streaming avatar settings normalization", () => {
  it("reads settings saved before AV1 without losing anything", () => {
    const stored = {
      activeProvider: "tavus",
      connectionTimeoutMs: 15_000,
      fallbackTimeoutMs: 4_000,
      heygen: { avatarId: "avatar", voiceId: "voice", contextId: "ctx", language: "fr", quality: "medium", sandbox: false },
      tavus: { replicaId: "face", personaId: "pal", language: "French", maxDurationSeconds: 600, emotion: "anger", listeningEmotion: "sadness" },
    };
    const value = normalize(stored);
    expect(value.activeProvider).toBe("tavus");
    expect(value.connectionTimeoutMs).toBe(15_000);
    expect(value.heygen).toMatchObject({ avatarId: "avatar", voiceId: "voice", contextId: "ctx", quality: "medium", sandbox: false });
    expect(value.heygen.encoding).toBe("H264");
    expect(value.heygen.maxSessionDurationSeconds).toBe(0);
    expect(value.heygen.voiceSettings.engine).toBe("default");
    expect(value.tavus).toMatchObject({
      replicaId: "face",
      personaId: "pal",
      languages: ["fr"],
      maxDurationSeconds: 600,
      participantAbsentTimeoutSeconds: 120,
      participantLeftTimeoutSeconds: 30,
      enableClosedCaptions: false,
      applyGreenscreen: false,
      euPolicy: false,
      emotion: "anger",
      listeningEmotion: "sadness",
    });
    expect(value.tavus).not.toHaveProperty("language");
  });

  it("returns an empty or broken JSON to the defaults", () => {
    expect(normalize({})).toEqual(streamingAvatarDefaults);
    expect(normalize({ heygen: "x", tavus: [1, 2] })).toEqual(streamingAvatarDefaults);
  });

  it("keeps known but not yet selectable providers off", () => {
    expect(normalize({ activeProvider: "anam" }).activeProvider).toBe("anam");
    expect(normalize({ activeProvider: "lemonslice" }).activeProvider).toBe("heygen");
    expect(normalize({ activeProvider: "tavus" }).activeProvider).toBe("tavus");
  });

  it("returns unknown or out of bounds fields to their default", () => {
    const value = normalize({
      heygen: {
        quality: "4k",
        encoding: "AV1",
        maxSessionDurationSeconds: 10_000,
        language: "fr; DROP",
        voiceSettings: { engine: "elevenLabs", elevenLabs: { model: "eleven_v4_turbo", stability: 7, speed: 0.9 } },
      },
      tavus: { maxDurationSeconds: 5, participantAbsentTimeoutSeconds: -1, participantLeftTimeoutSeconds: 9_999, emotion: "joy", languages: ["fr", "xx yy"] },
    });
    expect(value.heygen.quality).toBe("high");
    expect(value.heygen.encoding).toBe("H264");
    expect(value.heygen.maxSessionDurationSeconds).toBe(0);
    expect(value.heygen.language).toBe("fr");
    expect(value.heygen.voiceSettings.engine).toBe("elevenLabs");
    expect(value.heygen.voiceSettings.elevenLabs).toMatchObject({ model: "eleven_v4_turbo", stability: 0.75, speed: 0.9 });
    expect(value.tavus.maxDurationSeconds).toBe(900);
    expect(value.tavus.participantAbsentTimeoutSeconds).toBe(120);
    expect(value.tavus.participantLeftTimeoutSeconds).toBe(30);
    expect(value.tavus.emotion).toBe("sadness");
    expect(value.tavus.languages).toEqual(["fr"]);
  });

  it("keeps the values of every HeyGen voice engine when switching engine", () => {
    const value = normalize({
      heygen: { voiceSettings: { engine: "cartesia", fish: { model: "s1", speed: 1.1 }, cartesia: { speed: 0.7 } } },
    });
    expect(value.heygen.voiceSettings.fish).toMatchObject({ model: "s1", speed: 1.1 });
    expect(value.heygen.voiceSettings.cartesia.speed).toBe(0.7);
  });

  it("adds Anam defaults to settings saved before AV2 without touching HeyGen and Tavus", () => {
    const stored = {
      activeProvider: "tavus",
      heygen: { avatarId: "avatar", voiceId: "voice" },
      tavus: { replicaId: "face", personaId: "pal", languages: ["fr"], emotion: "sadness", listeningEmotion: "neutral" },
    };
    const value = normalize(stored);
    expect(value.heygen).toMatchObject({ avatarId: "avatar", voiceId: "voice" });
    expect(value.tavus).toMatchObject({ replicaId: "face", personaId: "pal", emotion: "sadness" });
    expect(value.anam).toEqual(streamingAvatarDefaults.anam);
    expect(value.anam).toMatchObject({
      avatarModel: "cara-4-latest",
      languageCode: "fr",
      speakingCue: "sad",
      directorNotes: { mode: "custom" },
      sessionOptions: { keepRecording: false, keepTranscripts: false },
    });
    expect(value.anam.directorNotes.customIdlingStylePrompt).toMatch(/Never smile/);
  });

  it("keeps saved Anam values and returns unknown or out of bounds ones to their default", () => {
    const value = normalize({
      anam: {
        avatarId: "a",
        avatarModel: "cara-9",
        speakingCue: "[sad]",
        maxSessionLengthSeconds: 99_999,
        directorNotes: { mode: "preset", presetStyle: "distressed", expressivity: 3, customStylePrompt: "x".repeat(2_001) },
        voiceGenerationOptions: { engine: "fish", fish: { speed: 1.5, volume: 9 }, cartesia: { emotion: "scared" } },
        sessionOptions: { region: "eu", regionPolicy: "strict", videoQuality: "4k" },
      },
    });
    expect(value.anam.avatarId).toBe("a");
    expect(value.anam.avatarModel).toBe("cara-4-latest");
    expect(value.anam.speakingCue).toBe("sad");
    expect(value.anam.maxSessionLengthSeconds).toBe(900);
    expect(value.anam.directorNotes).toMatchObject({ mode: "preset", presetStyle: "distressed", expressivity: 0.4 });
    expect(value.anam.directorNotes.customStylePrompt).toBe(streamingAvatarDefaults.anam.directorNotes.customStylePrompt);
    expect(value.anam.voiceGenerationOptions.fish).toEqual({ speed: 1.5, volume: 1 });
    expect(value.anam.voiceGenerationOptions.cartesia.emotion).toBe("scared");
    expect(value.anam.sessionOptions).toMatchObject({ region: "eu", regionPolicy: "strict", videoQuality: "high" });
  });
});
