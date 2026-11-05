// Streaming avatar request builders, shared by the streaming-avatar-session Edge Function and the
// client (settings normalization, admin bounds, tests). Pure TypeScript, no Deno or browser import.
// Every provider field is whitelisted and bounded here: no client value reaches a provider as is.
// Sources read on 2 November 2026: LiveAvatar "Create session token" (FULL mode), Tavus
// "Create conversation" + "Language support", Anam "Create session token" + "Director Notes",
// LemonSlice "WebSocket" + "Control session" (see the LemonSlice section).

export const STREAMING_AVATAR_PROVIDERS = ["heygen", "tavus", "anam", "lemonslice"] as const;
export type KnownStreamingAvatarProvider = (typeof STREAMING_AVATAR_PROVIDERS)[number];
/** Providers with a client factory and a configured secret. */
export const SELECTABLE_STREAMING_AVATAR_PROVIDERS = ["heygen", "tavus", "anam", "lemonslice"] as const;
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
  anamMaxSessionSeconds: { min: 60, max: 3_600, step: 60, fallback: 900 },
  anamExpressivity: { min: 0, max: 1, step: 0.05, fallback: 0.4 },
  anamElevenLabsSpeed: { min: 0.7, max: 1.2, step: 0.05, fallback: 1 },
  anamCartesiaVolume: { min: 0.5, max: 2, step: 0.05, fallback: 1 },
  anamCartesiaSpeed: { min: 0.6, max: 1.5, step: 0.05, fallback: 1 },
  anamFishVolume: { min: 0.5, max: 2, step: 0.05, fallback: 1 },
  anamFishSpeed: { min: 0.5, max: 2, step: 0.05, fallback: 1 },
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

// ---------------------------------------------------------------------------
// Anam — POST /v1/auth/session-token (ephemeral persona, client-driven speech)
// ---------------------------------------------------------------------------

export const ANAM_AVATAR_MODELS = ["cara-4.1-express", "cara-4", "cara-4-latest", "cara-3"] as const;
/**
 * Recommended by Anam (docs, 5 November 2026). `cara-4-latest` may change from one session to
 * the next and is not advised in production; a saved value is kept as is.
 */
export const ANAM_DEFAULT_AVATAR_MODEL: AnamAvatarModel = "cara-4.1-express";
/** Director Notes are read by Cara 4 models only; they are not sent for cara-3. */
export const ANAM_DIRECTOR_NOTES_MODELS: readonly string[] = [
  "cara-4-latest",
  "cara-4",
  "cara-4.1-express",
];
export const ANAM_PRESET_STYLES = [
  "neutral",
  "sad",
  "distressed",
  "supportive",
  "warm",
  "playful",
  "happy",
  "angry",
] as const;
export const ANAM_STYLE_MODES = ["default", "preset", "custom"] as const;
/** Inline cue tags read by Anam in the spoken text (`[sad] …`); "none" sends no tag. */
export const ANAM_CUE_TAGS = [
  "none",
  "sad",
  "distressed",
  "concerned",
  "angry",
  "surprised",
  "curious",
  "supportive",
  "warm",
  "playful",
  "happy",
  "laughter",
] as const;
/** Cues that make the face smile: never a default (Max and Emma never smile). */
export const ANAM_SMILING_CUE_TAGS: readonly string[] = ["playful", "happy", "laughter"];
/**
 * "evolving": the cue follows the per-turn acting intent (Game Master speech state, GM memory
 * or the line itself); "fixed": `speakingCue` on every line, as before AN2.
 */
export const ANAM_EMOTION_CUE_MODES = ["evolving", "fixed"] as const;
/** Canonical acting emotions, kept identical to `CANONICAL_EMOTIONS` in performanceIntent.ts. */
export const ANAM_PERFORMANCE_EMOTIONS = [
  "neutral",
  "tense",
  "angry",
  "sad",
  "scared",
  "fragile",
  "warm",
  "accusatory",
  "sarcastic",
  "urgent",
] as const;
/** Characters whose cue table is always shown in the admin; others keep a saved table. */
export const ANAM_EMOTION_CUE_CHARACTERS = ["max", "emma"] as const;
/**
 * Default emotion → cue table, without any smile. `neutral` and `sarcastic` send no cue: the
 * Director Notes base style carries the line; `warm` stays `concerned` (warm would smile).
 */
