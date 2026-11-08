/**
 * Effective settings recorded with each session (per-device settings plan, lot 1).
 *
 * Pinned when the call starts and written under `sessions.device_info.effective_settings`
 * (existing JSON column) once the character profiles are known, without delaying the call: what really ran for this call
 * (Max and game master models, speech engine and model, voice and its source,
 * output, avatar) and which settings version it used. Read by admin Sessions.
 */
import type { EffectiveVoice, EffectiveVoiceSource, VoiceCharacter } from "./effectiveVoice";
import type { ExperienceSettingsState } from "./experienceSettings";
import type { OutputModeReason } from "./callOutputMode";
import type { OutputMode } from "./streamingAvatar/types";

export const SESSION_EFFECTIVE_SETTINGS_VERSION = 1;

export interface SessionCharacterVoiceRecord {
  summary: string;
  speaker: "ava" | "avatar";
  engine: string;
  model: string | null;
  voice_id: string | null;
  voice_source: EffectiveVoiceSource;
  output: OutputMode;
  avatar_provider: string | null;
}

export interface SessionEffectiveSettings {
  version: number;
  recorded_at: string;
  settings_source: ExperienceSettingsState["source"];
  settings_fallback_reason: string | null;
  settings_environment: string;
  /** Most recent `admin_settings.updated_at` among the rows used. */
  settings_updated_at: string | null;
  settings_inherited_from_prod: string[];
  max_model: string;
  gm_model: string;
  starting_character: VoiceCharacter;
  output_mode: OutputMode;
  output_mode_reason: OutputModeReason;
  avatar_provider: string | null;
  /** Starting character's speech: engine, model, voice. */
  tts_provider: string;
  tts_model: string | null;
  voice_id: string | null;
  voice_source: EffectiveVoiceSource;
  voice_summary: string;
  characters: Record<VoiceCharacter, SessionCharacterVoiceRecord>;
}

function characterRecord(voice: EffectiveVoice): SessionCharacterVoiceRecord {
  return {
    summary: voice.summary,
    speaker: voice.speaker,
    engine: voice.engine,
    model: voice.model,
    voice_id: voice.voiceId,
    voice_source: voice.voiceSource,
    output: voice.output,
    avatar_provider: voice.avatarProvider,
  };
}

export function buildSessionEffectiveSettings(input: {
  settings: ExperienceSettingsState;
  llm: { LLM_MODEL: string; LLM_MODEL_GM: string };
  startingCharacter: VoiceCharacter;
  outputMode: OutputMode;
  outputModeReason: OutputModeReason;
  voices: Record<VoiceCharacter, EffectiveVoice>;
  now?: Date;
}): SessionEffectiveSettings {
  const starting = input.voices[input.startingCharacter];
  return {
    version: SESSION_EFFECTIVE_SETTINGS_VERSION,
    recorded_at: (input.now ?? new Date()).toISOString(),
    settings_source: input.settings.source,
    settings_fallback_reason: input.settings.reason ?? null,
    settings_environment: input.settings.environmentId,
    settings_updated_at: input.settings.settingsUpdatedAt,
    settings_inherited_from_prod: input.settings.inheritedFromProd,
    max_model: input.llm.LLM_MODEL,
    gm_model: input.llm.LLM_MODEL_GM,
    starting_character: input.startingCharacter,
    output_mode: input.outputMode,
    output_mode_reason: input.outputModeReason,
    avatar_provider: input.outputMode === "streaming_avatar" ? starting.avatarProvider : null,
    tts_provider: starting.engine,
    tts_model: starting.model,
    voice_id: starting.voiceId,
    voice_source: starting.voiceSource,
    voice_summary: starting.summary,
    characters: { max: characterRecord(input.voices.max), emma: characterRecord(input.voices.emma) },
  };
}

/** Reads the record back from a session row (`device_info`), tolerating older sessions. */
export function readSessionEffectiveSettings(deviceInfo: unknown): SessionEffectiveSettings | null {
  if (!deviceInfo || typeof deviceInfo !== "object") return null;
  const value = (deviceInfo as Record<string, unknown>).effective_settings;
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<SessionEffectiveSettings>;
  return typeof record.max_model === "string" && typeof record.tts_provider === "string"
    ? record as SessionEffectiveSettings
    : null;
}
