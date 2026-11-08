/**
 * Experience settings load (per-device settings plan, lot 1).
 *
 * The player's synchronous getters (`getLLMSettings`, `getTTSSettings`, …) read
 * the environment's local copy in `localStorage`. Before this module, only the
 * admin page refreshed that copy for the LLM, ElevenLabs, the other speech
 * engines and the prompt controls: a phone that had never opened the admin
 * played the code defaults (8 November 2026 diagnosis, sandbox-ulrich).
 *
 * `hydrateExperienceSettings()` reads, in one read-only request, every
 * `admin_settings` key that drives a call for the active environment, writes the
 * resolved values to the local copy (the database is the source; the local copy
 * is only a cache) and refreshes the in-memory caches. The experience starts it
 * on mount; the first call waits for it with a bounded delay and, past that
 * delay or on error, goes on with the local copy or the defaults and reports
 * the fallback (never silently).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveEnvironment,
  removeEnvironmentStorage,
  writeEnvironmentStorage,
  type EnvironmentId,
} from "@/services/environmentContext";
import { primeDeviceServicesFromLocal } from "@/services/deviceServices";
import { resetSTTSettingsCache } from "@/services/stt/settings";
import { resetSTTProviderSettingsCache } from "@/services/stt/providerSettings";
import { resetSTTDictionaryCache } from "@/services/stt/dictionary";
import { trackEvent } from "@/services/posthogService";

/** Every admin setting read during a call (LLM, voice, avatar, STT, gameplay, prompt controls). */
export const EXPERIENCE_SETTING_KEYS = [
  "ava_llm_settings",
  "ava_tts_settings",
  "ava_tts_active_provider",
  "ava_tts_settings_gradium",
  "ava_tts_settings_fish",
  "ava_tts_settings_inworld",
  "ava_tts_settings_cartesia",
  "ava_tts_character_voices",
  "ava_max_prompt_control_settings",
  "ava_anti_hallucination_validator_settings",
  "ava_questionnaire_followup_settings",
  "ava_gameplay_settings",
  "ava_video_trigger_settings",
  "ava_speech_performance",
  "ava_output_settings",
  "ava_streaming_avatar_settings",
  "ava_device_services",
  "ava_stt_settings",
  "ava_stt_provider_settings",
  "ava_stt_dictionary",
] as const;

export type ExperienceSettingKey = (typeof EXPERIENCE_SETTING_KEYS)[number];

export type ExperienceSettingsFallbackReason = "timeout" | "error";

export interface ExperienceSettingsState {
  environmentId: EnvironmentId;
  /** `database`: values read from admin_settings; `fallback`: local copy or code defaults. */
  source: "database" | "fallback";
  reason?: ExperienceSettingsFallbackReason;
  error?: string;
  /** Most recent `updated_at` among the rows read: the settings version used by the call. */
  settingsUpdatedAt: string | null;
  /** Keys read from the active environment's own row. */
  environmentKeys: string[];
  /** Keys inherited from production (no row in the active sandbox). */
  inheritedFromProd: string[];
  /** Keys without any row: code defaults apply. */
  defaultKeys: string[];
  durationMs: number;
}

interface SettingRow {
  key: string;
  environment_id: EnvironmentId;
  value: unknown;
  updated_at: string | null;
}

/** Pure: which row wins per key, and the settings version. */
export function resolveExperienceSettingRows(
  rows: readonly SettingRow[],
  environmentId: EnvironmentId,
  keys: readonly string[] = EXPERIENCE_SETTING_KEYS,
): {
  values: Map<string, unknown>;
  environmentKeys: string[];
  inheritedFromProd: string[];
  defaultKeys: string[];
  settingsUpdatedAt: string | null;
} {
  const values = new Map<string, unknown>();
  const environmentKeys: string[] = [];
  const inheritedFromProd: string[] = [];
  const defaultKeys: string[] = [];
  let settingsUpdatedAt: string | null = null;
  for (const key of keys) {
    const keyRows = rows.filter((row) => row.key === key);
    const own = keyRows.find((row) => row.environment_id === environmentId);
    const chosen = own ?? keyRows.find((row) => row.environment_id === "prod");
    if (!chosen) {
      defaultKeys.push(key);
      continue;
    }
    // Same choice as every single-key load (own environment, else production), without a
    // defaults merge: each getter merges its own defaults when it reads the local copy.
    values.set(key, chosen.value);
    (own ? environmentKeys : inheritedFromProd).push(key);
    if (chosen.updated_at && (!settingsUpdatedAt || chosen.updated_at > settingsUpdatedAt)) {
      settingsUpdatedAt = chosen.updated_at;
    }
  }
  return { values, environmentKeys, inheritedFromProd, defaultKeys, settingsUpdatedAt };
}

