import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from "@/services/environmentContext";
import {
  boundedInteger,
  HEYGEN_ENCODINGS,
  HEYGEN_QUALITIES,
  normalizeAnamSettings,
  normalizeHeyGenVoiceSettings,
  normalizeLemonSliceSettings,
  normalizeTavusLanguages,
  pickEnum,
  safeLanguageCode,
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  STREAMING_AVATAR_BOUNDS,
  TAVUS_DEFAULT_LANGUAGES,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";
import {
  TAVUS_EMOTIONS,
  type OutputSettings,
  type StreamingAvatarProviderId,
  type StreamingAvatarSettings,
  type TavusEmotion,
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
    encoding: "H264",
    maxSessionDurationSeconds: 0,
    voiceSettings: normalizeHeyGenVoiceSettings(undefined),
    sandbox: true,
  },
  tavus: {
    replicaId: "",
    personaId: "",
    languages: [...TAVUS_DEFAULT_LANGUAGES],
    maxDurationSeconds: 900,
    participantAbsentTimeoutSeconds: 120,
    participantLeftTimeoutSeconds: 30,
    enableClosedCaptions: false,
    applyGreenscreen: false,
    euPolicy: false,
    emotion: "sadness",
    listeningEmotion: "neutral",
  },
  // Sad speaking style and closed idling attitude, like the Tavus emotions; IDs set in the admin.
  anam: normalizeAnamSettings(undefined),
  // Dejected speaking prompt and closed idle prompt; avatar id or image set in the admin.
  lemonslice: normalizeLemonSliceSettings(undefined),
};

function readLocal<T>(key: string, defaults: T): T {
  try {
    const stored = readEnvironmentStorage(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {
    // Keep safe defaults when local storage is unavailable or malformed.
  }
  return { ...defaults };
}

async function loadSetting<T>(key: string, defaults: T): Promise<T> {
  return loadEnvironmentSetting(key, defaults);
}

async function saveSetting<T>(key: string, value: T): Promise<void> {
  await saveEnvironmentSetting(key, value);
}

function normalizeProvider(value: unknown): StreamingAvatarProviderId {
  // Unknown providers fall back to HeyGen.
  return pickEnum(value, SELECTABLE_STREAMING_AVATAR_PROVIDERS, "heygen");
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

/**
 * Tolerant normalization: older JSON (Tavus `language: "French"`, HeyGen without voice settings,
 * no `anam` or `lemonslice` block) is read without loss; unknown or out of bounds values return to their default.
 */
export function normalizeStreamingAvatarSettings(
  value: Partial<StreamingAvatarSettings>,
): StreamingAvatarSettings {
  const raw = (value ?? {}) as Record<string, unknown>;
  const heygen = asRecord(raw.heygen);
  const tavus = asRecord(raw.tavus);
  const b = STREAMING_AVATAR_BOUNDS;
  const heygenDefaults = streamingAvatarDefaults.heygen;
  const tavusDefaults = streamingAvatarDefaults.tavus;
  return {
    activeProvider: normalizeProvider(raw.activeProvider),
    connectionTimeoutMs: clamp(raw.connectionTimeoutMs, 3_000, 30_000, 12_000),
    fallbackTimeoutMs: clamp(raw.fallbackTimeoutMs, 1_000, 15_000, 5_000),
    heygen: {
      avatarId: text(heygen.avatarId, heygenDefaults.avatarId),
      voiceId: text(heygen.voiceId, heygenDefaults.voiceId),
      contextId: text(heygen.contextId, heygenDefaults.contextId),
      language: safeLanguageCode(heygen.language, heygenDefaults.language),
      quality: pickEnum(heygen.quality, HEYGEN_QUALITIES, heygenDefaults.quality),
      encoding: pickEnum(heygen.encoding, HEYGEN_ENCODINGS, heygenDefaults.encoding),
      maxSessionDurationSeconds: boundedInteger(
        heygen.maxSessionDurationSeconds,
        b.heygenMaxSessionSeconds,
      ),
      voiceSettings: normalizeHeyGenVoiceSettings(heygen.voiceSettings),
      sandbox: heygen.sandbox !== false,
    },
    tavus: {
      replicaId: text(tavus.replicaId, tavusDefaults.replicaId),
      personaId: text(tavus.personaId, tavusDefaults.personaId),
      languages: normalizeTavusLanguages(tavus.languages, tavus.language),
      maxDurationSeconds: boundedInteger(tavus.maxDurationSeconds, b.tavusMaxCallSeconds),
      participantAbsentTimeoutSeconds: boundedInteger(
        tavus.participantAbsentTimeoutSeconds,
        b.tavusAbsentTimeoutSeconds,
      ),
      participantLeftTimeoutSeconds: boundedInteger(
        tavus.participantLeftTimeoutSeconds,
        b.tavusLeftTimeoutSeconds,
      ),
      enableClosedCaptions: tavus.enableClosedCaptions === true,
      applyGreenscreen: tavus.applyGreenscreen === true,
      euPolicy: tavus.euPolicy === true,
      emotion: normalizeTavusEmotion(tavus.emotion),
      listeningEmotion: normalizeTavusEmotion(
        tavus.listeningEmotion,
        tavusDefaults.listeningEmotion,
      ),
    },
    anam: normalizeAnamSettings(raw.anam),
    lemonslice: normalizeLemonSliceSettings(raw.lemonslice),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeTavusEmotion(
  value: unknown,
  fallback: TavusEmotion = streamingAvatarDefaults.tavus.emotion,
): TavusEmotion {
  return TAVUS_EMOTIONS.includes(value as TavusEmotion) ? (value as TavusEmotion) : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}
