/**
 * Services per device class — which output (live avatar or voice call), which
 * avatar provider and which speech engine and voice each screen uses.
 *
 * Asked by Ulrich (8 November 2026): desktop and tablet can keep the Anam
 * avatar while the smartphone uses another chain (for example ElevenLabs with a
 * chosen voice). Stored per environment in admin_settings, like the other
 * output settings. Defaults keep today's behaviour exactly: smartphone in voice
 * call, tablet and desktop on the global "Voix TTS / Avatar vidéo" switch, each
 * character's own speech engine and voice.
 */
import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from "./environmentContext";
import { DEVICE_CLASSES, type DeviceClass } from "./deviceClass";
import type { TTSProviderId } from "./tts/types";
import {
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type SelectableStreamingAvatarProvider,
} from "../../supabase/functions/_shared/streamingAvatarRequest";

export const DEVICE_SERVICES_KEY = "ava_device_services";

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

export interface DeviceServiceSettings {
  output: DeviceOutputChoice;
  /** `null`: the provider selected in Streaming Avatar Config. */
  avatarProvider: SelectableStreamingAvatarProvider | null;
  /** `null`: each character's own engine and voice (Orchestration). */
  ttsProvider: TTSProviderId | null;
  /** Voice per character for `ttsProvider`; empty keeps the character's voice when it uses that engine. */
  voiceIds: Record<VoiceCharacter, string>;
}

export type DeviceServicesSettings = Record<DeviceClass, DeviceServiceSettings>;

const emptyVoices = (): Record<VoiceCharacter, string> => ({ max: "", emma: "" });

export const deviceServicesDefaults: DeviceServicesSettings = {
  smartphone: { output: "voice", avatarProvider: null, ttsProvider: null, voiceIds: emptyVoices() },
  tablet: { output: "settings", avatarProvider: null, ttsProvider: null, voiceIds: emptyVoices() },
  desktop: { output: "settings", avatarProvider: null, ttsProvider: null, voiceIds: emptyVoices() },
};

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}

function voiceId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function normalizeDevice(value: unknown, fallback: DeviceServiceSettings): DeviceServiceSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const voices = raw.voiceIds && typeof raw.voiceIds === "object" ? raw.voiceIds as Record<string, unknown> : {};
  return {
    output: pick(raw.output, DEVICE_OUTPUT_CHOICES) ?? fallback.output,
    avatarProvider: pick(raw.avatarProvider, SELECTABLE_STREAMING_AVATAR_PROVIDERS),
    ttsProvider: pick(raw.ttsProvider, DEVICE_TTS_PROVIDERS),
    voiceIds: { max: voiceId(voices.max), emma: voiceId(voices.emma) },
  };
}

export function normalizeDeviceServices(value: unknown): DeviceServicesSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = {} as DeviceServicesSettings;
  for (const device of DEVICE_CLASSES) result[device] = normalizeDevice(raw[device], deviceServicesDefaults[device]);
  return result;
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

export async function loadDeviceServicesFromDB(): Promise<DeviceServicesSettings> {
  cached = normalizeDeviceServices(await loadEnvironmentSetting(DEVICE_SERVICES_KEY, deviceServicesDefaults));
  return cached;
}

export async function saveDeviceServicesToDB(value: DeviceServicesSettings): Promise<void> {
  const normalized = normalizeDeviceServices(value);
  await saveEnvironmentSetting(DEVICE_SERVICES_KEY, normalized);
  cached = normalized;
}

let pending: Promise<DeviceServicesSettings> | null = null;

/** Loads once per page; a failed read keeps the local copy or the defaults. */
export function deviceServicesReady(): Promise<DeviceServicesSettings> {
  if (cached) return Promise.resolve(cached);
  pending ??= loadDeviceServicesFromDB().catch(() => getDeviceServices());
  return pending;
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

/**
 * Speech engine and voice a character uses on this device. Without an engine
 * chosen for the device, the character's own voice is kept. With one, the
 * device's voice for that character wins; else the character's voice when it
 * already uses that engine; else the engine's default voice (`null`).
 */
export function resolveDeviceVoice<T extends VoiceProfile>(
  profile: T,
  character: string,
  device: DeviceServiceSettings,
): T {
  const provider = device.ttsProvider;
  if (!provider) return profile;
  const own = character === "max" || character === "emma" ? device.voiceIds[character] : "";
  const ttsVoiceId = own || (profile.ttsProvider === provider ? profile.ttsVoiceId : null);
  return { ...profile, ttsProvider: provider, ttsVoiceId };
}
