// Streaming avatar request builders, shared by the streaming-avatar-session Edge Function and the
// client (settings normalization, admin bounds, tests). Pure TypeScript, no Deno or browser import.
// Every provider field is whitelisted and bounded here: no client value reaches a provider as is.
// Sources read on 2 November 2026: LiveAvatar "Create session token" (FULL mode) and Tavus
// "Create conversation" + "Language support".

export const STREAMING_AVATAR_PROVIDERS = ["heygen", "tavus", "anam", "lemonslice"] as const;
export type KnownStreamingAvatarProvider = (typeof STREAMING_AVATAR_PROVIDERS)[number];
/** Providers with a client factory and a configured secret; Anam and LemonSlice come in AV2/AV3. */
export const SELECTABLE_STREAMING_AVATAR_PROVIDERS = ["heygen", "tavus"] as const;
export type SelectableStreamingAvatarProvider =
  (typeof SELECTABLE_STREAMING_AVATAR_PROVIDERS)[number];

export const HEYGEN_QUALITIES = ["very_high", "high", "medium", "low"] as const;
export const HEYGEN_ENCODINGS = ["H264", "VP8"] as const;
/** "default" sends no voice_settings: the voice keeps the settings chosen in LiveAvatar. */
export const HEYGEN_VOICE_ENGINES = ["default", "elevenLabs", "fish", "cartesia"] as const;
export const HEYGEN_ELEVENLABS_MODELS = [
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
  "eleven_v3",
  "eleven_v3_conversational",
  "eleven_v4_turbo",
] as const;
/** LiveAvatar: these models honor only `stability`; the other fields are not sent. */
export const HEYGEN_ELEVENLABS_STABILITY_ONLY: readonly string[] = [
  "eleven_v3",
  "eleven_v3_conversational",
  "eleven_v4_turbo",
];
export const HEYGEN_FISH_MODELS = ["s2.1-pro", "s2-pro", "s2", "s1"] as const;
export const HEYGEN_FISH_LATENCY_MODES = ["balanced", "normal", "low"] as const;
export const HEYGEN_CARTESIA_MODELS = [
  "sonic-3.6",
  "sonic-3.5",
  "sonic-3",
  "sonic-2",
  "sonic-turbo",
] as const;

export type HeyGenQuality = (typeof HEYGEN_QUALITIES)[number];
export type HeyGenEncoding = (typeof HEYGEN_ENCODINGS)[number];
export type HeyGenVoiceEngine = (typeof HEYGEN_VOICE_ENGINES)[number];

export interface NumberBounds {
  min: number;
  max: number;
  step: number;
  fallback: number;
}

export const STREAMING_AVATAR_BOUNDS = {
  /** 0 = not sent: LiveAvatar applies the subscription limit. */
  heygenMaxSessionSeconds: { min: 0, max: 3_600, step: 60, fallback: 0 },
  elevenLabsSpeed: { min: 0.8, max: 1.2, step: 0.05, fallback: 1 },
  elevenLabsStability: { min: 0, max: 1, step: 0.05, fallback: 0.75 },
  elevenLabsSimilarity: { min: 0, max: 1, step: 0.05, fallback: 0.75 },
  elevenLabsStyle: { min: 0, max: 1, step: 0.05, fallback: 0 },
  fishSpeed: { min: 0.8, max: 1.2, step: 0.05, fallback: 1 },
  cartesiaSpeed: { min: 0.6, max: 1.5, step: 0.05, fallback: 1 },
  tavusMaxCallSeconds: { min: 60, max: 3_600, step: 60, fallback: 900 },
  tavusAbsentTimeoutSeconds: { min: 10, max: 3_600, step: 10, fallback: 120 },
  tavusLeftTimeoutSeconds: { min: 0, max: 3_600, step: 10, fallback: 30 },
} satisfies Record<string, NumberBounds>;

export const TAVUS_MAX_LANGUAGES = 42;
export const TAVUS_DEFAULT_LANGUAGES = ["fr"];

/** Deprecated `properties.language` names still stored by older settings. */
const TAVUS_LEGACY_LANGUAGE_CODES: Record<string, string> = {
  french: "fr",
  english: "en",
  spanish: "es",
  german: "de",
  italian: "it",
  portuguese: "pt",
  dutch: "nl",
};

export function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Out of bounds or not a number → default (a stored value is never silently stretched). */
export function boundedNumber(value: unknown, bounds: NumberBounds): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return bounds.fallback;
  if (value < bounds.min || value > bounds.max) return bounds.fallback;
  return Math.round(value * 100) / 100;
}

export function boundedInteger(value: unknown, bounds: NumberBounds): number {
  const number = boundedNumber(value, bounds);
  return Math.round(number);
}

