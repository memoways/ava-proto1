import { describe, expect, it } from "vitest";
import { CANONICAL_EMOTIONS } from "@/services/tts/performanceIntent";
import { resolveTavusSpeakingEmotion, TAVUS_PERFORMANCE_EMOTIONS, tavusCueObservation } from "./tavusEmotionCues";
import { TAVUS_EMOTIONS } from "./types";

describe("Tavus face emotion from the acting intent", () => {
  it("covers exactly the canonical acting emotions with valid set_emotion values", () => {
    expect(Object.keys(TAVUS_PERFORMANCE_EMOTIONS).sort()).toEqual([...CANONICAL_EMOTIONS].sort());
    for (const value of Object.values(TAVUS_PERFORMANCE_EMOTIONS)) {
      if (value !== null) expect(TAVUS_EMOTIONS).toContain(value);
    }
  });

  it("never brings back the smile", () => {
    expect(Object.values(TAVUS_PERFORMANCE_EMOTIONS)).not.toContain("happiness");
  });

  it("maps the agreed defaults and falls back to the character's speaking emotion", () => {
    expect(resolveTavusSpeakingEmotion({ emotion: "angry" }, "sadness")).toEqual({ emotion: "anger", origin: "intent" });
    expect(resolveTavusSpeakingEmotion({ emotion: "fragile" }, "fear")).toEqual({ emotion: "sadness", origin: "intent" });
    expect(resolveTavusSpeakingEmotion({ emotion: "scared" }, "sadness")).toEqual({ emotion: "fear", origin: "intent" });
    expect(resolveTavusSpeakingEmotion({ emotion: "sarcastic" }, "sadness")).toEqual({ emotion: "contempt", origin: "intent" });
    expect(resolveTavusSpeakingEmotion({ emotion: "warm" }, "sadness")).toEqual({ emotion: "neutral", origin: "intent" });
    expect(resolveTavusSpeakingEmotion({ emotion: "neutral" }, "sadness")).toEqual({ emotion: "sadness", origin: "fallback" });
    expect(resolveTavusSpeakingEmotion(undefined, "fear")).toEqual({ emotion: "fear", origin: "fallback" });
  });

  it("records labels only in the turn telemetry", () => {
    const observation = tavusCueObservation(
      { emotion: "anger", origin: "intent" },
      true,
      { emotion: "angry", intensity: 1, actingNl: "spoken words never go here", source: "gm_memory", speechState: "x".repeat(80), tempered: "calmed" },
    );
    expect(observation).toEqual({
      provider: "tavus", cue: "anger", sent: true, origin: "intent", emotion: "angry", intensity: 1,
      source: "gm_memory", speech_state: "x".repeat(60), tempered: true,
    });
  });
});
