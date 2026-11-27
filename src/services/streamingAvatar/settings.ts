import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from "@/services/environmentContext";
import {
  boundedInteger,
  HEYGEN_ENCODINGS,
  HEYGEN_QUALITIES,
  normalizeAnamSettings,
  normalizeHeyGenVoiceSettings,
  normalizeLemonSliceSettings,
  normalizeNuanceSettings,
  normalizeTavusLanguages,
  NUANCE_DEFAULT_NATIVE_PROMPT,
  NUANCE_DEFAULT_VERBATIM_PROMPT,
  NUANCE_DRIVE_MODES,
  NUANCE_PERSONAS,
  pickEnum,
  safeLanguageCode,
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  STREAMING_AVATAR_BOUNDS,
  TAVUS_DEFAULT_LANGUAGES,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";
import { isTavusEchoEmotion, TAVUS_ECHO_EMOTION_TAGS } from "./protocolCommands";
import {
  TAVUS_AVATAR_CHARACTERS,
  TAVUS_EMOTIONS,
  TAVUS_VOICE_SOURCES,
  type CharacterProviderLink,
  type CharacterVideoLink,
  type OutputSettings,
  type ResolvedTavusCharacterSettings,
  type StreamingAvatarProviderId,
  type StreamingAvatarSettings,
  type TavusAvatarSettings,
  type TavusCharacterOverride,
  type TavusEchoEmotion,
  type TavusEmotion,
  type TavusVoiceSource,
} from "./types";

export const OUTPUT_SETTINGS_KEY = "ava_output_settings";
/** Nuance can spend about half a minute getting a persona ready. */
export const NUANCE_CONNECT_FLOOR_MS = 35_000;

/** Longest the opened provider may take to connect; the call never gives up on it earlier. */
export function avatarConnectBudgetMs(
  settings: Pick<StreamingAvatarSettings, "activeProvider" | "connectionTimeoutMs">,
): number {
  return settings.activeProvider === "nuance"
    ? Math.max(settings.connectionTimeoutMs, NUANCE_CONNECT_FLOOR_MS)
    : settings.connectionTimeoutMs;
}

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
    // Removes the smile best; can read a little sad (to check in the lot 4 recipe).
    echoEmotion: "dejected",
    // Ava's own voice by default: the PAL voice reads French badly (6 November 2026).
    voiceSource: "ava",
    streamedLlm: false,
    characters: { max: {}, emma: {} },
  },
  // Sad speaking style and closed idling attitude, like the Tavus emotions; IDs set in the admin.
  anam: normalizeAnamSettings(undefined),
  // Dejected speaking prompt and closed idle prompt; avatar id or image set in the admin.
  lemonslice: normalizeLemonSliceSettings(undefined),
  nuance: normalizeNuanceSettings(undefined),
  characterLinks: {},
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
 * no `anam`, `lemonslice` or `nuance` block) is read without loss; unknown or out of bounds values return to their default.
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
      echoEmotion: normalizeTavusEchoEmotion(tavus.echoEmotion, tavus.emotion),
      voiceSource: isTavusVoiceSource(tavus.voiceSource)
        ? tavus.voiceSource
        : tavusDefaults.voiceSource,
      streamedLlm: tavus.streamedLlm === true,
      characters: normalizeTavusCharacters(tavus.characters),
    },
    anam: normalizeAnamSettings(raw.anam),
    lemonslice: normalizeLemonSliceSettings(raw.lemonslice),
    nuance: normalizeNuanceSettings(raw.nuance),
    characterLinks: normalizeCharacterVideoLinks(raw.characterLinks),
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

/**
 * Settings saved before the Echo tag had its own field derive it from the speaking
 * `set_emotion` value (old behaviour); an unknown value falls back to the default.
 */
