/**
 * Per-provider settings (other than ElevenLabs which lives in settingsService.ts under TTSSettings).
 * Stored in admin_settings + localStorage with the same pattern as other settings.
 */

import {
  deleteEnvironmentSetting,
  loadEnvironmentSetting,
  readEnvironmentStorage,
  removeEnvironmentStorage,
  saveEnvironmentSetting,
} from "@/services/environmentContext";

// ---------------- Inworld ----------------

export interface InworldSettings {
  voiceId: string;
  modelId: "inworld-tts-2" | "inworld-tts-1" | "inworld-tts-1-max";
  deliveryMode: "STABLE" | "BALANCED" | "CREATIVE";
  language: string; // BCP-47 or "AUTO" (tts-2 only)
  speakingRate: number;
  /** Legacy models only (tts-1*) */
  temperature: number;
}

export const INWORLD_MODELS = [
  { id: "inworld-tts-2", label: "Inworld TTS 2", description: "Dernier modèle — delivery_mode + language AUTO" },
  { id: "inworld-tts-1", label: "Inworld TTS 1 (legacy)", description: "Modèle legacy, supporte temperature" },
  { id: "inworld-tts-1-max", label: "Inworld TTS 1 Max (legacy)", description: "Qualité max legacy" },
];

const INWORLD_KEY = "ava_tts_settings_inworld";

const inworldDefaults: InworldSettings = {
  voiceId: "Alain",
  modelId: "inworld-tts-2",
  deliveryMode: "BALANCED",
  language: "AUTO",
  speakingRate: 1,
  temperature: 0.7,
};

