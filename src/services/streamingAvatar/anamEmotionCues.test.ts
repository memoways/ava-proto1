import { describe, expect, it } from "vitest";
import {
  ANAM_CUE_TAGS,
  ANAM_DEFAULT_EMOTION_CUES,
  ANAM_PERFORMANCE_EMOTIONS,
  ANAM_SMILING_CUE_TAGS,
  anamCueForPerformance,
  buildAnamSessionTokenRequest,
  normalizeAnamEmotionCues,
  normalizeAnamSettings,
  resolveAnamSpeakingCue,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";
import { CANONICAL_EMOTIONS } from "../tts/performanceIntent";
import { normalizeStreamingAvatarSettings, streamingAvatarDefaults } from "./settings";

const ids = {
  avatarId: "30fa96d0-26c4-4e55-94a0-517025942e18",
  voiceId: "6bfbe25a-979d-40f3-a92b-5394170af54b",
};

describe("Anam emotion cue mapping (AN2)", () => {
  it("covers exactly the canonical acting emotions", () => {
    expect([...ANAM_PERFORMANCE_EMOTIONS].sort()).toEqual([...CANONICAL_EMOTIONS].sort());
  });

  it("maps every canonical emotion to the agreed default cue", () => {
    const expected = {
      neutral: "none",
      tense: "concerned",
      angry: "angry",
      accusatory: "angry",
      sad: "sad",
      fragile: "sad",
      scared: "distressed",
      urgent: "distressed",
      warm: "concerned",
      sarcastic: "none",
    };
    for (const emotion of ANAM_PERFORMANCE_EMOTIONS) {
      expect(anamCueForPerformance({ emotion }, ANAM_DEFAULT_EMOTION_CUES)).toBe(expected[emotion]);
      expect(anamCueForPerformance({ emotion }, undefined)).toBe(expected[emotion]);
    }
  });

  it("never smiles by default", () => {
    for (const cue of Object.values(ANAM_DEFAULT_EMOTION_CUES)) {
      expect(ANAM_SMILING_CUE_TAGS).not.toContain(cue);
    }
    expect(ANAM_SMILING_CUE_TAGS).toEqual(["playful", "happy", "laughter"]);
    for (const table of Object.values(normalizeAnamSettings(undefined).emotionCues)) {
      expect(Object.values(table).some((cue) => ANAM_SMILING_CUE_TAGS.includes(cue))).toBe(false);
    }
  });

  it("follows an edited table and falls back per emotion on an invalid cue", () => {
    const mapping = { ...ANAM_DEFAULT_EMOTION_CUES, warm: "supportive" as const, sad: "[sad]" as never };
    expect(anamCueForPerformance({ emotion: "warm" }, mapping)).toBe("supportive");
    expect(anamCueForPerformance({ emotion: "sad" }, mapping)).toBe("sad");
  });

  it("returns null without a usable intent", () => {
    expect(anamCueForPerformance(undefined, ANAM_DEFAULT_EMOTION_CUES)).toBeNull();
    expect(anamCueForPerformance(null, ANAM_DEFAULT_EMOTION_CUES)).toBeNull();
    expect(anamCueForPerformance({ emotion: "joyful" }, ANAM_DEFAULT_EMOTION_CUES)).toBeNull();
  });

  it("evolving: follows the intent, falls back to the fixed cue without one", () => {
    const settings = normalizeAnamSettings({ speakingCue: "distressed" });
    expect(settings.emotionCueMode).toBe("evolving");
    expect(resolveAnamSpeakingCue(settings, { emotion: "tense" }, "max")).toEqual({ cue: "concerned", origin: "intent" });
    expect(resolveAnamSpeakingCue(settings, { emotion: "neutral" }, "max")).toEqual({ cue: "none", origin: "intent" });
    expect(resolveAnamSpeakingCue(settings, undefined, "max")).toEqual({ cue: "distressed", origin: "fallback" });
    // Unknown character: the default table.
    expect(resolveAnamSpeakingCue(settings, { emotion: "fragile" }, "leo")).toEqual({ cue: "sad", origin: "intent" });
    expect(resolveAnamSpeakingCue(settings, { emotion: "fragile" }, null)).toEqual({ cue: "sad", origin: "intent" });
  });

  it("fixed: keeps the pre-AN2 behaviour, whatever the intent", () => {
    const settings = normalizeAnamSettings({ speakingCue: "sad", emotionCueMode: "fixed" });
    expect(resolveAnamSpeakingCue(settings, { emotion: "angry" }, "max")).toEqual({ cue: "sad", origin: "fixed" });
    expect(resolveAnamSpeakingCue(settings, undefined, "max")).toEqual({ cue: "sad", origin: "fixed" });
  });

  it("uses each character's own table", () => {
    const settings = normalizeAnamSettings({ emotionCues: { emma: { tense: "distressed" } } });
    expect(resolveAnamSpeakingCue(settings, { emotion: "tense" }, "emma").cue).toBe("distressed");
    expect(resolveAnamSpeakingCue(settings, { emotion: "tense" }, "max").cue).toBe("concerned");
  });
});

describe("Anam emotion cue settings", () => {
  it("reads AN1 settings without loss: evolving by default, saved fixed cue kept as fallback", () => {
    const saved = { ...ids, avatarModel: "cara-4.1-express", speakingCue: "distressed", directorNotes: { mode: "custom", expressivity: 0.2 } };
    const value = normalizeStreamingAvatarSettings({ anam: saved } as never).anam;
    expect(value).toMatchObject({ ...ids, avatarModel: "cara-4.1-express", speakingCue: "distressed", emotionCueMode: "evolving" });
    expect(value.directorNotes.expressivity).toBe(0.2);
    expect(Object.keys(value.emotionCues)).toEqual(["max", "emma"]);
    expect(value.emotionCues.max).toEqual(ANAM_DEFAULT_EMOTION_CUES);
    expect(streamingAvatarDefaults.anam.emotionCueMode).toBe("evolving");
  });

  it("keeps a saved table, completes it and drops unknown entries", () => {
    const cues = normalizeAnamEmotionCues({
      max: { warm: "supportive", angry: "furious", joy: "happy" },
      leo: { sad: "distressed" },
      "../bad key": { sad: "sad" },
      emma: "nope",
    });
    expect(Object.keys(cues)).toEqual(["max", "emma", "leo"]);
    expect(cues.max).toEqual({ ...ANAM_DEFAULT_EMOTION_CUES, warm: "supportive" });
    expect(cues.max).not.toHaveProperty("joy");
    expect(cues.emma).toEqual(ANAM_DEFAULT_EMOTION_CUES);
    expect(cues.leo.sad).toBe("distressed");
    for (const table of Object.values(cues)) {
      for (const cue of Object.values(table)) expect(ANAM_CUE_TAGS).toContain(cue);
    }
  });

  it("returns an unknown mode to evolving", () => {
    expect(normalizeAnamSettings({ emotionCueMode: "random" }).emotionCueMode).toBe("evolving");
  });

  it("never sends the cue table to Anam", () => {
    const result = buildAnamSessionTokenRequest({ ...ids, emotionCues: { max: { warm: "happy" } }, emotionCueMode: "evolving" });
    if (!("body" in result)) throw new Error("Anam token request refused");
    const body = JSON.stringify(result.body);
    expect(body).not.toContain("emotionCue");
    expect(body).not.toContain("happy");
  });
});
