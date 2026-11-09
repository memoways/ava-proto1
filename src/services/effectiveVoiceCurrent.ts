/**
 * Current-settings reader for `describeEffectiveVoice()` (kept apart so the
 * description stays pure and testable). Reads the local copy of the active
 * environment's settings: filled from the database by
 * `hydrateExperienceSettings()` on the player side and by the admin page loads.
 */
import { describeEffectiveVoice, type EffectiveVoice, type EffectiveVoiceInput, type VoiceCharacter } from "./effectiveVoice";
import type { DeviceClass } from "./deviceClass";
import { getDeviceServices, type DeviceServiceSettings } from "./deviceServices";
import { getTTSSettings } from "./settingsService";
import {
  getActiveProviderId,
  getCartesiaSettings,
  getFishSettings,
  getGradiumSettings,
  getInworldSettings,
} from "./tts/providerSettings";
import { getCharacterVoices, type CharacterVoiceCatalogue } from "./tts/characterVoices";
import { getOutputSettings, getStreamingAvatarSettings } from "./streamingAvatar/settings";
import type { OutputMode, StreamingAvatarSettings } from "./streamingAvatar/types";

export interface EffectiveVoiceOverrides {
  deviceServices?: DeviceServiceSettings;
  configuredOutput?: OutputMode;
  avatar?: StreamingAvatarSettings;
  /** Catalogue just loaded by an editor (else the local copy). */
  catalogue?: CharacterVoiceCatalogue;
}

export function currentEffectiveVoiceInput(
  device: DeviceClass,
  character: VoiceCharacter,
  profile: EffectiveVoiceInput["profile"],
  overrides: EffectiveVoiceOverrides = {},
): EffectiveVoiceInput {
  return {
    device,
    character,
    profile,
    deviceServices: overrides.deviceServices ?? getDeviceServices()[device],
    configuredOutput: overrides.configuredOutput ?? getOutputSettings().mode,
    avatar: overrides.avatar ?? getStreamingAvatarSettings(),
    activeProvider: getActiveProviderId(),
    catalogue: overrides.catalogue ?? getCharacterVoices(),
    engines: {
      elevenlabs: getTTSSettings(),
      gradium: getGradiumSettings(),
      fish: getFishSettings(),
      inworld: getInworldSettings(),
      cartesia: getCartesiaSettings(),
    },
  };
}

export function describeCurrentEffectiveVoice(
  device: DeviceClass,
  character: VoiceCharacter,
  profile: EffectiveVoiceInput["profile"],
  overrides: EffectiveVoiceOverrides = {},
): EffectiveVoice {
  return describeEffectiveVoice(currentEffectiveVoiceInput(device, character, profile, overrides));
}
