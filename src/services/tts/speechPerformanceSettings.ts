import { supabase } from '@/integrations/supabase/client';
import { getActiveEnvironment, loadEnvironmentSetting, readEnvironmentStorage, writeEnvironmentStorage, type EnvironmentId } from '../environmentContext';
import type { CanonicalEmotion, PerformanceDelivery } from './performanceIntent';
export interface SpeechVoiceMapping { emotion: CanonicalEmotion; delivery: PerformanceDelivery; speed: number; pauses: 'short' | 'normal' | 'long'; instruction: string }
export interface SpeechPerformanceSettings { enabled: boolean; version: string; gradiumTagsEnabled: boolean; /** A2, opt-in per environment after human acceptance. Missing means false. */ gradiumPausesEnabled?: boolean; byCharacter: Record<string, Record<string, SpeechVoiceMapping>> }
export const SPEECH_PERFORMANCE_KEY = 'ava_speech_performance';
export const EMPTY_SPEECH_PERFORMANCE: SpeechPerformanceSettings = { enabled: false, version: '', gradiumTagsEnabled: false, byCharacter: {} };
// Production guard lifted on 25 Oct 2026 (Ulrich): every environment reads its own saved mapping.
export function getSpeechPerformanceSettings(): SpeechPerformanceSettings {
  try { const raw = readEnvironmentStorage(SPEECH_PERFORMANCE_KEY); return raw ? { ...EMPTY_SPEECH_PERFORMANCE, ...JSON.parse(raw), gradiumTagsEnabled: false } : EMPTY_SPEECH_PERFORMANCE; } catch { return EMPTY_SPEECH_PERFORMANCE; }
}
export async function loadSpeechPerformanceSettings() { return loadEnvironmentSetting(SPEECH_PERFORMANCE_KEY, EMPTY_SPEECH_PERFORMANCE); }
/** Strict DB read: no prod fallback or local-cache success on an unavailable read. */
export async function readSavedSpeechPerformance(environment: EnvironmentId): Promise<SpeechPerformanceSettings> {
  if (environment === 'prod') throw new Error('Lot B réservé à la sandbox');
  const { data, error } = await supabase.from('admin_settings' as never).select('value')
    .eq('key', SPEECH_PERFORMANCE_KEY).eq('environment_id', environment).maybeSingle();
  if (error) throw error;
  return structuredClone((data as { value: SpeechPerformanceSettings } | null)?.value ?? EMPTY_SPEECH_PERFORMANCE);
}
export async function saveSpeechPerformanceSettings(value: SpeechPerformanceSettings,
  baseline?: SpeechPerformanceSettings, environment = getActiveEnvironment()) {
  const assertEnvironment = () => {
    if (environment === 'prod' || getActiveEnvironment() !== environment) throw new Error('Sauvegarde réservée à la même sandbox');
  };
  assertEnvironment();
  const current = await readSavedSpeechPerformance(environment);
  assertEnvironment();
  if (baseline && current.version !== baseline.version) throw new Error('Mapping modifié depuis le chargement : recharger avant sauvegarde');
  const next = { ...current, ...value, version: new Date().toISOString(), gradiumTagsEnabled: false };
  // Preserve unedited/unknown fields from the latest read, including state extensions.
  if (baseline) {
    for (const key of Object.keys(value) as (keyof SpeechPerformanceSettings)[]) {
      if (JSON.stringify(value[key]) === JSON.stringify(baseline[key]) && key !== 'version' && key !== 'gradiumTagsEnabled') {
        Object.assign(next, { [key]: current[key] });
      }
    }
    next.byCharacter = structuredClone(current.byCharacter);
    for (const [character, states] of Object.entries(value.byCharacter)) {
      for (const [state, mapping] of Object.entries(states)) {
        const before = baseline.byCharacter[character]?.[state];
        if (JSON.stringify(before) === JSON.stringify(mapping)) continue;
        const merged = { ...next.byCharacter[character]?.[state], ...mapping };
        if (before) for (const field of Object.keys(mapping) as (keyof SpeechVoiceMapping)[]) {
          if (mapping[field] === before[field]) Object.assign(merged, { [field]: current.byCharacter[character]?.[state]?.[field] ?? mapping[field] });
        }
        next.byCharacter[character] = { ...next.byCharacter[character], [state]: merged };
      }
    }
  }
  const query = supabase.from('admin_settings' as never);
  // Compare-and-swap the version for an existing mapping; do not overwrite a concurrent editor.
  if (current.version) {
    const { data, error } = await query.update({ value: next, updated_at: new Date().toISOString() } as never)
      .eq('key', SPEECH_PERFORMANCE_KEY).eq('environment_id', environment).eq('value->>version', current.version).select('key');
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) throw new Error('Mapping modifié : sauvegarde refusée');
  } else {
    const { error } = await query.insert({ key: SPEECH_PERFORMANCE_KEY, value: next, environment_id: environment } as never);
    if (error) throw error;
  }
  const saved = await readSavedSpeechPerformance(environment);
  assertEnvironment();
  const stable = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  if (saved.version !== next.version || stable(saved.byCharacter) !== stable(next.byCharacter)
    || saved.enabled !== next.enabled || saved.gradiumPausesEnabled !== next.gradiumPausesEnabled) throw new Error('Relecture du mapping différente : sauvegarde non confirmée');
  writeEnvironmentStorage(SPEECH_PERFORMANCE_KEY, JSON.stringify(saved), environment);
  return saved;
}

/** Only the audition caller supplies this temporary, environment-bound snapshot. */
export interface SpeechAuditionSnapshot {
  kind: 'speech_audition'; environment: EnvironmentId; character: string; validStates: string[];
  settings: SpeechPerformanceSettings;
  gradium: import('./providerSettings').GradiumSettings;
}
export function validateSpeechAudition(snapshot: SpeechAuditionSnapshot, character?: string): SpeechAuditionSnapshot {
  if (getActiveEnvironment() === 'prod' || snapshot.environment !== getActiveEnvironment()
    || snapshot.kind !== 'speech_audition' || snapshot.character !== character) throw new Error('Contexte audition hors sandbox/personnage');
  return snapshot;
}
/** Suggestions from each synchronized description; no shared character prompt. */
export function proposeSpeechMapping(name: string, description: string): SpeechVoiceMapping {
  const text = `${name} ${description}`;
  const rushed = /digue|rapide|accél|débord|précipit/i.test(text);
  const blocked = /bloqu|silence|cass|hésit|reten/i.test(text);
  return { emotion: rushed ? 'urgent' : blocked ? 'fragile' : 'neutral', delivery: rushed ? 'rushed' : 'measured', speed: rushed ? 1.12 : blocked ? 0.9 : 1, pauses: rushed ? 'short' : blocked ? 'long' : 'normal', instruction: rushed ? 'Fast, overflowing speech; few pauses, clear diction' : blocked ? 'Hesitant speech, longer pauses; clear diction' : 'Conversational speech, clear diction' };
}
