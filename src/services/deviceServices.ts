/**
 * Services per device class — which output (live avatar or voice call), which
 * avatar provider, and for Max and Emma which speech engine each screen uses.
 *
 * Asked by Ulrich (8 November 2026), reorganised in the per-device settings
 * plan, lot 2 (decisions 2 and 3, validated 9 November 2026): one hierarchy
 * Device → Character → Engine, edited in Expérience › Appareils. The voice comes
 * from the TTS Config catalogue (`ava_tts_character_voices`); there is no free
 * voice ID entry any more. Stored per environment in admin_settings, like the
 * other output settings. Defaults keep today's behaviour exactly: smartphone in
 * voice call, tablet and desktop on the global "Voix TTS / Avatar vidéo"
 * switch, each character's own speech engine and voice.
 *
 * Former format (lot 0/1: one `ttsProvider` per device and free `voiceIds`) is
 * read without loss: the shared engine applies to Max and Emma, and a typed
 * voice ID is kept as `legacyVoiceId` (still played, flagged in the admin when
 * it differs from the catalogue).
 */
import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from "./environmentContext";
import { DEVICE_CLASSES, type DeviceClass } from "./deviceClass";
import type { TTSProviderId } from "./tts/types";
import type { CharacterVoiceCatalogue } from "./tts/characterVoices";
import {
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type SelectableStreamingAvatarProvider,
} from "../../supabase/functions/_shared/streamingAvatarRequest";

export const DEVICE_SERVICES_KEY = "ava_device_services";
/** Format version written by the admin (absent in the former format). */
export const DEVICE_SERVICES_VERSION = 2;

/** `settings`: follow the global switch; `voice`: voice call; `avatar`: live avatar video. */
export type DeviceOutputChoice = "settings" | "voice" | "avatar";
export const DEVICE_OUTPUT_CHOICES: readonly DeviceOutputChoice[] = ["settings", "voice", "avatar"];

export const DEVICE_TTS_PROVIDERS: readonly TTSProviderId[] = ["elevenlabs", "gradium", "fish", "inworld", "cartesia"];
export const TTS_PROVIDER_LABELS: Record<TTSProviderId, string> = {
  elevenlabs: "ElevenLabs",
  gradium: "Gradium",
  fish: "Fish Audio",
  inworld: "Inworld",
  cartesia: "Cartesia",
};

export type VoiceCharacter = "max" | "emma";
export const VOICE_CHARACTERS: readonly VoiceCharacter[] = ["max", "emma"];

export interface DeviceCharacterVoice {
  /** `null`: the character's own engine and voice (Réglages personnages / Orchestration). */
  ttsProvider: TTSProviderId | null;
  /**
   * Voice ID typed in the former free field, kept so nothing changes until the
   * admin replaces it by the catalogue voice. Empty in the new format.
   */
  legacyVoiceId: string;
}

export interface DeviceServiceSettings {
  output: DeviceOutputChoice;
  /** `null`: the provider selected in Streaming Avatar Config. */
  avatarProvider: SelectableStreamingAvatarProvider | null;
  characters: Record<VoiceCharacter, DeviceCharacterVoice>;
}

export type DeviceServicesSettings = Record<DeviceClass, DeviceServiceSettings>;

const ownVoice = (): DeviceCharacterVoice => ({ ttsProvider: null, legacyVoiceId: "" });
const ownVoices = (): Record<VoiceCharacter, DeviceCharacterVoice> => ({ max: ownVoice(), emma: ownVoice() });

export const deviceServicesDefaults: DeviceServicesSettings = {
  smartphone: { output: "voice", avatarProvider: null, characters: ownVoices() },
  tablet: { output: "settings", avatarProvider: null, characters: ownVoices() },
  desktop: { output: "settings", avatarProvider: null, characters: ownVoices() },
};

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}

