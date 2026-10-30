import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from '../environmentContext';
import type { TTSProviderId } from './types';

/**
 * One place for every character's voice ID at every TTS provider (Technique →
 * Configuration TTS). Character settings and the speech workshop read it; the
 * game keeps reading `character_runtime_profiles.tts_voice_id`, which is synced
 * from this catalogue on explicit save.
 */
export const CHARACTER_VOICES_KEY = 'ava_tts_character_voices';
export const VOICE_CHARACTERS = [
 { key: 'max', label: 'Max' }, { key: 'emma', label: 'Emma' }, { key: 'ava', label: 'Ava' }, { key: 'leo', label: 'Léo' },
] as const;
export const VOICE_PROVIDERS: TTSProviderId[] = ['gradium', 'fish', 'elevenlabs', 'inworld', 'cartesia'];
export type CharacterVoiceCatalogue = Record<string, Partial<Record<TTSProviderId, string>>>;

function clean(value: unknown): CharacterVoiceCatalogue {
 const result: CharacterVoiceCatalogue = {};
 if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
 for (const { key } of VOICE_CHARACTERS) {
  const row = (value as Record<string, unknown>)[key];
  if (!row || typeof row !== 'object') continue;
  for (const provider of VOICE_PROVIDERS) {
   const id = (row as Record<string, unknown>)[provider];
   if (typeof id === 'string' && id.trim()) (result[key] ??= {})[provider] = id.trim();
  }
 }
 return result;
}
/** Voice IDs are opaque provider identifiers: no spaces, bounded length. */
export function voiceIdError(id: string): string | null {
 const value = id.trim();
 if (!value) return null;
 if (value.length > 200) return 'Identifiant trop long (200 caractères au plus).';
 if (/\s/.test(value)) return 'Un identifiant de voix ne contient pas d’espace.';
 return null;
}
export function getCharacterVoices(): CharacterVoiceCatalogue {
 try { const raw = readEnvironmentStorage(CHARACTER_VOICES_KEY); return raw ? clean(JSON.parse(raw)) : {}; } catch { return {}; }
}
export async function loadCharacterVoicesFromDB(): Promise<CharacterVoiceCatalogue> {
 return clean(await loadEnvironmentSetting<CharacterVoiceCatalogue>(CHARACTER_VOICES_KEY, {}));
}
/** Saves, then rereads the stored value; a different readback is reported, never assumed saved. */
export async function saveCharacterVoices(value: CharacterVoiceCatalogue): Promise<CharacterVoiceCatalogue> {
 const next = clean(value);
 for (const row of Object.values(next)) for (const id of Object.values(row)) { const error = voiceIdError(id ?? ''); if (error) throw new Error(error); }
 await saveEnvironmentSetting(CHARACTER_VOICES_KEY, next);
 const confirmed = await loadCharacterVoicesFromDB();
 if (JSON.stringify(confirmed) !== JSON.stringify(next)) throw new Error('Relecture différente : voix non confirmées. Rechargez la page.');
 return confirmed;
}
export function characterVoice(catalogue: CharacterVoiceCatalogue, character: string, provider: TTSProviderId | null | undefined): string | null {
 return provider ? catalogue[character]?.[provider]?.trim() || null : null;
}
interface ProfileVoice { id: string; character_key: string; tts_provider: string | null; tts_voice_id: string | null }
/** Keeps voices already used by the game when the catalogue has no entry yet, so nothing is lost. */
export function seedFromProfiles(catalogue: CharacterVoiceCatalogue, profiles: ProfileVoice[]): CharacterVoiceCatalogue {
 const next = structuredClone(catalogue);
 for (const profile of profiles) {
  const provider = profile.tts_provider as TTSProviderId | null;
  if (!provider || !VOICE_PROVIDERS.includes(provider) || !profile.tts_voice_id?.trim() || next[profile.character_key]?.[provider]) continue;
  if (!VOICE_CHARACTERS.some(c => c.key === profile.character_key)) continue;
  (next[profile.character_key] ??= {})[provider] = profile.tts_voice_id.trim();
 }
 return next;
}
/** Profiles whose provider has a catalogue voice different from the one the game uses. */
export function profilesToSync(catalogue: CharacterVoiceCatalogue, profiles: ProfileVoice[]): Array<{ id: string; character: string; voice: string }> {
 return profiles.flatMap(profile => {
  const voice = characterVoice(catalogue, profile.character_key, profile.tts_provider as TTSProviderId | null);
  return voice && voice !== profile.tts_voice_id ? [{ id: profile.id, character: profile.character_key, voice }] : [];
 });
}
