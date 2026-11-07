import { describe, expect, it } from "vitest";
import { normalizeStreamingAvatarSettings, resolveTavusCharacterSettings, streamingAvatarDefaults } from "./settings";
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

  it("selects every known provider and returns unknown ones to HeyGen", () => {
    expect(normalize({ activeProvider: "anam" }).activeProvider).toBe("anam");
    expect(normalize({ activeProvider: "lemonslice" }).activeProvider).toBe("lemonslice");
    expect(normalize({ activeProvider: "d-id" }).activeProvider).toBe("heygen");
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
      avatarModel: "cara-4.1-express",
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
    expect(value.anam.avatarModel).toBe("cara-4.1-express");
    expect(value.anam.speakingCue).toBe("sad");
    expect(value.anam.maxSessionLengthSeconds).toBe(900);
    expect(value.anam.directorNotes).toMatchObject({ mode: "preset", presetStyle: "distressed", expressivity: 0.4 });
    expect(value.anam.directorNotes.customStylePrompt).toBe(streamingAvatarDefaults.anam.directorNotes.customStylePrompt);
    expect(value.anam.voiceGenerationOptions.fish).toEqual({ speed: 1.5, volume: 1 });
    expect(value.anam.voiceGenerationOptions.cartesia.emotion).toBe("scared");
    expect(value.anam.sessionOptions).toMatchObject({ region: "eu", regionPolicy: "strict", videoQuality: "high" });
  });

  it("reads the Anam lip sync mode: opening calibration by default, bounded manual shift", () => {
    expect(normalize({ anam: {} }).anam.lipSync).toEqual({ mode: "initial", manualShiftMs: 0 });
    expect(normalize({ anam: { lipSync: { mode: "auto" } } }).anam.lipSync.mode).toBe("auto");
    expect(normalize({ anam: { lipSync: { mode: "manual", manualShiftMs: 640.4 } } }).anam.lipSync).toEqual({ mode: "manual", manualShiftMs: 640 });
    expect(normalize({ anam: { lipSync: { mode: "browser", manualShiftMs: -1_200 } } }).anam.lipSync).toEqual({ mode: "browser", manualShiftMs: -1_200 });
    expect(normalize({ anam: { lipSync: { mode: "magic", manualShiftMs: 9_999 } } }).anam.lipSync).toEqual({ mode: "initial", manualShiftMs: 0 });
  });
});

describe("LemonSlice settings normalization", () => {
  it("reads AV2 settings (no lemonslice block) with the dejected defaults", () => {
    const value = normalize({ activeProvider: "anam", anam: { avatarId: "a" } });
    expect(value.lemonslice).toEqual(streamingAvatarDefaults.lemonslice);
    expect(value.lemonslice.agentPrompt).toMatch(/never smiling/);
    expect(value.lemonslice.agentIdlePrompt).toMatch(/never smiling/);
    expect(value.lemonslice).toMatchObject({ model: "default", audioSampleRate: 16_000, aspectRatio: "2x3", idleTimeoutSeconds: 300 });
  });

  it("keeps saved LemonSlice values and returns unknown ones to their default", () => {
    const value = normalize({
      lemonslice: {
        agentId: "agent_1", model: "cwm-1", audioSampleRate: 24_000, idleTimeoutSeconds: 120,
        aspectRatio: "9x16", editImage: "on", editImageVariant: "portrait", listenAction: true,
        agentPrompt: "a tired man",
      },
    });
    expect(value.lemonslice).toMatchObject({
      agentId: "agent_1", model: "cwm-1", audioSampleRate: 24_000, idleTimeoutSeconds: 120,
      aspectRatio: "9x16", editImage: "on", editImageVariant: "portrait", listenAction: true,
      agentPrompt: "a tired man",
    });
    const broken = normalize({
      lemonslice: { model: "ultra", audioSampleRate: 44_100, idleTimeoutSeconds: -1, aspectRatio: "16x9", agentPrompt: "x".repeat(1_001) },
    });
    expect(broken.lemonslice).toMatchObject({ model: "default", audioSampleRate: 16_000, idleTimeoutSeconds: 300, aspectRatio: "2x3" });
    expect(broken.lemonslice.agentPrompt).toBe(streamingAvatarDefaults.lemonslice.agentPrompt);
  });
});

