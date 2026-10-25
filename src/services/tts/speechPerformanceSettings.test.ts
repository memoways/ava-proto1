import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ current: null as unknown, fail: false, mismatch: false, conflict: false, environments: [] as string[], writes: 0, duringWrite: null as null | (() => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
 let operation = 'read', value: unknown;
 const query = {
  select: () => query,
  eq: (key: string, val: string) => { if (key === 'environment_id') db.environments.push(val); return query; },
  maybeSingle: async () => ({ data: db.current ? { value: db.mismatch && db.writes ? { ...(db.current as object), version: 'unexpected' } : structuredClone(db.current) } : null, error: db.fail ? new Error('DB read unavailable') : null }),
  update: (row: { value: unknown }) => { operation = 'write'; value = row.value; return query; },
  insert: (row: { value: unknown }) => { operation = 'write'; value = row.value; return query; },
  then: (resolve: (result: unknown) => void) => {
   if (operation === 'write') { db.writes++; db.duringWrite?.(); if (!db.conflict && !db.fail) db.current = structuredClone(value); }
   resolve({ data: db.conflict ? [] : [{ key: 'ava_speech_performance' }], error: db.fail ? new Error('DB write unavailable') : null });
  },
 };
 return query;
} } }));
import { getActiveEnvironment, readEnvironmentStorage, setActiveEnvironment } from '../environmentContext';
import { EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping, readSavedSpeechPerformance, saveSpeechPerformanceSettings, SPEECH_PERFORMANCE_KEY } from './speechPerformanceSettings';
const original = { ...EMPTY_SPEECH_PERFORMANCE, enabled: true, version: '2026-10-25T11:39:32.000Z',
 byCharacter: { max: { Retenu: proposeSpeechMapping('Retenu', 'silence') }, emma: { Action: proposeSpeechMapping('Action', 'rapide') } } };
describe('A3 — explicit sandbox save and strict same-environment readback', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); db.current = structuredClone(original); db.fail = db.mismatch = db.conflict = false; db.environments = []; db.writes = 0; db.duringWrite = null; });
 it('reads without saving, then saves only explicitly and confirms the pinned environment', async () => {
  const saved = await readSavedSpeechPerformance('sandbox-ulrich'); expect(db.writes).toBe(0);
  const draft = structuredClone(saved); draft.byCharacter.max.Retenu.pauses = 'short';
  db.current = { ...original, futureSetting: 'preserved', byCharacter: { ...original.byCharacter, emma: { ...original.byCharacter.emma, Extra: proposeSpeechMapping('Extra', '') } } };
  const result = await saveSpeechPerformanceSettings(draft, saved, 'sandbox-ulrich');
  expect(result).toMatchObject({ futureSetting: 'preserved', enabled: true, gradiumTagsEnabled: false });
  expect(result.byCharacter.max.Retenu.pauses).toBe('short'); expect(result.byCharacter.emma.Extra).toBeDefined();
  expect(result.version).not.toBe(original.version); expect(result.gradiumPausesEnabled).toBeUndefined();
  expect(db.writes).toBe(1); expect(new Set(db.environments)).toEqual(new Set(['sandbox-ulrich']));
  expect(JSON.parse(readEnvironmentStorage(SPEECH_PERFORMANCE_KEY)!)).toEqual(result);
 });
 it('refuses stale versions and compare-and-swap conflicts', async () => {
  db.current = { ...original, version: 'newer' };
  await expect(saveSpeechPerformanceSettings(original, original)).rejects.toThrow('modifié'); expect(db.writes).toBe(0);
  db.current = original; db.conflict = true;
  await expect(saveSpeechPerformanceSettings(original, original)).rejects.toThrow('refusée');
  expect(readEnvironmentStorage(SPEECH_PERFORMANCE_KEY)).toBeNull();
 });
 it('surfaces read/write/readback failures without optimistic local live activation', async () => {
  db.fail = true; await expect(readSavedSpeechPerformance('sandbox-ulrich')).rejects.toThrow('unavailable');
  await expect(saveSpeechPerformanceSettings(original, original)).rejects.toThrow('unavailable'); expect(db.writes).toBe(0);
  db.fail = false; db.mismatch = true;
  await expect(saveSpeechPerformanceSettings(original, original)).rejects.toThrow('Relecture');
  expect(readEnvironmentStorage(SPEECH_PERFORMANCE_KEY)).toBeNull();
 });
 it('closes production and rejects a changed environment without caching the other environment', async () => {
  setActiveEnvironment('prod'); await expect(saveSpeechPerformanceSettings(original)).rejects.toThrow('sandbox'); expect(db.writes).toBe(0);
  setActiveEnvironment('sandbox-ulrich'); db.duringWrite = () => setActiveEnvironment('sandbox-romed');
  await expect(saveSpeechPerformanceSettings(original, original, 'sandbox-ulrich')).rejects.toThrow('sandbox');
  expect(getActiveEnvironment()).toBe('sandbox-romed'); expect(readEnvironmentStorage(SPEECH_PERFORMANCE_KEY)).toBeNull();
  expect(new Set(db.environments)).toEqual(new Set(['sandbox-ulrich']));
 });
});