export const ANAM_DEFAULT_EMOTION_CUES: Readonly<Record<AnamPerformanceEmotion, AnamCueTag>> = {
  neutral: "none",
  tense: "concerned",
  angry: "angry",
  accusatory: "angry",
  sad: "sad",
  fragile: "sad",
  scared: "distressed",
  urgent: "distressed",
  warm: "concerned",
  sarcastic: "none",
};
/** "default" sends no voiceGenerationOptions: the voice keeps its Anam settings. */
export const ANAM_VOICE_ENGINES = ["default", "elevenLabs", "cartesia", "fish"] as const;
export const ANAM_ELEVENLABS_MODELS = [
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_v3",
  "eleven_v3_conversational",
  "eleven_v4_turbo",
  "eleven_v4",
] as const;
/** Anam: v3 models read `stability` only; v4 models `stability` and `similarityBoost`. */
export const ANAM_ELEVENLABS_STABILITY_ONLY: readonly string[] = ["eleven_v3", "eleven_v3_conversational"];
export const ANAM_ELEVENLABS_V4: readonly string[] = ["eleven_v4_turbo", "eleven_v4"];
export const ANAM_CARTESIA_EMOTIONS = ["sad", "neutral", "calm", "scared", "angry", "content"] as const;
export const ANAM_VIDEO_QUALITIES = ["high", "auto"] as const;
/** "auto" sends no region: Anam picks the closest one. */
export const ANAM_REGIONS = ["auto", "eu", "us"] as const;
export const ANAM_REGION_POLICIES = ["preferred", "strict"] as const;
export const ANAM_STYLE_PROMPT_MAX = 2_000;
/** Forced by Ava: Anam's LLM is off, the persona only says the text Ava sends. */
export const ANAM_CLIENT_LLM_ID = "CUSTOMER_CLIENT_V1";
/** The token starts one session, shortly after it is issued. */
export const ANAM_TOKEN_TTL_SECONDS = 300;

export const ANAM_DEFAULT_STYLE_PROMPT =
  "A grieving adult in deep distress. Low energy, heavy eyes, a slight frown, slow and " +
  "restrained movements. Never smile, never look cheerful, friendly or reassuring.";
export const ANAM_DEFAULT_IDLE_STYLE_PROMPT =
  "Listening in silence, closed and guarded. Still, neutral face, lips together, steady gaze. " +
  "Never smile, never nod encouragingly.";

export type AnamAvatarModel = (typeof ANAM_AVATAR_MODELS)[number];
export type AnamPresetStyle = (typeof ANAM_PRESET_STYLES)[number];
export type AnamStyleMode = (typeof ANAM_STYLE_MODES)[number];
export type AnamCueTag = (typeof ANAM_CUE_TAGS)[number];
export type AnamVoiceEngine = (typeof ANAM_VOICE_ENGINES)[number];
export type AnamEmotionCueMode = (typeof ANAM_EMOTION_CUE_MODES)[number];
export type AnamPerformanceEmotion = (typeof ANAM_PERFORMANCE_EMOTIONS)[number];
export type AnamEmotionCueMap = Record<AnamPerformanceEmotion, AnamCueTag>;

export interface AnamDirectorNotes {
  /** default: nothing sent; preset: `presetStyle`; custom: speaking and idling prompts. */
  mode: AnamStyleMode;
  presetStyle: AnamPresetStyle;
  customStylePrompt: string;
  /** Attitude while the player speaks; Anam accepts it only with a custom prompt. */
  customIdlingStylePrompt: string;
  expressivity: number;
}