function normalizeTavusEchoEmotion(value: unknown, legacyEmotion: unknown): TavusEchoEmotion {
  if (isTavusEchoEmotion(value)) return value;
  if (value === undefined || value === null) {
    return TAVUS_ECHO_EMOTION_TAGS[normalizeTavusEmotion(legacyEmotion)];
  }
  return streamingAvatarDefaults.tavus.echoEmotion;
}

const CHARACTER_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const FACE_ID_MAX_LENGTH = 128;

/** Keeps only valid overrides; `max` and `emma` are always present (empty = global). */
function normalizeTavusCharacters(value: unknown): Record<string, TavusCharacterOverride> {
  const characters: Record<string, TavusCharacterOverride> = {};
  for (const key of TAVUS_AVATAR_CHARACTERS) characters[key] = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    if (!CHARACTER_KEY_PATTERN.test(key)) continue;
    const entry = asRecord(raw);
    const override: TavusCharacterOverride = {};
    const faceId = typeof entry.faceId === "string" ? entry.faceId.trim() : "";
    if (faceId && faceId.length <= FACE_ID_MAX_LENGTH) override.faceId = faceId;
    if (isTavusEchoEmotion(entry.echoEmotion)) override.echoEmotion = entry.echoEmotion;
    if (TAVUS_EMOTIONS.includes(entry.emotion as TavusEmotion)) {
      override.emotion = entry.emotion as TavusEmotion;
    }
    if (TAVUS_EMOTIONS.includes(entry.listeningEmotion as TavusEmotion)) {
      override.listeningEmotion = entry.listeningEmotion as TavusEmotion;
    }
    if (isTavusVoiceSource(entry.voiceSource)) override.voiceSource = entry.voiceSource;
    characters[key] = override;
  }
  return characters;
}

/**
 * Effective Face and emotions for a character: each override field wins when set,
 * otherwise the global value applies. No character (or an unknown one) means global.
 */
export function resolveTavusCharacterSettings(
  settings: TavusAvatarSettings,
  characterKey?: string | null,
): ResolvedTavusCharacterSettings {
  const override: TavusCharacterOverride =
    (characterKey && settings.characters?.[characterKey]) || {};
  return {
    faceId: override.faceId?.trim() || settings.replicaId,
    echoEmotion: override.echoEmotion ?? settings.echoEmotion,
    emotion: override.emotion ?? settings.emotion,
    listeningEmotion: override.listeningEmotion ?? settings.listeningEmotion,
    voiceSource: override.voiceSource ?? settings.voiceSource ?? "ava",
  };
}

const LINK_TEXT_MAX_LENGTH = 2_000;

function linkText<K extends string>(entry: Record<string, unknown>, key: K): Partial<Record<K, string>> {
  const value = typeof entry[key] === "string" ? (entry[key] as string).trim() : "";
  return value && value.length <= LINK_TEXT_MAX_LENGTH
    ? ({ [key]: value } as Partial<Record<K, string>>)
    : {};
}

/** An unknown provider drops the link; an unknown or empty field follows the global value. */
function normalizeCharacterVideoLink(value: unknown): CharacterVideoLink | null {
  const entry = asRecord(value);
  if (entry.provider === "none") return { provider: "none" };
  const provider = SELECTABLE_STREAMING_AVATAR_PROVIDERS.find((id) => id === entry.provider);
  if (!provider) return null;
  switch (provider) {
    case "tavus":
      return { provider };
    case "heygen":
    case "anam":
      return { provider, ...linkText(entry, "avatarId"), ...linkText(entry, "voiceId") };
    case "lemonslice":
      return { provider, ...linkText(entry, "agentId"), ...linkText(entry, "agentImageUrl") };
    case "nuance": {
      const personaId = NUANCE_PERSONAS.find((id) => id === entry.personaId);
      const drive = NUANCE_DRIVE_MODES.find((mode) => mode === entry.drive);
      const expressiveness = typeof entry.expressiveness === "number" && Number.isFinite(entry.expressiveness)
        ? normalizeNuanceSettings({ expressiveness: entry.expressiveness }).expressiveness
        : undefined;
      return {
        provider,
        ...(personaId ? { personaId } : {}),
        ...(expressiveness !== undefined ? { expressiveness } : {}),
        ...(drive ? { drive } : {}),
      };
    }
  }
}

