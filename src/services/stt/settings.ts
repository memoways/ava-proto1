import type { STTProviderId, STTSettings } from "./types";
import {
  deleteEnvironmentSetting,
  loadEnvironmentSetting,
  readEnvironmentStorage,
  removeEnvironmentStorage,
  saveEnvironmentSetting,
  writeEnvironmentStorage,
} from "@/services/environmentContext";

export const STT_STORAGE_KEY = "ava_stt_settings";

export const STT_PROVIDER_IDS: STTProviderId[] = [
  "deepgram",
  "gamilab",
  "openai_whisper",
  "assemblyai",
  "gradium",
];

export const DEFAULT_STT_SETTINGS: STTSettings = {
  activeProvider: "deepgram",
};

let cachedSTTSettings: STTSettings | null = null;
let dbLoadPromise: Promise<STTSettings> | null = null;

export function normalizeSTTProviderId(provider: unknown): STTProviderId {
  return STT_PROVIDER_IDS.includes(provider as STTProviderId)
    ? (provider as STTProviderId)
    : DEFAULT_STT_SETTINGS.activeProvider;
}

function normalizeSTTSettings(settings: Partial<STTSettings> | null | undefined): STTSettings {
  return {
    activeProvider: normalizeSTTProviderId(settings?.activeProvider),
  };
}

export function getSTTSettings(): STTSettings {
  if (cachedSTTSettings) return { ...cachedSTTSettings };
  try {
    const stored = readEnvironmentStorage(STT_STORAGE_KEY);
    if (stored) {
      cachedSTTSettings = normalizeSTTSettings(JSON.parse(stored));
      return { ...cachedSTTSettings };
    }
  } catch {
    // ignore localStorage/JSON failures and use the safe baseline
  }
  return { ...DEFAULT_STT_SETTINGS };
}

export function getSTTProvider(): STTProviderId {
  return getSTTSettings().activeProvider;
}

export function saveSTTSettingsLocal(settings: Partial<STTSettings>): STTSettings {
  const updated = normalizeSTTSettings({ ...getSTTSettings(), ...settings });
  writeEnvironmentStorage(STT_STORAGE_KEY, JSON.stringify(updated));
  cachedSTTSettings = updated;
  return updated;
}

export async function loadSTTSettingsFromDB(): Promise<STTSettings> {
  if (cachedSTTSettings) return { ...cachedSTTSettings };
  if (dbLoadPromise) return dbLoadPromise;
  dbLoadPromise = loadSTTSettingsFromDBUncached().finally(() => {
    dbLoadPromise = null;
  });
  return dbLoadPromise;
}

async function loadSTTSettingsFromDBUncached(): Promise<STTSettings> {
  const loaded = normalizeSTTSettings(await loadEnvironmentSetting(STT_STORAGE_KEY, DEFAULT_STT_SETTINGS));
  cachedSTTSettings = loaded;
  return { ...cachedSTTSettings };
}

export async function saveSTTSettingsToDB(settings: STTSettings): Promise<void> {
  const normalized = normalizeSTTSettings(settings);
  writeEnvironmentStorage(STT_STORAGE_KEY, JSON.stringify(normalized));
  cachedSTTSettings = normalized;
  try {
    await saveEnvironmentSetting(STT_STORAGE_KEY, normalized);
  } catch (err) {
    console.error("[STT Settings] DB save exception:", err);
  }
}

export function resetSTTSettings(): STTSettings {
  removeEnvironmentStorage(STT_STORAGE_KEY);
  cachedSTTSettings = { ...DEFAULT_STT_SETTINGS };
  void deleteEnvironmentSetting(STT_STORAGE_KEY).catch(() => {});
  return { ...DEFAULT_STT_SETTINGS };
}

export function resetSTTSettingsCache() {
  cachedSTTSettings = null;
  dbLoadPromise = null;
}