export interface AnamElevenLabsVoice {
  model: (typeof ANAM_ELEVENLABS_MODELS)[number];
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

export interface AnamCartesiaVoice {
  volume: number;
  speed: number;
  emotion: (typeof ANAM_CARTESIA_EMOTIONS)[number];
}

export interface AnamFishVoice {
  volume: number;
  speed: number;
}

/** All three engines are kept so switching engine in the admin loses nothing. */
export interface AnamVoiceGenerationOptions {
  /** Must match the engine of the chosen Anam voice; only the fields it reads are sent. */
  engine: AnamVoiceEngine;
  elevenLabs: AnamElevenLabsVoice;
  cartesia: AnamCartesiaVoice;
  fish: AnamFishVoice;
}

export interface AnamSessionOptions {
  videoQuality: (typeof ANAM_VIDEO_QUALITIES)[number];
  region: (typeof ANAM_REGIONS)[number];
  regionPolicy: (typeof ANAM_REGION_POLICIES)[number];
  /** Anam keeps a recording and the transcripts of the session when enabled. */
  keepRecording: boolean;
  keepTranscripts: boolean;
}

export interface AnamAvatarSettings {
  avatarId: string;
  avatarModel: AnamAvatarModel;
  voiceId: string;
  languageCode: string;
  maxSessionLengthSeconds: number;
  directorNotes: AnamDirectorNotes;
  /**
   * Face-only cue sent over the data channel before each line: always in "fixed" mode, and in
   * "evolving" mode when the turn carries no acting intent.
   */
  speakingCue: AnamCueTag;
  emotionCueMode: AnamEmotionCueMode;
  /** Per character key; every table is complete (missing emotions take the default). */
  emotionCues: Record<string, AnamEmotionCueMap>;
  voiceGenerationOptions: AnamVoiceGenerationOptions;
  sessionOptions: AnamSessionOptions;
}

function boundedText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  return value.length <= max ? value : fallback;
}

export function normalizeAnamSettings(value: unknown): AnamAvatarSettings {
  const raw = asRecord(value);
  const notes = asRecord(raw.directorNotes);
  const voice = asRecord(raw.voiceGenerationOptions);
  const eleven = asRecord(voice.elevenLabs);
  const cartesia = asRecord(voice.cartesia);
  const fish = asRecord(voice.fish);
  const session = asRecord(raw.sessionOptions);
  const b = STREAMING_AVATAR_BOUNDS;
  return {
    avatarId: typeof raw.avatarId === "string" ? raw.avatarId : "",
    avatarModel: pickEnum(raw.avatarModel, ANAM_AVATAR_MODELS, ANAM_DEFAULT_AVATAR_MODEL),
    voiceId: typeof raw.voiceId === "string" ? raw.voiceId : "",
    languageCode: safeLanguageCode(raw.languageCode, "fr"),
    maxSessionLengthSeconds: boundedInteger(raw.maxSessionLengthSeconds, b.anamMaxSessionSeconds),
    directorNotes: {
      mode: pickEnum(notes.mode, ANAM_STYLE_MODES, "custom"),
      presetStyle: pickEnum(notes.presetStyle, ANAM_PRESET_STYLES, "sad"),
      customStylePrompt: boundedText(
        notes.customStylePrompt,
        ANAM_DEFAULT_STYLE_PROMPT,
        ANAM_STYLE_PROMPT_MAX,
      ),
      customIdlingStylePrompt: boundedText(
        notes.customIdlingStylePrompt,
        ANAM_DEFAULT_IDLE_STYLE_PROMPT,
        ANAM_STYLE_PROMPT_MAX,
      ),
      expressivity: boundedNumber(notes.expressivity, b.anamExpressivity),
    },
    speakingCue: pickEnum(raw.speakingCue, ANAM_CUE_TAGS, "sad"),
    emotionCueMode: pickEnum(raw.emotionCueMode, ANAM_EMOTION_CUE_MODES, "evolving"),
    emotionCues: normalizeAnamEmotionCues(raw.emotionCues),
    voiceGenerationOptions: {
      engine: pickEnum(voice.engine, ANAM_VOICE_ENGINES, "default"),
      elevenLabs: {
        model: pickEnum(eleven.model, ANAM_ELEVENLABS_MODELS, "eleven_flash_v2_5"),
        stability: boundedNumber(eleven.stability, b.elevenLabsStability),
        similarityBoost: boundedNumber(eleven.similarityBoost, b.elevenLabsSimilarity),
        style: boundedNumber(eleven.style, b.elevenLabsStyle),
        useSpeakerBoost: eleven.useSpeakerBoost !== false,
        speed: boundedNumber(eleven.speed, b.anamElevenLabsSpeed),
      },
      cartesia: {
        volume: boundedNumber(cartesia.volume, b.anamCartesiaVolume),
        speed: boundedNumber(cartesia.speed, b.anamCartesiaSpeed),
        emotion: pickEnum(cartesia.emotion, ANAM_CARTESIA_EMOTIONS, "sad"),
      },
      fish: {
        volume: boundedNumber(fish.volume, b.anamFishVolume),
        speed: boundedNumber(fish.speed, b.anamFishSpeed),
      },
    },
    sessionOptions: {
      videoQuality: pickEnum(session.videoQuality, ANAM_VIDEO_QUALITIES, "high"),
      region: pickEnum(session.region, ANAM_REGIONS, "auto"),
      regionPolicy: pickEnum(session.regionPolicy, ANAM_REGION_POLICIES, "preferred"),
      keepRecording: session.keepRecording === true,
      keepTranscripts: session.keepTranscripts === true,
    },
  };
}

