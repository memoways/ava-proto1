import { getActiveEnvironment, loadEnvironmentSetting, saveEnvironmentSetting, readEnvironmentStorage } from '../environmentContext';
import type { CanonicalEmotion, PerformanceDelivery } from './performanceIntent';
export interface SpeechVoiceMapping { emotion: CanonicalEmotion; delivery: PerformanceDelivery; speed: number; pauses: 'short' | 'normal' | 'long'; instruction: string }
export interface SpeechPerformanceSettings { enabled: boolean; version: string; gradiumTagsEnabled: boolean; /** A2, opt-in per environment after human acceptance. Missing means false. */ gradiumPausesEnabled?: boolean; byCharacter: Record<string, Record<string, SpeechVoiceMapping>> }
export const SPEECH_PERFORMANCE_KEY = 'ava_speech_performance';
export const EMPTY_SPEECH_PERFORMANCE: SpeechPerformanceSettings = { enabled: false, version: '', gradiumTagsEnabled: false, byCharacter: {} };
export function getSpeechPerformanceSettings(): SpeechPerformanceSettings {
  if (getActiveEnvironment() === 'prod') return EMPTY_SPEECH_PERFORMANCE;
  try { const raw = readEnvironmentStorage(SPEECH_PERFORMANCE_KEY); return raw ? { ...EMPTY_SPEECH_PERFORMANCE, ...JSON.parse(raw) } : EMPTY_SPEECH_PERFORMANCE; } catch { return EMPTY_SPEECH_PERFORMANCE; }
}
export async function loadSpeechPerformanceSettings() { if (getActiveEnvironment() === 'prod') return EMPTY_SPEECH_PERFORMANCE; return loadEnvironmentSetting(SPEECH_PERFORMANCE_KEY, EMPTY_SPEECH_PERFORMANCE); }
export async function saveSpeechPerformanceSettings(value: SpeechPerformanceSettings) {
  if (getActiveEnvironment() === 'prod') throw new Error('Lot B réservé à la sandbox');
  const next = { ...value, version: new Date().toISOString(), gradiumTagsEnabled: false };
  await saveEnvironmentSetting(SPEECH_PERFORMANCE_KEY, next); return next;
}
/** Suggestions from each synchronized description; no shared character prompt. */
export function proposeSpeechMapping(name: string, description: string): SpeechVoiceMapping {
  const text = `${name} ${description}`;
  const rushed = /digue|rapide|accél|débord|précipit/i.test(text);
  const blocked = /bloqu|silence|cass|hésit|reten/i.test(text);
  return { emotion: rushed ? 'urgent' : blocked ? 'fragile' : 'neutral', delivery: rushed ? 'rushed' : 'measured', speed: rushed ? 1.12 : blocked ? 0.9 : 1, pauses: rushed ? 'short' : blocked ? 'long' : 'normal', instruction: rushed ? 'Fast, overflowing speech; few pauses, clear diction' : blocked ? 'Hesitant speech, longer pauses; clear diction' : 'Conversational speech, clear diction' };
}