export function safeProviderId(value: unknown, optional = false): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed && optional) return "";
  return /^[A-Za-z0-9_-]{1,200}$/.test(trimmed) ? trimmed : "";
}

export function safeLanguageCode(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(trimmed) ? trimmed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// HeyGen LiveAvatar — POST /v1/sessions/token (FULL mode)
// ---------------------------------------------------------------------------

export interface HeyGenElevenLabsVoice {
  model: (typeof HEYGEN_ELEVENLABS_MODELS)[number];
  speed: number;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface HeyGenFishVoice {
  model: (typeof HEYGEN_FISH_MODELS)[number];
  speed: number;
  latencyMode: (typeof HEYGEN_FISH_LATENCY_MODES)[number];
}

export interface HeyGenCartesiaVoice {
  model: (typeof HEYGEN_CARTESIA_MODELS)[number];
  speed: number;
}

/** All three engines are kept so switching engine in the admin loses nothing. */
export interface HeyGenVoiceSettings {
  engine: HeyGenVoiceEngine;
  elevenLabs: HeyGenElevenLabsVoice;
  fish: HeyGenFishVoice;
  cartesia: HeyGenCartesiaVoice;
}

export function normalizeHeyGenVoiceSettings(value: unknown): HeyGenVoiceSettings {
  const raw = asRecord(value);
  const eleven = asRecord(raw.elevenLabs);
  const fish = asRecord(raw.fish);
  const cartesia = asRecord(raw.cartesia);
  const b = STREAMING_AVATAR_BOUNDS;
  return {
    engine: pickEnum(raw.engine, HEYGEN_VOICE_ENGINES, "default"),
    elevenLabs: {
      model: pickEnum(eleven.model, HEYGEN_ELEVENLABS_MODELS, "eleven_flash_v2_5"),
      speed: boundedNumber(eleven.speed, b.elevenLabsSpeed),
      stability: boundedNumber(eleven.stability, b.elevenLabsStability),
      similarityBoost: boundedNumber(eleven.similarityBoost, b.elevenLabsSimilarity),
      style: boundedNumber(eleven.style, b.elevenLabsStyle),
      useSpeakerBoost: eleven.useSpeakerBoost !== false,
    },
    fish: {
      model: pickEnum(fish.model, HEYGEN_FISH_MODELS, "s2.1-pro"),
      speed: boundedNumber(fish.speed, b.fishSpeed),
      latencyMode: pickEnum(fish.latencyMode, HEYGEN_FISH_LATENCY_MODES, "balanced"),
    },
    cartesia: {
      model: pickEnum(cartesia.model, HEYGEN_CARTESIA_MODELS, "sonic-3.6"),
      speed: boundedNumber(cartesia.speed, b.cartesiaSpeed),
    },
  };
}

/** Provider payload for the chosen engine only, with only the fields its model reads. */
export function buildHeyGenVoiceSettings(
  value: unknown,
): Record<string, string | number | boolean> | null {
  const voice = normalizeHeyGenVoiceSettings(value);
  if (voice.engine === "elevenLabs") {
    const eleven = voice.elevenLabs;
    if (HEYGEN_ELEVENLABS_STABILITY_ONLY.includes(eleven.model)) {
      return { provider: "elevenLabs", model: eleven.model, stability: eleven.stability };
    }
    return {
      provider: "elevenLabs",
      model: eleven.model,
      speed: eleven.speed,
      stability: eleven.stability,
      similarity_boost: eleven.similarityBoost,
      style: eleven.style,
      use_speaker_boost: eleven.useSpeakerBoost,
    };
  }
  if (voice.engine === "fish") {
    return {
      provider: "fish",
      model: voice.fish.model,
      speed: voice.fish.speed,
      latency_mode: voice.fish.latencyMode,
    };
  }
  if (voice.engine === "cartesia") {
    return { provider: "cartesia", model: voice.cartesia.model, speed: voice.cartesia.speed };
  }
  return null;
}

export type BuildResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

export function buildHeyGenSessionRequest(config: unknown): BuildResult {
  const raw = asRecord(config);
  const avatarId = safeProviderId(raw.avatarId);
  const voiceId = safeProviderId(raw.voiceId);
  const contextId = safeProviderId(raw.contextId, true);
  if (!avatarId || !voiceId) return { ok: false, error: "HeyGen avatarId and voiceId are required" };

  const avatarPersona: Record<string, unknown> = {
    voice_id: voiceId,
    language: safeLanguageCode(raw.language, "fr"),
  };
  if (contextId) avatarPersona.context_id = contextId;
  const voiceSettings = buildHeyGenVoiceSettings(raw.voiceSettings);
  if (voiceSettings) avatarPersona.voice_settings = voiceSettings;

  const body: Record<string, unknown> = {
    mode: "FULL",
    avatar_id: avatarId,
    avatar_persona: avatarPersona,
    video_settings: {
      quality: pickEnum(raw.quality, HEYGEN_QUALITIES, "high"),
      encoding: pickEnum(raw.encoding, HEYGEN_ENCODINGS, "H264"),
    },
    is_sandbox: raw.sandbox !== false,
    // Ava owns the microphone, STT and LLM: the avatar only says the text it receives.
    interactivity_type: "PUSH_TO_TALK",
  };
  const maxSessionDuration = boundedInteger(
    raw.maxSessionDurationSeconds,
    STREAMING_AVATAR_BOUNDS.heygenMaxSessionSeconds,
  );
  if (maxSessionDuration >= 60) body.max_session_duration = maxSessionDuration;
  return { ok: true, body };
}

// ---------------------------------------------------------------------------
// Tavus — POST /v2/conversations (Echo PAL)
// ---------------------------------------------------------------------------

/** `languages` codes; falls back to the deprecated `language` name, then to ["fr"]. */
export function normalizeTavusLanguages(languages: unknown, legacyLanguage?: unknown): string[] {
  if (Array.isArray(languages)) {
    const codes = languages
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
      .filter((entry) => entry.length <= 16 && safeLanguageCode(entry, "") === entry && entry);
    const unique = [...new Set(codes)].slice(0, TAVUS_MAX_LANGUAGES);
    if (unique.length) return unique;
  }
  if (typeof legacyLanguage === "string") {
    const name = legacyLanguage.trim().toLowerCase();
    const code = TAVUS_LEGACY_LANGUAGE_CODES[name] ?? (safeLanguageCode(name, "") || "");
    if (code && code.length <= 16) return [code];
  }
  return [...TAVUS_DEFAULT_LANGUAGES];
}

export interface TavusConversationTarget {
  avaSessionId: string;
  palId: string;
  faceId: string;
  /** Older accounts only know persona_id/replica_id. */
  legacyPersona: boolean;
  /** Creates the conversation already ended; the PAL never joins (admin configuration check). */
  testMode?: boolean;
}

export function buildTavusConversationRequest(
  config: unknown,
  target: TavusConversationTarget,
): Record<string, unknown> {
  const raw = asRecord(config);
  const b = STREAMING_AVATAR_BOUNDS;
  const properties: Record<string, unknown> = {
    languages: normalizeTavusLanguages(raw.languages, raw.language),
    max_call_duration: boundedInteger(raw.maxDurationSeconds, b.tavusMaxCallSeconds),
    participant_absent_timeout: boundedInteger(
      raw.participantAbsentTimeoutSeconds,
      b.tavusAbsentTimeoutSeconds,
    ),
    participant_left_timeout: boundedInteger(
      raw.participantLeftTimeoutSeconds,
      b.tavusLeftTimeoutSeconds,
    ),
  };
  if (raw.enableClosedCaptions === true) properties.enable_closed_captions = true;
  if (raw.applyGreenscreen === true) properties.apply_greenscreen = true;

  const body: Record<string, unknown> = {
    audio_only: false,
    require_auth: true,
    max_participants: 2,
    conversation_name: `Ava ${target.avaSessionId.slice(0, 8)}`,
    properties,
  };
  if (raw.euPolicy === true) body.policy = "eu";
  if (target.testMode) body.test_mode = true;
  if (target.legacyPersona) {
    body.persona_id = target.palId;
    if (target.faceId) body.replica_id = target.faceId;
  } else {
    body.pal_id = target.palId;
    if (target.faceId) body.face_id = target.faceId;
  }
  return body;
}

/** Read-only view of the PAL voice (`layers.tts`); never contains a key or a URL. */
export function summarizeTavusPalVoice(pal: unknown): Record<string, unknown> {
  const tts = asRecord(asRecord(asRecord(pal).layers).tts);
  const summary: Record<string, unknown> = {};
  for (const key of ["tts_engine", "voice_id", "external_voice_id", "tts_model_name"]) {
    if (typeof tts[key] === "string") summary[key] = (tts[key] as string).slice(0, 120);
  }
  const voiceSettings = asRecord(tts.voice_settings);
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(voiceSettings)) {
    if (typeof value === "number" || typeof value === "boolean") settings[key] = value;
    if (typeof value === "string") settings[key] = value.slice(0, 60);
  }
  if (Object.keys(settings).length) summary.voice_settings = settings;
  return summary;
}
