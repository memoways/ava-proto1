/**
 * Which video service a call opens, decided once at pick-up (per-character video plan, §9.3).
 *
 * 1. A device set to voice (smartphone by default) stays voice-only, link or not.
 * 2. A linked character opens its provider, with its fields; it wins over the
 *    device's provider and over the global voice / video switch.
 * 3. Without a link, Max follows the device or the switch, with the device's
 *    provider when set; every other character is voice-only.
 *
 * Pure: the same answer for the call, the session record and the "Joué" summaries.
 */
import { resolveCallOutputMode, type OutputModeReason } from "./callOutputMode";
import type { DeviceClass } from "./deviceClass";
import type { DeviceServiceSettings } from "./deviceServices";
import { applyCharacterVideoLink } from "./streamingAvatar/settings";
import type { OutputMode, StreamingAvatarSettings } from "./streamingAvatar/types";

export interface CallVideoInput {
  /** Character who opens the call. */
  character: string;
  /** Global switch "Voix TTS / Avatar vidéo". */
  configuredMode: OutputMode;
  deviceClass: DeviceClass;
  deviceServices: Pick<DeviceServiceSettings, "output" | "avatarProvider">;
  /** Stored avatar settings, before any device or character override. */
  avatar: StreamingAvatarSettings;
}

export interface CallVideoDecision {
  mode: OutputMode;
  reason: OutputModeReason;
  /** Settings to open the room with; `activeProvider` is the resolved provider. */
  avatar: StreamingAvatarSettings;
}

export function resolveCallVideo({
  character,
  configuredMode,
  deviceClass,
  deviceServices,
  avatar,
}: CallVideoInput): CallVideoDecision {
  const link = avatar.characterLinks?.[character];
  const decision = resolveCallOutputMode({
    startingCharacter: character,
    configuredMode,
    deviceClass,
    deviceOutput: deviceServices.output,
    hasCharacterLink: Boolean(link),
  });
  if (link && decision.reason === "character_link") {
    return { ...decision, avatar: applyCharacterVideoLink(avatar, link) };
  }
  const provider = deviceServices.avatarProvider;
  return { ...decision, avatar: provider ? { ...avatar, activeProvider: provider } : avatar };
}

/**
 * True when a character switch must drop to voice: a video room is open and it was
 * opened for someone else, whose face and persona must never voice this character.
 */
export function leavesAvatarRoom(
  outputMode: OutputMode | undefined,
  roomCharacter: string,
  target: string,
): boolean {
  return outputMode === "streaming_avatar" && target !== roomCharacter;
}