export function buildAnamDirectorNotes(
  settings: AnamAvatarSettings,
): Record<string, string | number> | null {
  if (!ANAM_DIRECTOR_NOTES_MODELS.includes(settings.avatarModel)) return null;
  const notes = settings.directorNotes;
  if (notes.mode === "preset") {
    return { presetStyle: notes.presetStyle, expressivity: notes.expressivity };
  }
  if (notes.mode === "custom") {
    const style = notes.customStylePrompt.trim();
    const idle = notes.customIdlingStylePrompt.trim();
    // presetStyle cannot be combined with a custom prompt; an empty prompt keeps the default style.
    if (!style) return { expressivity: notes.expressivity };
    const body: Record<string, string | number> = {
      customStylePrompt: style,
      expressivity: notes.expressivity,
    };
    if (idle) body.customIdlingStylePrompt = idle;
    return body;
  }
  return null;
}

/** Provider payload for the voice engine only, with only the fields its model reads. */
export function buildAnamVoiceGenerationOptions(
  settings: AnamAvatarSettings,
): Record<string, string | number | boolean> | null {
  const voice = settings.voiceGenerationOptions;
  if (voice.engine === "elevenLabs") {
    const eleven = voice.elevenLabs;
    if (ANAM_ELEVENLABS_STABILITY_ONLY.includes(eleven.model)) {
      return { model: eleven.model, stability: eleven.stability };
    }
    if (ANAM_ELEVENLABS_V4.includes(eleven.model)) {
      return {
        model: eleven.model,
        stability: eleven.stability,
        similarityBoost: eleven.similarityBoost,
      };
    }
    return {
      model: eleven.model,
      stability: eleven.stability,
      similarityBoost: eleven.similarityBoost,
      style: eleven.style,
      useSpeakerBoost: eleven.useSpeakerBoost,
      speed: eleven.speed,
    };
  }
  if (voice.engine === "cartesia") {
    return {
      volume: voice.cartesia.volume,
      speed: voice.cartesia.speed,
      emotion: voice.cartesia.emotion,
    };
  }
  if (voice.engine === "fish") return { volume: voice.fish.volume, speed: voice.fish.speed };
  return null;
}

/** Anam ids are UUIDs; anything else is refused before reaching the provider. */
export function safeAnamId(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)
    ? trimmed
    : "";
}

export function buildAnamSessionTokenRequest(config: unknown): BuildResult {
  const settings = normalizeAnamSettings(config);
  const avatarId = safeAnamId(settings.avatarId);
  const voiceId = safeAnamId(settings.voiceId);
  if (!avatarId || !voiceId) return { ok: false, error: "Anam avatarId and voiceId are required" };

  const personaConfig: Record<string, unknown> = {
    name: "Ava",
    avatarId,
    avatarModel: settings.avatarModel,
    voiceId,
    // Ava owns the microphone, STT and LLM: the persona only says the text it receives.
    llmId: ANAM_CLIENT_LLM_ID,
    skipGreeting: true,
    languageCode: settings.languageCode,
    maxSessionLengthSeconds: settings.maxSessionLengthSeconds,
  };
  const directorNotes = buildAnamDirectorNotes(settings);
  if (directorNotes) personaConfig.directorNotes = directorNotes;
  const voiceOptions = buildAnamVoiceGenerationOptions(settings);
  if (voiceOptions) personaConfig.voiceGenerationOptions = voiceOptions;

  const session = settings.sessionOptions;
  const sessionOptions: Record<string, unknown> = {
    videoQuality: session.videoQuality,
    dataRetention: { recording: session.keepRecording, transcripts: session.keepTranscripts },
  };
  if (session.region !== "auto") {
    sessionOptions.region = session.region;
    sessionOptions.regionPolicy = session.regionPolicy;
  }

  return {
    ok: true,
    body: {
      clientLabel: "ava",
      maxSessions: 1,
      expiresInSeconds: ANAM_TOKEN_TTL_SECONDS,
      personaConfig,
      sessionOptions,
    },
  };
}

