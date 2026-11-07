/**
 * Output mode of a call — the single switch between the live avatar video and
 * the voice-only (TTS) path.
 *
 * Screen adaptation plan, lot 2 (approved by Ulrich): a smartphone never
 * connects the streaming avatar; it takes the voice-only path already used by
 * Emma, grid calls and fallbacks. Tablet and desktop keep the configured mode.
 */
import type { DeviceClass } from "./deviceClass";
import type { OutputMode } from "./streamingAvatar/types";

export type OutputModeReason = "settings" | "character_voice_only" | "device_smartphone";

export interface CallOutputModeInput {
  startingCharacter: "max" | "emma";
  configuredMode: OutputMode;
  deviceClass: DeviceClass;
}

export interface CallOutputModeDecision {
  mode: OutputMode;
  reason: OutputModeReason;
}

export function resolveCallOutputMode({
  startingCharacter,
  configuredMode,
  deviceClass,
}: CallOutputModeInput): CallOutputModeDecision {
  if (deviceClass === "smartphone") return { mode: "tts", reason: "device_smartphone" };
  // The live video stream is Max's: another character (Emma) starts voice-only,
  // with her portrait, so Max's stream is never shown for her.
  if (startingCharacter !== "max") return { mode: "tts", reason: "character_voice_only" };
  return { mode: configuredMode, reason: "settings" };
}

export type ConversationLayout = "video" | "call";

/** Smartphones show the voice call screen; tablet and desktop keep the video screen. */
export function conversationLayoutFor(deviceClass: DeviceClass): ConversationLayout {
  return deviceClass === "smartphone" ? "call" : "video";
}
