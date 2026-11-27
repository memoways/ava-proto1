/**
 * Which video service a call opens, decided once at pick-up (per-character video plan, §9.3).
 *
 * 1. A device set to voice (smartphone by default) stays voice-only, link or not.
 * 2. The global switch on « Voix » cuts the video for everyone, link or not (decision
 *    of 27 November); a device explicitly set to the live avatar keeps its choice.
 * 3. Video on: « Pas de vidéo » keeps the character voice-only; a linked character
 *    opens its provider, with its fields, over the device's provider.
 * 4. Without a link, Max follows the device or the switch, with the device's
 *    provider when set; every other character is voice-only.
 *
 * Pure: the same answer for the call, the session record and the "Joué" summaries.
 */
import { resolveCallOutputMode, type OutputModeReason } from "./callOutputMode";
import type { DeviceClass } from "./deviceClass";
import type { DeviceServiceSettings } from "./deviceServices";
import { applyCharacterVideoLink } from "./streamingAvatar/settings";
import type { OutputMode, StreamingAvatarProviderId, StreamingAvatarSettings } from "./streamingAvatar/types";

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
    characterVideo: link ? (link.provider === "none" ? "none" : "provider") : null,
  });
  if (link && link.provider !== "none" && decision.reason === "character_link") {
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

const PROVIDER_NAMES: Record<StreamingAvatarProviderId, string> = {
  heygen: "HeyGen",
  tavus: "Tavus",
  anam: "Anam",
  lemonslice: "LemonSlice",
  nuance: "Nuance",
};

const NEXT_CALL_REASONS: Record<Exclude<OutputModeReason, "character_link">, string> = {
  settings: "car le réglage global est sur Voix",
  character_no_video: "choisie pour ce personnage",
  character_voice_only: "sans service vidéo propre, seul Max suit le réglage global",
  device_smartphone: "car le smartphone reste en voix",
  device_settings: "car cet appareil est réglé sur voix",
};

/** One line for the admin screens: what the next call of this character will open. */
export function describeNextCall(input: CallVideoInput): string {
  const { mode, reason, avatar } = resolveCallVideo(input);
  if (mode === "streaming_avatar") return `Vidéo ${PROVIDER_NAMES[avatar.activeProvider] ?? avatar.activeProvider}`;
  if (reason === "character_voice_only") return `Voix seule : ${NEXT_CALL_REASONS.character_voice_only}`;
  const why = reason === "character_link" ? "" : NEXT_CALL_REASONS[reason];
  return why ? `Voix seule, ${why}` : "Voix seule";
}