function normalizeCharacterVideoLinks(value: unknown): Record<string, CharacterVideoLink> {
  const links: Record<string, CharacterVideoLink> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    if (!CHARACTER_KEY_PATTERN.test(key)) continue;
    const link = normalizeCharacterVideoLink(raw);
    if (link) links[key] = link;
  }
  return links;
}

/**
 * Settings of a call opened on a character link: the linked provider, with the character's
 * fields over that provider's global block. Secrets, timeouts, room and quality stay global.
 */
export function applyCharacterVideoLink(
  settings: StreamingAvatarSettings,
  link: CharacterProviderLink,
): StreamingAvatarSettings {
  const base: StreamingAvatarSettings = { ...settings, activeProvider: link.provider };
  switch (link.provider) {
    case "tavus":
      return base;
    case "heygen": {
      const { provider: _provider, ...fields } = link;
      return { ...base, heygen: { ...settings.heygen, ...fields } };
    }
    case "anam": {
      const { provider: _provider, ...fields } = link;
      return { ...base, anam: { ...settings.anam, ...fields } };
    }
    case "lemonslice": {
      // The agent id wins over the image in the request: a character image clears the global agent.
      const face = link.agentId
        ? { agentId: link.agentId, ...(link.agentImageUrl ? { agentImageUrl: link.agentImageUrl } : {}) }
        : link.agentImageUrl
        ? { agentId: "", agentImageUrl: link.agentImageUrl }
        : {};
      return { ...base, lemonslice: { ...settings.lemonslice, ...face } };
    }
    case "nuance": {
      const { provider: _provider, ...fields } = link;
      const drive = link.drive ?? settings.nuance.drive;
      // The global instruction was written for the global mode.
      const systemPrompt = drive === settings.nuance.drive
        ? settings.nuance.systemPrompt
        : drive === "native" ? NUANCE_DEFAULT_NATIVE_PROMPT : NUANCE_DEFAULT_VERBATIM_PROMPT;
      return { ...base, nuance: { ...settings.nuance, ...fields, systemPrompt } };
    }
  }
}

/** What Réglages personnages edits for one character: its link and, for Tavus, its fields. */
export interface CharacterVideoChoice {
  link: CharacterVideoLink | null;
  tavus: TavusCharacterOverride;
}

export function characterVideoChoice(
  settings: StreamingAvatarSettings,
  characterKey: string,
): CharacterVideoChoice {
  return {
    link: settings.characterLinks[characterKey] ?? null,
    tavus: settings.tavus.characters[characterKey] ?? {},
  };
}

export function withCharacterVideoChoice(
  settings: StreamingAvatarSettings,
  characterKey: string,
  choice: CharacterVideoChoice,
): StreamingAvatarSettings {
  const characterLinks = { ...settings.characterLinks };
  if (choice.link) characterLinks[characterKey] = choice.link;
  else delete characterLinks[characterKey];
  return {
    ...settings,
    characterLinks,
    tavus: { ...settings.tavus, characters: { ...settings.tavus.characters, [characterKey]: choice.tavus } },
  };
}

/** Rewrites one character only, over the stored settings read just before. */
export async function saveCharacterVideoChoiceToDB(
  characterKey: string,
  choice: CharacterVideoChoice,
): Promise<void> {
  const stored = await loadStreamingAvatarSettingsFromDB();
  await saveStreamingAvatarSettingsToDB(withCharacterVideoChoice(stored, characterKey, choice));
}

export function isTavusVoiceSource(value: unknown): value is TavusVoiceSource {
  return TAVUS_VOICE_SOURCES.includes(value as TavusVoiceSource);
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}