/** Inline cue in front of a spoken line; Anam strips recognized tags from its transcripts. */
export function withAnamCue(text: string, cue: AnamCueTag): string {
  return cue === "none" ? text : `[${cue}] ${text}`;
}

const ANAM_CUE_PATTERN = new RegExp(
  `\\[(?:${ANAM_CUE_TAGS.filter((tag) => tag !== "none").join("|")})\\]\\s*`,
  "g",
);

export function stripAnamCueTags(text: string): string {
  return text.replace(ANAM_CUE_PATTERN, "");
}

const ANAM_CHARACTER_KEY_PATTERN = /^[a-z0-9_-]{1,40}$/;
const ANAM_MAX_CUE_TABLES = 12;

/** One complete table; unknown emotions or cues are dropped, missing ones take the default. */
export function normalizeAnamEmotionCueMap(value: unknown): AnamEmotionCueMap {
  const raw = asRecord(value);
  const map = { ...ANAM_DEFAULT_EMOTION_CUES };
  for (const emotion of ANAM_PERFORMANCE_EMOTIONS) {
    map[emotion] = pickEnum(raw[emotion], ANAM_CUE_TAGS, ANAM_DEFAULT_EMOTION_CUES[emotion]);
  }
  return map;
}

/** Max and Emma always get a table; another saved character key keeps its own. */
export function normalizeAnamEmotionCues(value: unknown): Record<string, AnamEmotionCueMap> {
  const raw = asRecord(value);
  const cues: Record<string, AnamEmotionCueMap> = {};
  for (const key of ANAM_EMOTION_CUE_CHARACTERS) cues[key] = normalizeAnamEmotionCueMap(raw[key]);
  for (const key of Object.keys(raw)) {
    if (Object.keys(cues).length >= ANAM_MAX_CUE_TABLES) break;
    if (!(key in cues) && ANAM_CHARACTER_KEY_PATTERN.test(key)) cues[key] = normalizeAnamEmotionCueMap(raw[key]);
  }
  return cues;
}

/**
 * Pure mapping of a per-turn acting intent to an Anam cue. `null` without a usable intent
 * (the caller falls back to the fixed cue); "none" means the base style carries the line.
 */
export function anamCueForPerformance(
  intent: { emotion?: string } | null | undefined,
  mapping: Partial<AnamEmotionCueMap> | null | undefined,
): AnamCueTag | null {
  const emotion = intent?.emotion;
  if (!emotion || !(ANAM_PERFORMANCE_EMOTIONS as readonly string[]).includes(emotion)) return null;
  const key = emotion as AnamPerformanceEmotion;
  return pickEnum(mapping?.[key], ANAM_CUE_TAGS, ANAM_DEFAULT_EMOTION_CUES[key]);
}

export interface AnamSpeakingCueChoice {
  cue: AnamCueTag;
  /** "intent": from the acting intent; "fixed": fixed mode; "fallback": evolving without intent. */
  origin: "intent" | "fixed" | "fallback";
}

/** Cue for the next line, from the settings, the active character and its acting intent. */
export function resolveAnamSpeakingCue(
  settings: Pick<AnamAvatarSettings, "speakingCue" | "emotionCueMode" | "emotionCues">,
  intent: { emotion?: string } | null | undefined,
  characterKey?: string | null,
): AnamSpeakingCueChoice {
  if (settings.emotionCueMode === "fixed") return { cue: settings.speakingCue, origin: "fixed" };
  const mapping = (characterKey && settings.emotionCues?.[characterKey]) || ANAM_DEFAULT_EMOTION_CUES;
  const cue = anamCueForPerformance(intent, mapping);
  return cue === null ? { cue: settings.speakingCue, origin: "fallback" } : { cue, origin: "intent" };
}