function voiceId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeCharacters(raw: Record<string, unknown>): Record<VoiceCharacter, DeviceCharacterVoice> {
  const characters = record(raw.characters);
  if (raw.characters !== undefined) {
    const result = ownVoices();
    for (const character of VOICE_CHARACTERS) {
      const entry = record(characters[character]);
      const ttsProvider = pick(entry.ttsProvider, DEVICE_TTS_PROVIDERS);
      result[character] = { ttsProvider, legacyVoiceId: ttsProvider ? voiceId(entry.legacyVoiceId) : "" };
    }
    return result;
  }
  // Former format: one engine for the device, free voice IDs per character.
  const ttsProvider = pick(raw.ttsProvider, DEVICE_TTS_PROVIDERS);
  const voices = record(raw.voiceIds);
  const result = ownVoices();
  if (!ttsProvider) return result;
  for (const character of VOICE_CHARACTERS) result[character] = { ttsProvider, legacyVoiceId: voiceId(voices[character]) };
  return result;
}

function normalizeDevice(value: unknown, fallback: DeviceServiceSettings): DeviceServiceSettings {
  const raw = record(value);
  return {
    output: pick(raw.output, DEVICE_OUTPUT_CHOICES) ?? fallback.output,
    avatarProvider: pick(raw.avatarProvider, SELECTABLE_STREAMING_AVATAR_PROVIDERS),
    characters: normalizeCharacters(raw),
  };
}

export function normalizeDeviceServices(value: unknown): DeviceServicesSettings {
  const raw = record(value);
  const result = {} as DeviceServicesSettings;
  for (const device of DEVICE_CLASSES) result[device] = normalizeDevice(raw[device], deviceServicesDefaults[device]);
  return result;
}

/** Stored shape: new format with its version. */
export function serializeDeviceServices(value: DeviceServicesSettings): Record<string, unknown> {
  return { version: DEVICE_SERVICES_VERSION, ...normalizeDeviceServices(value) };
}

/** True when the stored value still uses the former format (one engine per device, free voice IDs). */
export function isLegacyDeviceServices(value: unknown): boolean {
  const raw = record(value);
  return DEVICE_CLASSES.some((device) => {
    const entry = record(raw[device]);
    return entry.characters === undefined && (entry.ttsProvider !== undefined || entry.voiceIds !== undefined);
  });
}

/**
 * Typed voice IDs kept from the former format that differ from the catalogue
 * voice of the same character and engine (shown as a warning in the admin).
 */
export function legacyVoiceConflicts(
  value: DeviceServicesSettings,
  catalogue: CharacterVoiceCatalogue,
): Array<{ device: DeviceClass; character: VoiceCharacter; engine: TTSProviderId; legacyVoiceId: string; catalogueVoiceId: string | null }> {
  return DEVICE_CLASSES.flatMap((device) => VOICE_CHARACTERS.flatMap((character) => {
    const entry = value[device].characters[character];
    if (!entry.ttsProvider || !entry.legacyVoiceId) return [];
    const catalogueVoiceId = catalogue[character]?.[entry.ttsProvider]?.trim() || null;
    return entry.legacyVoiceId === catalogueVoiceId
      ? []
      : [{ device, character, engine: entry.ttsProvider, legacyVoiceId: entry.legacyVoiceId, catalogueVoiceId }];
  }));
}

/** Drops kept voice IDs equal to the catalogue (nothing changes in what is played). */
export function dropRedundantLegacyVoices(value: DeviceServicesSettings, catalogue: CharacterVoiceCatalogue): DeviceServicesSettings {
  const next = structuredClone(normalizeDeviceServices(value));
  for (const device of DEVICE_CLASSES) for (const character of VOICE_CHARACTERS) {
    const entry = next[device].characters[character];
    if (entry.ttsProvider && entry.legacyVoiceId && catalogue[character]?.[entry.ttsProvider]?.trim() === entry.legacyVoiceId) {
      entry.legacyVoiceId = "";
    }
  }
  return next;
}

let cached: DeviceServicesSettings | null = null;

/** Last loaded value (local copy of the environment's setting, else defaults). */
export function getDeviceServices(): DeviceServicesSettings {
  if (cached) return cached;
  try {
    const stored = readEnvironmentStorage(DEVICE_SERVICES_KEY);
    return normalizeDeviceServices(stored ? JSON.parse(stored) : undefined);
  } catch {
    return normalizeDeviceServices(undefined);
  }
}

