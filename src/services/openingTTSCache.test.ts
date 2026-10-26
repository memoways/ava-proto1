import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOpeningTTSBlob, openingTTSCacheKey, resetOpeningTTSCache } from './openingTTSCache';

describe('completed opening audio cache', () => {
  beforeEach(resetOpeningTTSCache);
  it('reuses only exact generation contexts', async () => {
    const generate = vi.fn(async () => ({ blob: new Blob(['audio']) }));
    const base = { environmentId: 'sandbox-ulrich', text: 'Allô.', providerId: 'gradium', characterKey: 'max',
      voiceId: 'v1', settings: { modelId: 'gradium-tts', temp: 0.7, paddingBonus: 0 }, performance: { speechState: 'net' } };
    const key = openingTTSCacheKey(base);
    expect((await getOpeningTTSBlob(key, generate)).cached).toBe(false);
    expect((await getOpeningTTSBlob(key, generate)).cached).toBe(true);
    for (const patch of [{ environmentId: 'prod' }, { text: 'Bonjour.' }, { providerId: 'elevenlabs' },
      { characterKey: 'emma' }, { voiceId: 'v2' }, { settings: { modelId: 'other' } },
      { settings: { ...base.settings, paddingBonus: 1 } }, { performance: { speechState: 'bloqué' } },
      { previousText: 'Avant.' }, { nextText: 'Après.' }]) {
      expect((await getOpeningTTSBlob(openingTTSCacheKey({ ...base, ...patch }), generate)).cached).toBe(false);
    }
    expect(generate).toHaveBeenCalledTimes(11);
  });
  it('does not retain failures, cancelled results or results arriving after reset', async () => {
    const failure = vi.fn().mockRejectedValue(new Error('network'));
    await expect(getOpeningTTSBlob('k', failure)).rejects.toThrow('network');
    const controller = new AbortController();
    let resolve!: (audio: { blob: Blob }) => void;
    const pending = getOpeningTTSBlob('k', () => new Promise(r => { resolve = r; }), controller.signal);
    controller.abort(); resolve({ blob: new Blob(['stale']) });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const fresh = vi.fn(async () => ({ blob: new Blob(['new']) }));
    expect((await getOpeningTTSBlob('k', fresh)).cached).toBe(false);
    const late = getOpeningTTSBlob('late', () => new Promise(r => { resolve = r; }));
    resetOpeningTTSCache(); resolve({ blob: new Blob(['old']) }); await late;
    expect((await getOpeningTTSBlob('late', fresh)).cached).toBe(false);
    await expect(getOpeningTTSBlob('late', fresh, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fresh).toHaveBeenCalledTimes(2);
  });
  it('bounds entries and total bytes with LRU eviction', async () => {
    const generate = vi.fn(async () => ({ blob: new Blob(['audio']) }));
    for (let i = 0; i < 17; i++) await getOpeningTTSBlob(String(i), generate);
    expect((await getOpeningTTSBlob('1', generate)).cached).toBe(true);
    expect((await getOpeningTTSBlob('0', generate)).cached).toBe(false);
    resetOpeningTTSCache();
    const large = async () => ({ blob: new Blob([new Uint8Array(5 * 1024 * 1024)]) });
    await getOpeningTTSBlob('a', large); await getOpeningTTSBlob('b', large);
    expect((await getOpeningTTSBlob('a', generate)).cached).toBe(false);
  });
});
