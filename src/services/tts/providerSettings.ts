/**
 * Per-provider settings (other than ElevenLabs which lives in settingsService.ts under TTSSettings).
 * Stored in admin_settings + localStorage with the same pattern as other settings.
 */

import { supabase } from "@/integrations/supabase/client";

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
    const stored = localStorage.getItem(INWORLD_KEY);
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
  localStorage.removeItem(INWORLD_KEY);
  supabase.from("admin_settings" as never).delete().eq("key", INWORLD_KEY).then(() => {});
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
    const stored = localStorage.getItem(HUME_KEY);
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
  localStorage.removeItem(HUME_KEY);
  supabase.from("admin_settings" as never).delete().eq("key", HUME_KEY).then(() => {});
  return { ...humeDefaults };
}

// ---------------- Active provider selection ----------------

import type { TTSProviderId } from "@/services/tts/types";

const ACTIVE_KEY = "ava_tts_active_provider";
const DEFAULT_PROVIDER: TTSProviderId = "elevenlabs";

export function getActiveProviderId(): TTSProviderId {
  try {
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { provider?: TTSProviderId };
      if (parsed?.provider === "elevenlabs" || parsed?.provider === "inworld" || parsed?.provider === "hume") {
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
  try {
    const { data, error } = await supabase
      .from("admin_settings" as never)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!error && data) {
      const dbValue = (data as { value: T }).value;
      localStorage.setItem(key, JSON.stringify(dbValue));
      return { ...defaults, ...dbValue };
    }
  } catch (err) {
    console.warn(`[ttsProviderSettings] DB load failed for ${key}:`, err);
  }
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...defaults };
}

async function saveToDB<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
  try {
    const { error } = await supabase
      .from("admin_settings" as never)
      .upsert({ key, value, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
    if (error) console.error(`[ttsProviderSettings] DB save failed for ${key}:`, error.message);
  } catch (err) {
    console.error(`[ttsProviderSettings] DB save exception for ${key}:`, err);
  }
}
