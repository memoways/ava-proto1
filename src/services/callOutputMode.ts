/**
 * Output mode of a call — the single switch between the live avatar video and
 * the voice-only (TTS) path.
 *
 * Screen adaptation plan, lot 2 (approved by Ulrich): by default a smartphone
 * never connects the streaming avatar; it takes the voice-only path already
 * used by Emma, grid calls and fallbacks. Tablet and desktop keep the
 * configured mode. Since 8 November the admin "Services par appareil" can set
 * each device to voice call, live avatar or the global switch; the live avatar
 * only applies while the global switch is on video.
 */
import type { DeviceClass } from "./deviceClass";
import type { DeviceOutputChoice } from "./deviceServices";
import type { OutputMode } from "./streamingAvatar/types";

export type OutputModeReason =
  | "settings"
  | "character_link"
  | "character_voice_only"
  | "character_no_video"
  | "device_smartphone"
  | "device_settings";

export interface CallOutputModeInput {
  startingCharacter: string;
  configuredMode: OutputMode;
  deviceClass: DeviceClass;
  /** Admin choice for this device; absent = historic rule (smartphone voice, others on the switch). */
  deviceOutput?: DeviceOutputChoice;
  /**
   * The starting character's video service (Réglages personnages): its own provider,
   * « Pas de vidéo », or absent to follow the global rule.
   */
  characterVideo?: "provider" | "none" | null;
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
  characterVideo,
}: CallOutputModeInput): CallOutputModeDecision {
  const choice = deviceOutput ?? (deviceClass === "smartphone" ? "voice" : "settings");
  if (choice === "voice") {
    return { mode: "tts", reason: deviceClass === "smartphone" ? "device_smartphone" : "device_settings" };
  }
  // Decision of 27 November: the global switch on « Voix » cuts the video for everyone, with or
  // without a character link, including a device set to the live avatar.
  if (configuredMode === "tts") return { mode: "tts", reason: "settings" };
  // Video is on: « Pas de vidéo » keeps this character voice-only, a provider opens it.
  if (characterVideo === "none") return { mode: "tts", reason: "character_no_video" };
  if (characterVideo === "provider") return { mode: "streaming_avatar", reason: "character_link" };
  // Without a link, the live video stream is Max's: another character (Emma) starts
  // voice-only, with her portrait, so Max's stream is never shown for her.
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
