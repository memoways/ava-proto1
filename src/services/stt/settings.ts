import { supabase } from "@/integrations/supabase/client";
import type { STTProviderId, STTSettings } from "./types";

export const STT_STORAGE_KEY = "ava_stt_settings";

export const STT_PROVIDER_IDS: STTProviderId[] = [
  "deepgram",
  "gamilab",
  "openai_whisper",
  "assemblyai",
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
    const stored = localStorage.getItem(STT_STORAGE_KEY);
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
  localStorage.setItem(STT_STORAGE_KEY, JSON.stringify(updated));
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
  try {
    const { data, error } = await supabase
      .from("admin_settings" as any)
      .select("value")
      .eq("key", STT_STORAGE_KEY)
      .maybeSingle();

    if (!error && data) {
      const loaded = normalizeSTTSettings((data as any).value);
      localStorage.setItem(STT_STORAGE_KEY, JSON.stringify(loaded));
      cachedSTTSettings = loaded;
      return loaded;
    }
  } catch (err) {
    console.warn("[STT Settings] DB load failed:", err);
  }
  cachedSTTSettings = getSTTSettings();
  return { ...cachedSTTSettings };
}

export async function saveSTTSettingsToDB(settings: STTSettings): Promise<void> {
  const normalized = normalizeSTTSettings(settings);
  localStorage.setItem(STT_STORAGE_KEY, JSON.stringify(normalized));
  cachedSTTSettings = normalized;
  try {
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert({ key: STT_STORAGE_KEY, value: normalized, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    if (error) {
      console.error("[STT Settings] DB save failed:", error.message);
    }
  } catch (err) {
    console.error("[STT Settings] DB save exception:", err);
  }
}

export function resetSTTSettings(): STTSettings {
  localStorage.removeItem(STT_STORAGE_KEY);
  cachedSTTSettings = { ...DEFAULT_STT_SETTINGS };
  supabase.from("admin_settings" as any).delete().eq("key", STT_STORAGE_KEY).then(() => {});
  return { ...DEFAULT_STT_SETTINGS };
}

export function resetSTTSettingsCache() {
  cachedSTTSettings = null;
  dbLoadPromise = null;
}
