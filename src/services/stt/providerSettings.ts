/**
 * Per-provider STT API settings. Each provider has its own knob set (model,
 * language, endpointing, etc.) exposed through the admin STT Config tab and
 * consumed by the runtime STT client/proxy.
 *
 * Stored in `admin_settings.value` under key `ava_stt_provider_settings` as a
 * single object keyed by provider id. Local cache mirrors the DB copy through
 * `localStorage` for zero-flash reads.
 */

import { supabase } from "@/integrations/supabase/client";
import type { STTProviderId } from "./types";

// ---------------- Types ----------------

export interface DeepgramProviderSettings {
  model: string; // "nova-3" | "nova-2" | "nova-2-general" | free text
  language: string; // "fr-FR" | "en-US" | "multi" | free text
  smartFormat: boolean;
  punctuate: boolean;
  interimResults: boolean;
  vadEvents: boolean;
  /** Milliseconds of silence before Deepgram emits a speech_final. 0 disables. */
  endpointing: number;
  /** Milliseconds of silence to trigger an utterance_end event. */
  utteranceEndMs: number;
  fillerWords: boolean;
  numerals: boolean;
}

export interface AssemblyAIProviderSettings {
  formatTurns: boolean;
  minEndOfTurnSilenceWhenConfident: number; // ms
  endOfTurnConfidenceThreshold: number; // 0..1
}

export interface OpenAIWhisperProviderSettings {
  model: string; // "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe"
  language: string; // "fr" | "en" | "auto"
  temperature: number; // 0..1
}

export interface GradiumProviderSettings {
  language: string; // "fr" | "en" | "auto"
}

export type GamilabProviderSettings = Record<string, never>;

export interface STTProviderSettingsMap {
  deepgram: DeepgramProviderSettings;
  assemblyai: AssemblyAIProviderSettings;
  openai_whisper: OpenAIWhisperProviderSettings;
  gradium: GradiumProviderSettings;
  gamilab: GamilabProviderSettings;
}

// ---------------- Defaults ----------------

export const DEFAULT_STT_PROVIDER_SETTINGS: STTProviderSettingsMap = {
  deepgram: {
    model: "nova-3",
    language: "fr-FR",
    smartFormat: true,
    punctuate: true,
    interimResults: true,
    vadEvents: true,
    endpointing: 0,
    utteranceEndMs: 1500,
    fillerWords: false,
    numerals: true,
  },
  assemblyai: {
    formatTurns: true,
    minEndOfTurnSilenceWhenConfident: 400,
    endOfTurnConfidenceThreshold: 0.7,
  },
  openai_whisper: {
    model: "whisper-1",
    language: "fr",
    temperature: 0.0,
  },
  gradium: {
    language: "fr",
  },
  gamilab: {},
};

// ---------------- Storage ----------------

const STORAGE_KEY = "ava_stt_provider_settings";

let cached: STTProviderSettingsMap | null = null;
let loadPromise: Promise<STTProviderSettingsMap> | null = null;

function merge(input: unknown): STTProviderSettingsMap {
  const src = (input && typeof input === "object" ? input : {}) as Partial<STTProviderSettingsMap>;
  return {
    deepgram: { ...DEFAULT_STT_PROVIDER_SETTINGS.deepgram, ...(src.deepgram ?? {}) },
    assemblyai: { ...DEFAULT_STT_PROVIDER_SETTINGS.assemblyai, ...(src.assemblyai ?? {}) },
    openai_whisper: { ...DEFAULT_STT_PROVIDER_SETTINGS.openai_whisper, ...(src.openai_whisper ?? {}) },
    gradium: { ...DEFAULT_STT_PROVIDER_SETTINGS.gradium, ...(src.gradium ?? {}) },
    gamilab: { ...DEFAULT_STT_PROVIDER_SETTINGS.gamilab, ...(src.gamilab ?? {}) },
  };
}

export function getAllSTTProviderSettings(): STTProviderSettingsMap {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cached = merge(JSON.parse(raw));
      return cached;
    }
  } catch { /* ignore */ }
  cached = merge({});
  return cached;
}

export function getSTTProviderSettings<K extends STTProviderId>(providerId: K): STTProviderSettingsMap[K] {
  return getAllSTTProviderSettings()[providerId];
}

export async function loadSTTProviderSettingsFromDB(): Promise<STTProviderSettingsMap> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("admin_settings" as never)
        .select("value")
        .eq("key", STORAGE_KEY)
        .maybeSingle();
      if (!error && data) {
        cached = merge((data as { value: unknown }).value);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* ignore */ }
        return cached;
      }
    } catch (err) {
      console.warn("[STT ProviderSettings] DB load failed:", err);
    }
    return getAllSTTProviderSettings();
  })().finally(() => { loadPromise = null; });
  return loadPromise;
}

export async function saveSTTProviderSettings<K extends STTProviderId>(
  providerId: K,
  patch: Partial<STTProviderSettingsMap[K]>,
): Promise<STTProviderSettingsMap> {
  const current = getAllSTTProviderSettings();
  const next: STTProviderSettingsMap = {
    ...current,
    [providerId]: { ...current[providerId], ...patch } as STTProviderSettingsMap[K],
  };
  cached = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  try {
    const { error } = await supabase
      .from("admin_settings" as never)
      .upsert(
        { key: STORAGE_KEY, value: next as unknown, updated_at: new Date().toISOString() } as never,
        { onConflict: "key" },
      );
    if (error) console.error("[STT ProviderSettings] DB save failed:", error.message);
  } catch (err) {
    console.error("[STT ProviderSettings] DB save exception:", err);
  }
  return next;
}

export function resetSTTProviderSettings<K extends STTProviderId>(providerId: K): STTProviderSettingsMap[K] {
  return saveSTTProviderSettings(providerId, DEFAULT_STT_PROVIDER_SETTINGS[providerId]).then(
    (all) => all[providerId],
  ) as unknown as STTProviderSettingsMap[K];
}

export function resetSTTProviderSettingsCache() {
  cached = null;
  loadPromise = null;
}