// ---------------------------------------------------------------------------
// LemonSlice — POST /api/liveai/sessions (audio → avatar, transport websocket-daily)
// Sources read on 2 November 2026: LemonSlice "WebSocket", "Control session", "CWM-1",
// "Lite model", "Cartoon model", "Flash model"; Daily REST "rooms" and "meeting-tokens".
// ---------------------------------------------------------------------------

/** "default" sends no `model`: LemonSlice uses its flagship model. */
export const LEMONSLICE_MODELS = ["default", "flash", "pro", "cwm-1", "cwm-1-lite", "cartoon"] as const;
/** Models that only support the 2x3 aspect ratio: `aspect_ratio` is not sent for them. */
export const LEMONSLICE_2X3_ONLY_MODELS: readonly string[] = ["cwm-1-lite", "cartoon"];
/** CWM-1 whole-body actions (`/control` event `action`), Ultra/Enterprise offers only. */
export const LEMONSLICE_ACTION_MODELS: readonly string[] = ["cwm-1"];
export const LEMONSLICE_SAMPLE_RATES = [16_000, 24_000] as const;
export const LEMONSLICE_ASPECT_RATIOS = ["2x3", "9x16", "1x1"] as const;
/** "default" sends no `edit_image`: the account default applies. */
export const LEMONSLICE_EDIT_IMAGE_MODES = ["default", "on", "off"] as const;
export const LEMONSLICE_EDIT_IMAGE_VARIANTS = ["standing", "bust", "sitting", "portrait"] as const;
export const LEMONSLICE_PROMPT_MAX = 1_000;
/** Only the nod is allowed from the game: it plays while the player speaks. */
export const LEMONSLICE_ALLOWED_ACTIONS = ["listen"] as const;
export const LEMONSLICE_CONTROL_EVENTS = [
  "update-agent-prompt",
  "update-idle-prompt",
  "action",
  "reset-idle-timeout",
] as const;

export const LEMONSLICE_DEFAULT_AGENT_PROMPT =
  "a grieving adult in deep distress talking slowly, heavy eyes, slight frown, never smiling";
export const LEMONSLICE_DEFAULT_IDLE_PROMPT =
  "a guarded person listening in silence, still neutral face, lips together, never smiling";

export const LEMONSLICE_BOUNDS = {
  idleTimeoutSeconds: { min: 30, max: 900, step: 10, fallback: 300 },
  /** 0 = not sent: LemonSlice applies its own delay. */
  responseDoneTimeoutSeconds: { min: 0, max: 10, step: 0.25, fallback: 0 },
  /** Lifetime of the private Daily room and of both meeting tokens. */
  roomMaxSeconds: { min: 300, max: 3_600, step: 60, fallback: 1_800 },
} satisfies Record<string, NumberBounds>;

export type LemonSliceModel = (typeof LEMONSLICE_MODELS)[number];
export type LemonSliceSampleRate = (typeof LEMONSLICE_SAMPLE_RATES)[number];
export type LemonSliceAspectRatio = (typeof LEMONSLICE_ASPECT_RATIOS)[number];
export type LemonSliceEditImageMode = (typeof LEMONSLICE_EDIT_IMAGE_MODES)[number];
export type LemonSliceEditImageVariant = (typeof LEMONSLICE_EDIT_IMAGE_VARIANTS)[number];
export type LemonSliceControlEvent = (typeof LEMONSLICE_CONTROL_EVENTS)[number];

export interface LemonSliceAvatarSettings {
  /** Avatar created on lemonslice.com; takes precedence over the image URL. */
  agentId: string;
  /** Public https image (368×560 recommended) when no agent id is set. */
  agentImageUrl: string;
  model: LemonSliceModel;
  /** Attitude while speaking: Ava's characters are in distress, never smiling. */
  agentPrompt: string;
  /** Attitude at rest, while the player speaks. */
  agentIdlePrompt: string;
  idleTimeoutSeconds: number;
  responseDoneTimeoutSeconds: number;
  audioSampleRate: LemonSliceSampleRate;
  aspectRatio: LemonSliceAspectRatio;
  editImage: LemonSliceEditImageMode;
  editImageVariant: LemonSliceEditImageVariant;
  /** CWM-1 only: nod (`listen`) when the player starts speaking. */
  listenAction: boolean;
  roomMaxSeconds: number;
}

