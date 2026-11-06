import type { CanonicalEmotion, PerformanceIntent } from "@/services/tts/performanceIntent";
import type { AvatarCueObservation } from "../voiceTurnTelemetryV2";
import type { TavusEmotion } from "./types";

/**
 * Face emotion of a Tavus line voiced by Ava's audio: the same acting intent that shapes the
 * TTS voice chooses `conversation.set_emotion`, so voice and face never tell two stories.
 * `null` keeps the character's configured speaking emotion (Max/Emma are in distress, so a
 * neutral line keeps that base rather than a blank face). `happiness` is never chosen: it
 * brings back the assistant smile the settings remove.
 */
export const TAVUS_PERFORMANCE_EMOTIONS: Record<CanonicalEmotion, TavusEmotion | null> = {
  neutral: null,
  tense: "fear",
  angry: "anger",
  accusatory: "anger",
  sad: "sadness",
  fragile: "sadness",
  scared: "fear",
  urgent: "fear",
  warm: "neutral",
  sarcastic: "contempt",
};

export interface TavusSpeakingEmotionChoice {
  emotion: TavusEmotion;
  origin: "intent" | "fallback";
}

export function resolveTavusSpeakingEmotion(
  intent: Pick<PerformanceIntent, "emotion"> | null | undefined,
  fallback: TavusEmotion,
): TavusSpeakingEmotionChoice {
  const mapped = intent?.emotion ? TAVUS_PERFORMANCE_EMOTIONS[intent.emotion] : undefined;
  return mapped ? { emotion: mapped, origin: "intent" } : { emotion: fallback, origin: "fallback" };
}

/** Turn telemetry entry (Admin → Sessions), labels only, never spoken text. */
export function tavusCueObservation(
  choice: TavusSpeakingEmotionChoice,
  sent: boolean,
  intent: PerformanceIntent | null | undefined,
): AvatarCueObservation {
  return {
    provider: "tavus",
    cue: choice.emotion,
    sent,
    origin: choice.origin,
    emotion: intent?.emotion ?? null,
    intensity: intent?.intensity ?? null,
    source: intent?.source ?? null,
    speech_state: intent?.speechState ? intent.speechState.slice(0, 60) : null,
    tempered: intent?.tempered === "calmed",
  };
}