/** Raw stored value and its normalized reading (the admin flags the former format). */
export async function loadDeviceServicesRawFromDB(): Promise<{ raw: unknown; value: DeviceServicesSettings }> {
  const raw = await loadEnvironmentSetting<unknown>(DEVICE_SERVICES_KEY, {});
  cached = normalizeDeviceServices(raw);
  return { raw, value: cached };
}

export async function loadDeviceServicesFromDB(): Promise<DeviceServicesSettings> {
  return (await loadDeviceServicesRawFromDB()).value;
}

/** Saves the new format, then rereads it; a different readback is reported, never assumed saved. */
export async function saveDeviceServicesToDB(value: DeviceServicesSettings): Promise<DeviceServicesSettings> {
  const normalized = normalizeDeviceServices(value);
  await saveEnvironmentSetting(DEVICE_SERVICES_KEY, serializeDeviceServices(normalized));
  const confirmed = await loadDeviceServicesFromDB();
  if (JSON.stringify(confirmed) !== JSON.stringify(normalized)) {
    throw new Error("Relecture différente : services par appareil non confirmés. Rechargez la page.");
  }
  return confirmed;
}

let pending: Promise<DeviceServicesSettings> | null = null;

/** Loads once per page; a failed read keeps the local copy or the defaults. */
export function deviceServicesReady(): Promise<DeviceServicesSettings> {
  if (cached) return Promise.resolve(cached);
  pending ??= loadDeviceServicesFromDB().catch(() => getDeviceServices());
  return pending;
}

/** Adopt the local copy just refreshed from the database (experience settings load). */
export function primeDeviceServicesFromLocal(): DeviceServicesSettings {
  cached = null;
  pending = null;
  cached = getDeviceServices();
  return cached;
}

/** Test helper. */
export function resetDeviceServicesCacheForTests(): void {
  cached = null;
  pending = null;
}

export interface VoiceProfile {
  ttsProvider: string | null;
  ttsVoiceId: string | null;
}

/** Where a device-chosen engine takes its voice from. */
export type DeviceVoiceSource = "legacy" | "catalogue" | "profile" | "engine_default";

export interface DeviceVoiceChoice {
  /** `null`: the device keeps the character's own engine and voice. */
  engine: TTSProviderId | null;
  voiceId: string | null;
  source: DeviceVoiceSource | null;
}

/**
 * Single rule for the engine and voice a character uses on a device (the
 * experience and the admin summary both call it). Without an engine chosen
 * for this character on this device, the character's own voice is kept. With
 * one: the voice ID kept from the former format; else the catalogue voice of
 * the character for that engine; else the character's voice when it already
 * uses that engine; else the engine's default voice (`null`).
 */
export function deviceVoiceChoice(
  profile: VoiceProfile | null,
  character: string,
  device: DeviceServiceSettings,
  catalogue: CharacterVoiceCatalogue,
): DeviceVoiceChoice {
  const entry = character === "max" || character === "emma" ? device.characters[character] : null;
  const engine = entry?.ttsProvider ?? null;
  if (!engine || !entry) return { engine: null, voiceId: null, source: null };
  if (entry.legacyVoiceId) return { engine, voiceId: entry.legacyVoiceId, source: "legacy" };
  const fromCatalogue = catalogue[character]?.[engine]?.trim();
  if (fromCatalogue) return { engine, voiceId: fromCatalogue, source: "catalogue" };
  if (profile?.ttsProvider === engine && profile.ttsVoiceId) return { engine, voiceId: profile.ttsVoiceId, source: "profile" };
  return { engine, voiceId: null, source: "engine_default" };
}

/** Character profile with the engine and voice of this device (unchanged when the device keeps the character's voice). */
export function resolveDeviceVoice<T extends VoiceProfile>(
  profile: T,
  character: string,
  device: DeviceServiceSettings,
  catalogue: CharacterVoiceCatalogue,
): T {
  const choice = deviceVoiceChoice(profile, character, device, catalogue);
  if (!choice.engine) return profile;
  return { ...profile, ttsProvider: choice.engine, ttsVoiceId: choice.voiceId };
}
