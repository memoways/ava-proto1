/**
 * Output mode of a call — the single switch between the live avatar video and
 * the voice-only (TTS) path.
 *
 * Screen adaptation plan, lot 2 (approved by Ulrich): by default a smartphone
 * never connects the streaming avatar; it takes the voice-only path already
 * used by Emma, grid calls and fallbacks. Tablet and desktop keep the
 * configured mode. Since 8 November the admin "Services par appareil" can set
 * each device to voice call, live avatar or the global switch.
 */
import type { DeviceClass } from "./deviceClass";
import type { DeviceOutputChoice } from "./deviceServices";
import type { OutputMode } from "./streamingAvatar/types";

export type OutputModeReason = "settings" | "character_voice_only" | "device_smartphone" | "device_settings";

export interface CallOutputModeInput {
  startingCharacter: "max" | "emma";
  configuredMode: OutputMode;
  deviceClass: DeviceClass;
  /** Admin choice for this device; absent = historic rule (smartphone voice, others on the switch). */
  deviceOutput?: DeviceOutputChoice;
}

export interface CallOutputModeDecision {
  mode: OutputMode;
  reason: OutputModeReason;
}

export function resolveCallOutputMode({
  startingCharacter,
  configuredMode,
  deviceClass,
  deviceOutput,
}: CallOutputModeInput): CallOutputModeDecision {
  const choice = deviceOutput ?? (deviceClass === "smartphone" ? "voice" : "settings");
  if (choice === "voice") {
    return { mode: "tts", reason: deviceClass === "smartphone" ? "device_smartphone" : "device_settings" };
  }
  // The live video stream is Max's: another character (Emma) starts voice-only,
  // with her portrait, so Max's stream is never shown for her.
  if (startingCharacter !== "max") return { mode: "tts", reason: "character_voice_only" };
  if (choice === "avatar") return { mode: "streaming_avatar", reason: "device_settings" };
  return { mode: configuredMode, reason: "settings" };
}

export type ConversationLayout = "video" | "call";

/**
 * Smartphones show the voice call screen; tablet and desktop keep the video
 * screen. A smartphone set to the live avatar gets the video screen.
 */
export function conversationLayoutFor(deviceClass: DeviceClass, mode?: OutputMode): ConversationLayout {
  if (deviceClass !== "smartphone") return "video";
  return mode === "streaming_avatar" ? "video" : "call";
}

/**
 * Touch-first controls on the video screen (screen plan, lot 3): tablets (and
 * smartphones, whose call screen already has them) get 44 px targets, "touche"
 * wording and `100svh`. Desktop keeps its current render.
 */
export function touchFirstFor(deviceClass: DeviceClass): boolean {
  return deviceClass !== "desktop";
}