describe("Tavus Echo tag and per-character settings (lot 1)", () => {
  it("defaults to dejected with empty Max and Emma overrides", () => {
    expect(streamingAvatarDefaults.tavus.echoEmotion).toBe("dejected");
    expect(normalize({}).tavus.characters).toEqual({ max: {}, emma: {} });
  });

  it("derives the Echo tag from the speaking emotion for settings saved before lot 1", () => {
    expect(normalize({ tavus: { emotion: "sadness" } }).tavus.echoEmotion).toBe("dejected");
    expect(normalize({ tavus: { emotion: "neutral" } }).tavus.echoEmotion).toBe("neutral");
    expect(normalize({ tavus: { emotion: "happiness" } }).tavus.echoEmotion).toBe("content");
    expect(normalize({ tavus: { emotion: "joy" } }).tavus.echoEmotion).toBe("dejected");
  });

  it("keeps a chosen Echo value independent from set_emotion and resets unknown ones", () => {
    const chosen = normalize({ tavus: { emotion: "neutral", echoEmotion: "sad" } }).tavus;
    expect(chosen).toMatchObject({ emotion: "neutral", echoEmotion: "sad" });
    expect(normalize({ tavus: { emotion: "neutral", echoEmotion: "sadness" } }).tavus.echoEmotion).toBe("dejected");
    expect(normalize({ tavus: { echoEmotion: "joyful" } }).tavus.echoEmotion).toBe("dejected");
  });

  it("normalizes overrides: valid fields kept, invalid or empty ones dropped", () => {
    const value = normalize({
      tavus: {
        characters: {
          max: { faceId: "  r-max  ", echoEmotion: "neutral", emotion: "anger", listeningEmotion: "joy" },
          emma: { faceId: "", echoEmotion: "happy" },
          "Bad Key": { faceId: "x" },
          leo: { faceId: "r-leo" },
          broken: "x",
        },
      },
    }).tavus.characters;
    expect(value.max).toEqual({ faceId: "r-max", echoEmotion: "neutral", emotion: "anger" });
    expect(value.emma).toEqual({});
    expect(value.leo).toEqual({ faceId: "r-leo" });
    expect(value.broken).toEqual({});
    expect(value).not.toHaveProperty("Bad Key");
    expect(normalize({ tavus: { characters: [1] } }).tavus.characters).toEqual({ max: {}, emma: {} });
  });

  it("resolves a character: each set override wins, the rest stays global", () => {
    const tavus = normalize({
      tavus: {
        replicaId: "r-global", emotion: "sadness", listeningEmotion: "neutral", echoEmotion: "dejected",
        characters: { max: { faceId: "r-max", listeningEmotion: "contempt" }, emma: { echoEmotion: "sad" } },
      },
    }).tavus;
    expect(resolveTavusCharacterSettings(tavus, "max")).toEqual({
      faceId: "r-max", echoEmotion: "dejected", emotion: "sadness", listeningEmotion: "contempt", voiceSource: "ava",
    });
    expect(resolveTavusCharacterSettings(tavus, "emma")).toEqual({
      faceId: "r-global", echoEmotion: "sad", emotion: "sadness", listeningEmotion: "neutral", voiceSource: "ava",
    });
    const global = { faceId: "r-global", echoEmotion: "dejected", emotion: "sadness", listeningEmotion: "neutral", voiceSource: "ava" };
    expect(resolveTavusCharacterSettings(tavus)).toEqual(global);
    expect(resolveTavusCharacterSettings(tavus, "leo")).toEqual(global);
  });

  it("resolves global values for a settings object without the characters table", () => {
    const legacy = { ...streamingAvatarDefaults.tavus, replicaId: "r" } as Partial<typeof streamingAvatarDefaults.tavus>;
    delete legacy.characters;
    expect(resolveTavusCharacterSettings(legacy as typeof streamingAvatarDefaults.tavus, "max").faceId).toBe("r");
  });
});

describe("Tavus voice source (Ava audio or PAL voice)", () => {
  it("defaults to Ava's audio, including for JSON saved before the field existed", () => {
    expect(streamingAvatarDefaults.tavus.voiceSource).toBe("ava");
    const legacy = normalize({
      tavus: { replicaId: "r", personaId: "pipecat0", emotion: "sadness", echoEmotion: "dejected", characters: { max: {}, emma: {} } },
    }).tavus;
    expect(legacy.voiceSource).toBe("ava");
    expect(legacy).toMatchObject({ replicaId: "r", personaId: "pipecat0", echoEmotion: "dejected" });
    expect(legacy.characters).toEqual({ max: {}, emma: {} });
  });

  it("keeps a saved global source and per-character overrides, drops unknown values", () => {
    const tavus = normalize({
      tavus: {
        voiceSource: "tavus",
        characters: { max: { voiceSource: "ava" }, emma: { voiceSource: "robot" } },
      },
    }).tavus;
    expect(tavus.voiceSource).toBe("tavus");
    expect(tavus.characters.max).toEqual({ voiceSource: "ava" });
    expect(tavus.characters.emma).toEqual({});
    expect(resolveTavusCharacterSettings(tavus, "max").voiceSource).toBe("ava");
    expect(resolveTavusCharacterSettings(tavus, "emma").voiceSource).toBe("tavus");
    expect(resolveTavusCharacterSettings(tavus).voiceSource).toBe("tavus");
    expect(normalize({ tavus: { voiceSource: 42 } }).tavus.voiceSource).toBe("ava");
  });
});