export function normalizeLemonSliceSettings(value: unknown): LemonSliceAvatarSettings {
  const raw = asRecord(value);
  const b = LEMONSLICE_BOUNDS;
  return {
    agentId: typeof raw.agentId === "string" ? raw.agentId : "",
    agentImageUrl: typeof raw.agentImageUrl === "string" ? raw.agentImageUrl : "",
    model: pickEnum(raw.model, LEMONSLICE_MODELS, "default"),
    agentPrompt: boundedText(raw.agentPrompt, LEMONSLICE_DEFAULT_AGENT_PROMPT, LEMONSLICE_PROMPT_MAX),
    agentIdlePrompt: boundedText(
      raw.agentIdlePrompt,
      LEMONSLICE_DEFAULT_IDLE_PROMPT,
      LEMONSLICE_PROMPT_MAX,
    ),
    idleTimeoutSeconds: boundedInteger(raw.idleTimeoutSeconds, b.idleTimeoutSeconds),
    responseDoneTimeoutSeconds: boundedNumber(
      raw.responseDoneTimeoutSeconds,
      b.responseDoneTimeoutSeconds,
    ),
    audioSampleRate: LEMONSLICE_SAMPLE_RATES.includes(raw.audioSampleRate as LemonSliceSampleRate)
      ? (raw.audioSampleRate as LemonSliceSampleRate)
      : 16_000,
    aspectRatio: pickEnum(raw.aspectRatio, LEMONSLICE_ASPECT_RATIOS, "2x3"),
    editImage: pickEnum(raw.editImage, LEMONSLICE_EDIT_IMAGE_MODES, "default"),
    editImageVariant: pickEnum(raw.editImageVariant, LEMONSLICE_EDIT_IMAGE_VARIANTS, "bust"),
    listenAction: raw.listenAction === true,
    roomMaxSeconds: boundedInteger(raw.roomMaxSeconds, b.roomMaxSeconds),
  };
}

export function safeHttpsImageUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_000) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Daily room URL issued by the Edge Function (`https://<domain>.daily.co/<room>`). */
export function safeDailyRoomUrl(value: unknown): string {
  const url = safeHttpsImageUrl(value);
  if (!url) return "";
  return /^https:\/\/[a-z0-9-]+\.daily\.co\/[A-Za-z0-9_-]{1,128}$/.test(url) ? url : "";
}

export function lemonSliceAspectRatioSent(settings: LemonSliceAvatarSettings): boolean {
  return !LEMONSLICE_2X3_ONLY_MODELS.includes(settings.model);
}

/** `edit_image` reframes the uploaded image: read only with an image URL and the 2x3 ratio. */
export function lemonSliceEditImageRead(settings: LemonSliceAvatarSettings): boolean {
  const ratio = lemonSliceAspectRatioSent(settings) ? settings.aspectRatio : "2x3";
  return !safeProviderId(settings.agentId, true) && ratio === "2x3";
}

export function lemonSliceActionsAllowed(settings: LemonSliceAvatarSettings): boolean {
  return LEMONSLICE_ACTION_MODELS.includes(settings.model);
}

export interface LemonSliceDailyTarget {
  dailyUrl: string;
  /** Meeting token allowed to publish: handed to LemonSlice only, never to the browser. */
  dailyToken: string;
}

