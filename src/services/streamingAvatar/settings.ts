import { supabase } from "@/integrations/supabase/client";
import type {
  OutputSettings,
  StreamingAvatarProviderId,
  StreamingAvatarSettings,
} from "./types";

export const OUTPUT_SETTINGS_KEY = "ava_output_settings";
export const STREAMING_AVATAR_SETTINGS_KEY = "ava_streaming_avatar_settings";

export const outputDefaults: OutputSettings = { mode: "tts" };

export const streamingAvatarDefaults: StreamingAvatarSettings = {
  activeProvider: "heygen",
  connectionTimeoutMs: 12_000,
  fallbackTimeoutMs: 5_000,
  heygen: {
    avatarId: "",
    voiceId: "",
    contextId: "",
    language: "fr",
    quality: "high",
    sandbox: true,
  },
  tavus: {
    replicaId: "",
    personaId: "",
    language: "French",
    maxDurationSeconds: 900,
  },
};

function readLocal<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {
    // Keep safe defaults when local storage is unavailable or malformed.
  }
  return { ...defaults };
}

async function loadSetting<T>(key: string, defaults: T): Promise<T> {
  try {
    const { data, error } = await supabase
      .from("admin_settings" as never)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!error && data) {
      const value = { ...defaults, ...((data as { value: T }).value ?? {}) };
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    }
  } catch (error) {
    console.warn(`[StreamingAvatar settings] load ${key} failed`, error);
  }
  return readLocal(key, defaults);
}

async function saveSetting<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
  const { error } = await supabase
    .from("admin_settings" as never)
    .upsert(
      { key, value, updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
  if (error) throw error;
}

function normalizeProvider(value: unknown): StreamingAvatarProviderId {
  return value === "tavus" ? "tavus" : "heygen";
}

export function getOutputSettings(): OutputSettings {
  const value = readLocal(OUTPUT_SETTINGS_KEY, outputDefaults);
  return { mode: value.mode === "streaming_avatar" ? "streaming_avatar" : "tts" };
}

export async function loadOutputSettingsFromDB(): Promise<OutputSettings> {
  const value = await loadSetting(OUTPUT_SETTINGS_KEY, outputDefaults);
  return { mode: value.mode === "streaming_avatar" ? "streaming_avatar" : "tts" };
}

export async function saveOutputSettingsToDB(value: OutputSettings): Promise<void> {
  await saveSetting(OUTPUT_SETTINGS_KEY, {
    mode: value.mode === "streaming_avatar" ? "streaming_avatar" : "tts",
  });
}

export function getStreamingAvatarSettings(): StreamingAvatarSettings {
  return normalizeStreamingAvatarSettings(
    readLocal(STREAMING_AVATAR_SETTINGS_KEY, streamingAvatarDefaults),
  );
}

export async function loadStreamingAvatarSettingsFromDB(): Promise<StreamingAvatarSettings> {
  return normalizeStreamingAvatarSettings(
    await loadSetting(STREAMING_AVATAR_SETTINGS_KEY, streamingAvatarDefaults),
  );
}

export async function saveStreamingAvatarSettingsToDB(
  value: StreamingAvatarSettings,
): Promise<void> {
  await saveSetting(STREAMING_AVATAR_SETTINGS_KEY, normalizeStreamingAvatarSettings(value));
}

export function normalizeStreamingAvatarSettings(
  value: Partial<StreamingAvatarSettings>,
): StreamingAvatarSettings {
  const heygen = { ...streamingAvatarDefaults.heygen, ...(value.heygen ?? {}) };
  const tavus = { ...streamingAvatarDefaults.tavus, ...(value.tavus ?? {}) };
  return {
    activeProvider: normalizeProvider(value.activeProvider),
    connectionTimeoutMs: clamp(value.connectionTimeoutMs, 3_000, 30_000, 12_000),
    fallbackTimeoutMs: clamp(value.fallbackTimeoutMs, 1_000, 15_000, 5_000),
    heygen: {
      ...heygen,
      quality:
        heygen.quality === "low" || heygen.quality === "medium" ? heygen.quality : "high",
      sandbox: heygen.sandbox !== false,
    },
    tavus: {
      ...tavus,
      maxDurationSeconds: clamp(tavus.maxDurationSeconds, 60, 3_600, 900),
    },
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}