function refreshInMemoryCaches(): void {
  resetSTTSettingsCache();
  resetSTTProviderSettingsCache();
  resetSTTDictionaryCache();
  primeDeviceServicesFromLocal();
}

/**
 * Read-only load of every call setting for the active environment. Never writes
 * to the database. Throws when the request fails (the caller reports the fallback).
 */
export async function hydrateExperienceSettings(): Promise<ExperienceSettingsState> {
  const environmentId = getActiveEnvironment();
  const startedAt = Date.now();
  const environments = environmentId === "prod" ? ["prod"] : [environmentId, "prod"];
  const { data, error } = await supabase
    .from("admin_settings" as never)
    .select("key,environment_id,value,updated_at")
    .in("key", [...EXPERIENCE_SETTING_KEYS])
    .in("environment_id", environments);
  if (error) throw new Error(`admin_settings: ${error.message}`);
  if (getActiveEnvironment() !== environmentId) throw new Error("environment changed during settings load");
  const resolved = resolveExperienceSettingRows((data ?? []) as unknown as SettingRow[], environmentId);
  for (const key of EXPERIENCE_SETTING_KEYS) {
    try {
      if (resolved.values.has(key)) {
        writeEnvironmentStorage(key, JSON.stringify(resolved.values.get(key)), environmentId);
      } else {
        // No row: the code defaults are the truth, not a stale copy from an earlier admin visit.
        removeEnvironmentStorage(key, environmentId);
      }
    } catch {
      // Storage unavailable (private browsing): getters keep the defaults.
    }
  }
  refreshInMemoryCaches();
  return {
    environmentId,
    source: "database",
    settingsUpdatedAt: resolved.settingsUpdatedAt,
    environmentKeys: resolved.environmentKeys,
    inheritedFromProd: resolved.inheritedFromProd,
    defaultKeys: resolved.defaultKeys,
    durationMs: Date.now() - startedAt,
  };
}

let pending: { environmentId: EnvironmentId; promise: Promise<ExperienceSettingsState> } | null = null;
let lastState: ExperienceSettingsState | null = null;

/** Starts (once per environment and page) the settings load; returns the shared promise. */
export function startExperienceSettingsLoad(): Promise<ExperienceSettingsState> {
  const environmentId = getActiveEnvironment();
  if (pending && pending.environmentId === environmentId) return pending.promise;
  const promise = hydrateExperienceSettings().then((state) => {
    lastState = state;
    return state;
  });
  pending = { environmentId, promise };
  // A failed load may be retried by the next call preparation.
  promise.catch(() => {
    if (pending?.promise === promise) pending = null;
  });
  return promise;
}

/** Default wait before the first call goes on without the database values. */
export const EXPERIENCE_SETTINGS_TIMEOUT_MS = 2_500;

function fallbackState(reason: ExperienceSettingsFallbackReason, error: unknown, startedAt: number): ExperienceSettingsState {
  return {
    environmentId: getActiveEnvironment(),
    source: "fallback",
    reason,
    error: error instanceof Error ? error.message : String(error),
    settingsUpdatedAt: null,
    environmentKeys: [],
    inheritedFromProd: [],
    defaultKeys: [],
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Waits for the settings load at most `timeoutMs`. Past that delay or on error,
 * the call goes on with the local copy or the code defaults, and the fallback is
 * reported (console + `prd4_settings_fallback` event).
 */
export async function ensureExperienceSettings(
  options: { timeoutMs?: number; sessionContext?: string } = {},
): Promise<ExperienceSettingsState> {
  const timeoutMs = options.timeoutMs ?? EXPERIENCE_SETTINGS_TIMEOUT_MS;
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  let state: ExperienceSettingsState;
  try {
    const outcome = await Promise.race([startExperienceSettingsLoad(), timeout]);
    state = outcome === "timeout"
      ? fallbackState("timeout", new Error(`settings load exceeded ${timeoutMs} ms`), startedAt)
      : outcome;
  } catch (error) {
    state = fallbackState("error", error, startedAt);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (state.source === "fallback") {
    lastState = state;
    console.warn("[Settings] experience settings fallback: local copy or code defaults", state);
    trackEvent("prd4_settings_fallback", {
      environment_id: state.environmentId,
      reason: state.reason,
      error: state.error?.slice(0, 200),
      timeout_ms: timeoutMs,
      context: options.sessionContext ?? "call",
    });
  } else if (state.inheritedFromProd.length > 0 && state.environmentId !== "prod") {
    console.info("[Settings] keys inherited from production", state.inheritedFromProd);
  }
  return state;
}

/** Last known load state (null before the first load). */
export function getExperienceSettingsState(): ExperienceSettingsState | null {
  return lastState;
}

/** Test helper. */
export function resetExperienceSettingsForTests(): void {
  pending = null;
  lastState = null;
}