export function buildLemonSliceSessionRequest(
  config: unknown,
  target: LemonSliceDailyTarget,
): BuildResult {
  const settings = normalizeLemonSliceSettings(config);
  const agentId = safeProviderId(settings.agentId, true);
  const agentImageUrl = agentId ? "" : safeHttpsImageUrl(settings.agentImageUrl);
  if (!agentId && !agentImageUrl) {
    return { ok: false, error: "LemonSlice agentId or an https agentImageUrl is required" };
  }
  const dailyUrl = safeDailyRoomUrl(target.dailyUrl);
  if (!dailyUrl || !target.dailyToken) return { ok: false, error: "Daily room is missing" };

  const body: Record<string, unknown> = {
    // Ava sends the audio of its own TTS through the WebSocket; the video goes to the Daily room.
    transport_type: "websocket-daily",
    daily_properties: { daily_url: dailyUrl, daily_token: target.dailyToken },
    audio_sample_rate: settings.audioSampleRate,
    idle_timeout: settings.idleTimeoutSeconds,
  };
  if (agentId) body.agent_id = agentId;
  else body.agent_image_url = agentImageUrl;
  if (settings.model !== "default") body.model = settings.model;
  const agentPrompt = settings.agentPrompt.trim();
  const idlePrompt = settings.agentIdlePrompt.trim();
  if (agentPrompt) body.agent_prompt = agentPrompt;
  if (idlePrompt) body.agent_idle_prompt = idlePrompt;
  if (settings.responseDoneTimeoutSeconds > 0) {
    body.response_done_timeout = settings.responseDoneTimeoutSeconds;
  }
  if (lemonSliceAspectRatioSent(settings)) body.aspect_ratio = settings.aspectRatio;
  if (lemonSliceEditImageRead(settings) && settings.editImage !== "default") {
    body.edit_image = settings.editImage === "on";
    if (settings.editImage === "on") body.edit_image_variant = settings.editImageVariant;
  }
  return { ok: true, body };
}

/** In-session `/control` body; only whitelisted events and bounded values leave Ava. */
export function buildLemonSliceControlRequest(
  config: unknown,
  event: unknown,
  value?: unknown,
): BuildResult {
  const settings = normalizeLemonSliceSettings(config);
  if (!LEMONSLICE_CONTROL_EVENTS.includes(event as LemonSliceControlEvent)) {
    return { ok: false, error: "Invalid LemonSlice control event" };
  }
  if (event === "reset-idle-timeout") return { ok: true, body: { event } };
  if (event === "action") {
    if (!lemonSliceActionsAllowed(settings)) {
      return { ok: false, error: "LemonSlice actions need the CWM-1 model" };
    }
    const action = pickEnum(value, LEMONSLICE_ALLOWED_ACTIONS, "listen");
    if (action !== value) return { ok: false, error: "Invalid LemonSlice action" };
    return { ok: true, body: { event, action } };
  }
  const prompt = typeof value === "string" ? value.trim() : "";
  if (!prompt || prompt.length > LEMONSLICE_PROMPT_MAX) {
    return { ok: false, error: "Invalid LemonSlice prompt" };
  }
  return event === "update-agent-prompt"
    ? { ok: true, body: { event, agent_prompt: prompt } }
    : { ok: true, body: { event, idle_prompt: prompt } };
}

/** One private room per Ava session: the name is derived, never read from the client. */
export function lemonSliceRoomName(avaSessionId: string): string {
  return `ava-ls-${avaSessionId.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64)}`;
}

export function buildDailyRoomRequest(
  roomName: string,
  config: unknown,
  nowSeconds: number,
): Record<string, unknown> {
  const settings = normalizeLemonSliceSettings(config);
  return {
    name: roomName,
    privacy: "private",
    properties: {
      exp: Math.floor(nowSeconds) + settings.roomMaxSeconds,
      eject_at_room_exp: true,
      max_participants: 2,
      enable_chat: false,
      enable_prejoin_ui: false,
      start_audio_off: true,
      start_video_off: true,
    },
  };
}

/**
 * Two tokens: LemonSlice publishes audio and video; the browser only receives
 * (`canSend: false`), so the player's microphone can never reach the room.
 */
export function buildDailyMeetingTokenRequest(
  roomName: string,
  role: "avatar" | "viewer",
  config: unknown,
  nowSeconds: number,
): Record<string, unknown> {
  const settings = normalizeLemonSliceSettings(config);
  const properties: Record<string, unknown> = {
    room_name: roomName,
    exp: Math.floor(nowSeconds) + settings.roomMaxSeconds,
    eject_at_token_exp: true,
    is_owner: false,
  };
  if (role === "avatar") {
    properties.user_name = "LemonSlice";
    properties.permissions = { canSend: ["video", "audio"] };
  } else {
    properties.user_name = "Ava";
    properties.start_audio_off = true;
    properties.start_video_off = true;
    properties.permissions = { canSend: false };
  }
  return { properties };
}

/** WebSocket address issued by LemonSlice; it carries the capability and is never logged. */
export function safeLemonSliceWebSocketAddress(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_000) return "";
  try {
    const url = new URL(value);
    return url.protocol === "wss:" ? url.toString() : "";
  } catch {
    return "";
  }
}