export function getInworldSettings(): InworldSettings {
  try {
    const stored = readEnvironmentStorage(INWORLD_KEY);
    if (stored) return { ...inworldDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...inworldDefaults };
}

export async function loadInworldSettingsFromDB(): Promise<InworldSettings> {
  return loadFromDB(INWORLD_KEY, inworldDefaults);
}

export async function saveInworldSettingsToDB(settings: InworldSettings): Promise<void> {
  await saveToDB(INWORLD_KEY, settings);
}

export function resetInworldSettings(): InworldSettings {
  removeEnvironmentStorage(INWORLD_KEY);
  void deleteEnvironmentSetting(INWORLD_KEY).catch(() => {});
  return { ...inworldDefaults };
}

// ---------------- Hume Octave ----------------

export interface HumeSettings {
  voiceName: string;
  voiceProvider: "HUME_AI" | "CUSTOM_VOICE";
  /** Optional prompt-style description shaping prosody (Octave-specific) */
  description: string;
  format: "mp3" | "wav" | "pcm";
  languageCode: string;
}

const HUME_KEY = "ava_tts_settings_hume";

const humeDefaults: HumeSettings = {
  voiceName: "Male English Actor",
  voiceProvider: "HUME_AI",
  description: "",
  format: "mp3",
  languageCode: "fr",
};

export function getHumeSettings(): HumeSettings {
  try {
    const stored = readEnvironmentStorage(HUME_KEY);
    if (stored) return { ...humeDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...humeDefaults };
}

export async function loadHumeSettingsFromDB(): Promise<HumeSettings> {
  return loadFromDB(HUME_KEY, humeDefaults);
}

export async function saveHumeSettingsToDB(settings: HumeSettings): Promise<void> {
  await saveToDB(HUME_KEY, settings);
}

export function resetHumeSettings(): HumeSettings {
  removeEnvironmentStorage(HUME_KEY);
  void deleteEnvironmentSetting(HUME_KEY).catch(() => {});
  return { ...humeDefaults };
}

// ---------------- Gradium ----------------

export interface GradiumSettings {
  voiceId: string;
  outputFormat:
    | "wav"
    | "opus"
    | "ulaw_8000"
    | "mulaw_8000"
    | "alaw_8000"
    | "pcm"
    | "pcm_8000"
    | "pcm_16000"
    | "pcm_22050"
    | "pcm_24000"
    | "pcm_44100"
    | "pcm_48000";
  /** Sampling temperature (0.0–1.4). 0 = deterministic. */
  temp: number;
  /** Voice similarity (1.0–4.0). Higher = closer to target voice. */
  cfgCoef: number;
  /** Speech speed padding bonus (-4.0 to 4.0). Negative = faster, positive = slower. */
  paddingBonus: number;
  /** Text rewriting rules — usually a language code like "fr", "en". */
  rewriteRules: string;
  /** Optional pronunciation dictionary id, applied per request. */
  pronunciationId: string;
  /** WebSocket streaming (progressive playback). Falls back to REST on failure. */
  streamingEnabled: boolean;
  /** Raw PCM format requested over the WebSocket ("pcm_48000" is Gradium's native rate). */
  streamingFormat: "pcm_24000" | "pcm_48000";
  /** Bumped when defaults change so migrateGradium can upgrade stored values once. */
  settingsVersion?: number;
}

// Note: Gradium API does NOT support "mp3" — supported formats per
// https://docs.gradium.ai/api-reference/endpoint/tts-post
export const GRADIUM_OUTPUT_FORMATS: GradiumSettings["outputFormat"][] = [
  "wav", "opus",
  "ulaw_8000", "mulaw_8000", "alaw_8000",
  "pcm", "pcm_8000", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100", "pcm_48000",
];

const GRADIUM_KEY = "ava_tts_settings_gradium";

const gradiumDefaults: GradiumSettings = {
  voiceId: "b5ioHAR7JuHVLskk",
  outputFormat: "opus",
  temp: 0.7,
  cfgCoef: 2.0,
  paddingBonus: 0.0,
  rewriteRules: "fr",
  pronunciationId: "",
  streamingEnabled: true,
  streamingFormat: "pcm_24000",
  settingsVersion: 2,
};



function migrateGradium(s: GradiumSettings): GradiumSettings {
  let next = s;
  // "mp3" was previously allowed but is not a valid Gradium output_format.
  if ((next.outputFormat as string) === "mp3") next = { ...next, outputFormat: "opus" };
  // v2: default REST format moved wav → opus (~6x fewer bytes). A stored "wav"
  // predating v2 is almost certainly the old default, not a deliberate choice;
  // re-selecting wav in the admin saves with settingsVersion 2 and sticks.
  if ((next.settingsVersion ?? 1) < 2) {
    next = {
      ...next,
      outputFormat: next.outputFormat === "wav" ? "opus" : next.outputFormat,
      settingsVersion: 2,
    };
  }
  return next;
}

export function getGradiumSettings(): GradiumSettings {
  try {
    const stored = readEnvironmentStorage(GRADIUM_KEY);
    if (stored) return migrateGradium({ ...gradiumDefaults, ...JSON.parse(stored) });
  } catch { /* ignore */ }
  return { ...gradiumDefaults };
}

export async function loadGradiumSettingsFromDB(): Promise<GradiumSettings> {
  return migrateGradium(await loadFromDB(GRADIUM_KEY, gradiumDefaults));
}


export async function saveGradiumSettingsToDB(settings: GradiumSettings): Promise<void> {
  await saveToDB(GRADIUM_KEY, settings);
}

export function resetGradiumSettings(): GradiumSettings {
  removeEnvironmentStorage(GRADIUM_KEY);
  void deleteEnvironmentSetting(GRADIUM_KEY).catch(() => {});
  return { ...gradiumDefaults };
}

// ---------------- Active provider selection ----------------

import type { TTSProviderId } from "@/services/tts/types";

const ACTIVE_KEY = "ava_tts_active_provider";
const DEFAULT_PROVIDER: TTSProviderId = "elevenlabs";

const VALID_PROVIDERS: TTSProviderId[] = ["elevenlabs", "inworld", "hume", "gradium"];

export function getActiveProviderId(): TTSProviderId {
  try {
    const stored = readEnvironmentStorage(ACTIVE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { provider?: TTSProviderId };
      if (parsed?.provider && VALID_PROVIDERS.includes(parsed.provider)) {
        return parsed.provider;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_PROVIDER;
}

export async function loadActiveProviderFromDB(): Promise<TTSProviderId> {
  const loaded = await loadFromDB<{ provider: TTSProviderId }>(ACTIVE_KEY, { provider: DEFAULT_PROVIDER });
  return loaded.provider;
}

export async function setActiveProvider(provider: TTSProviderId): Promise<void> {
  await saveToDB(ACTIVE_KEY, { provider });
}

// ---------------- shared helpers (mirror of settingsService internals) ----------------

async function loadFromDB<T>(key: string, defaults: T): Promise<T> {
  return loadEnvironmentSetting(key, defaults);
}

async function saveToDB<T>(key: string, value: T): Promise<void> {
  try {
    await saveEnvironmentSetting(key, value);
  } catch (err) {
    console.error(`[ttsProviderSettings] DB save exception for ${key}:`, err);
  }
}
