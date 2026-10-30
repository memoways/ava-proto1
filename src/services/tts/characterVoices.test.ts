import { beforeEach, describe, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => ({ value: undefined as unknown, saved: [] as unknown[], tamper: false }));
vi.mock('../environmentContext', async original => ({
 ...await original<typeof import('../environmentContext')>(),
 loadEnvironmentSetting: vi.fn(async (_key: string, defaults: unknown) => store.tamper ? { max: { fish: 'other' } } : store.value ?? defaults),
 saveEnvironmentSetting: vi.fn(async (key: string, value: unknown) => { store.saved.push([key, value]); store.value = structuredClone(value); }),
}));
import { CHARACTER_VOICES_KEY, characterVoice, profilesToSync, saveCharacterVoices, seedFromProfiles, voiceIdError } from './characterVoices';

const profiles = [
 { id: 'p-max', character_key: 'max', tts_provider: 'gradium', tts_voice_id: 'max-old' },
 { id: 'p-emma', character_key: 'emma', tts_provider: 'gradium', tts_voice_id: 'emma-gradium' },
 { id: 'p-leo', character_key: 'leo', tts_provider: null, tts_voice_id: null },
];
describe('AP4-bis — one voice catalogue for four characters and five providers', () => {
 beforeEach(() => { Object.assign(store, { value: undefined, saved: [], tamper: false }); });
 it('saves trimmed IDs outside runtime fields, rereads them and refuses a different readback', async () => {
  const saved = await saveCharacterVoices({ max: { gradium: ' max-new ', fish: '' }, ava: { cartesia: 'ava-c' }, unknown: { fish: 'x' } });
  expect(saved).toEqual({ max: { gradium: 'max-new' }, ava: { cartesia: 'ava-c' } });
  expect(store.saved).toEqual([[CHARACTER_VOICES_KEY, saved]]);
  store.tamper = true;
  await expect(saveCharacterVoices({ max: { fish: 'max-fish' } })).rejects.toThrow('Relecture différente');
 });
 it('rejects IDs with spaces or too long before writing', async () => {
  expect(voiceIdError('abc def')).toMatch(/espace/); expect(voiceIdError('x'.repeat(201))).toMatch(/trop long/); expect(voiceIdError('')).toBeNull();
  await expect(saveCharacterVoices({ max: { fish: 'a b' } })).rejects.toThrow(/espace/); expect(store.saved).toHaveLength(0);
 });
 it('keeps voices already used by the game, and lists only profiles whose voice must follow the catalogue', () => {
  const seeded = seedFromProfiles({ max: { gradium: 'max-new' } }, profiles);
  expect(seeded).toEqual({ max: { gradium: 'max-new' }, emma: { gradium: 'emma-gradium' } });
  expect(profilesToSync(seeded, profiles)).toEqual([{ id: 'p-max', character: 'max', voice: 'max-new' }]);
  expect(characterVoice(seeded, 'emma', 'fish')).toBeNull(); expect(characterVoice(seeded, 'emma', null)).toBeNull();
 });
});
