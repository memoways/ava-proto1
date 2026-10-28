import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ value: null as unknown, member: true, user: true, failRead: false, failWrite: false, conflict: false, duplicate: false, mismatch: false, failReadback: false, writes: 0, filters: [] as Array<[string, unknown]>, keys: [] as string[], duringWrite: null as null | (() => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 auth: { getUser: async () => ({ data: { user: db.user ? { id: 'admin' } : null }, error: null }) },
 from: (table: string) => {
  let pending: unknown;
  const query = {
   select: () => query, eq: (key: string, value: unknown) => { if (key === 'key') db.keys.push(String(value)); db.filters.push([key, value]); return query; },
   maybeSingle: async () => table === 'admin_users' ? { data: db.member ? { user_id: 'admin' } : null, error: null }
    : { data: db.value ? { value: db.mismatch && db.writes ? { ...(db.value as object), version: 'different' } : structuredClone(db.value) } : null, error: db.failRead || (db.failReadback && db.writes) ? { message: 'read failed' } : null },
   insert: (row: { value: unknown }) => { pending = row.value; return query; }, update: (row: { value: unknown }) => { pending = row.value; return query; },
   then: (resolve: (value: unknown) => void) => {
    db.writes++; db.duringWrite?.();
    if (!db.conflict && !db.failWrite && !db.duplicate) db.value = structuredClone(pending);
    resolve({ data: db.conflict ? [] : [{ key: 'speech_workshop_documents' }], error: db.duplicate ? { code: '23505' } : db.failWrite ? { message: 'write failed' } : null });
   },
  }; return query;
 },
} }));
import { setActiveEnvironment } from '../environmentContext';
import { createAuditionSnapshot } from './speechAudition';
import { EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping } from './speechPerformanceSettings';
import { WORKSHOP_KEY, readWorkshop, saveWorkshopComparison, workshopEvidence, exportWorkshop, type WorkshopComparison } from './speechWorkshopStore';
function comparison(): WorkshopComparison {
 const a = createAuditionSnapshot('max', [{ name: 'Retenu', description: '' }], { ...EMPTY_SPEECH_PERFORMANCE, enabled: true, byCharacter: { max: { Retenu: proposeSpeechMapping('Retenu', '') } } }, false, true);
 const b = structuredClone(a); b.gradium.paddingBonus = a.gradium.paddingBonus === 0 ? 0.2 : 0;
 return { id: 'one', name: 'Rythme Max', hypothesis: 'Un rythme différent ?', environment: 'sandbox-ulrich', createdAt: 'date', updatedAt: 'date', character: 'max', provider: 'gradium', voice: 'max-voice', level: 3, line: { id: 'M1', text: 'Allô ?', context: 'Premier appel', state: 'Retenu' }, a, b, control: 'paddingBonus', diff: 'Rythme différent', transport: 'rest', references: { editorialVersion: 'inconnue' }, evidence: [], notes: { words: '', rhythm: '', timbre: '', artifacts: '' }, decision: 'relisten', cost: null };
}
describe('AP2 — admin-only sandbox documents, explicit CAS and exact readback', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); Object.assign(db, { value: null, member: true, user: true, failRead: false, failWrite: false, conflict: false, duplicate: false, mismatch: false, failReadback: false, writes: 0, filters: [], keys: [], duringWrite: null }); });
 it('distinguishes absence from unavailable reads, never falls back to prod and never writes while reading', async () => {
  expect(await readWorkshop('sandbox-ulrich')).toBeNull(); expect(db.writes).toBe(0);
  db.failRead = true; await expect(readWorkshop('sandbox-ulrich')).rejects.toMatchObject({ code: 'unavailable' });
  expect(db.filters.filter(([key]) => key === 'environment_id')).toEqual([['environment_id', 'sandbox-ulrich'], ['environment_id', 'sandbox-ulrich']]);
  expect(WORKSHOP_KEY.startsWith('ava_')).toBe(false);
 });
 it('saves and reloads an explicit named comparison, preserving other entries and unknown fields exactly', async () => {
  const first = await saveWorkshopComparison(comparison(), null, 'sandbox-ulrich');
  expect(await readWorkshop('sandbox-ulrich')).toEqual(first); expect(db.keys.every(key => key === WORKSHOP_KEY)).toBe(true);
  const existing = { ...first, extension: { keep: 1 }, comparisons: [{ ...first.comparisons[0], extension: 'keep', a: { ...first.comparisons[0].a, future: true } }, { ...comparison(), id: 'other', name: 'Other', future: 'untouched' }] };
  db.value = existing; const baseline = await readWorkshop('sandbox-ulrich');
  expect(baseline).toEqual(existing);
  const next = await saveWorkshopComparison({ ...comparison(), notes: { words: 'plus humain', rhythm: '', timbre: '', artifacts: '' }, decision: 'preferred' }, baseline, 'sandbox-ulrich');
  expect(next).toMatchObject({ extension: { keep: 1 }, comparisons: [{ extension: 'keep', a: { future: true }, decision: 'preferred' }, { id: 'other', future: 'untouched' }] });
  expect(db.filters).toContainEqual(['value', JSON.stringify(existing)]); expect(db.writes).toBe(2);
 });
 it('rejects stale baselines, atomic CAS races and concurrent first inserts without confirming', async () => {
  const baseline = await saveWorkshopComparison(comparison(), null, 'sandbox-ulrich');
  db.value = { ...baseline, version: 'elsewhere' };
  await expect(saveWorkshopComparison(comparison(), baseline, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'conflict' }); expect(db.writes).toBe(1);
  db.value = baseline; db.conflict = true;
  await expect(saveWorkshopComparison(comparison(), baseline, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'conflict' });
  db.value = null; db.conflict = false; db.duplicate = true;
  await expect(saveWorkshopComparison(comparison(), null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'conflict' });
 });
 it('distinguishes write failure, failed readback and mismatched readback', async () => {
  db.failWrite = true; await expect(saveWorkshopComparison(comparison(), null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'unavailable' });
  db.failWrite = false; db.writes = 0; db.failReadback = true;
  await expect(saveWorkshopComparison(comparison(), null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'readback' });
  db.failReadback = false; const baseline = await readWorkshop('sandbox-ulrich'); db.mismatch = true; db.writes = 0;
  await expect(saveWorkshopComparison(comparison(), baseline, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'readback' });
 });
 it('rejects production, foreign sandbox, non-admins and environment changes during writes', async () => {
  await expect(readWorkshop('prod')).rejects.toMatchObject({ code: 'context' });
  await expect(readWorkshop('sandbox-romed')).rejects.toMatchObject({ code: 'context' });
  db.member = false; await expect(readWorkshop('sandbox-ulrich')).rejects.toMatchObject({ code: 'forbidden' });
  db.member = true; db.user = false; await expect(saveWorkshopComparison(comparison(), null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'forbidden' }); expect(db.writes).toBe(0);
  db.user = true; db.duringWrite = () => setActiveEnvironment('sandbox-romed');
  await expect(saveWorkshopComparison(comparison(), null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'context' });
 });
 it('rejects foreign documents, unknown schemas and changes to more than one setting', async () => {
  db.value = { schemaVersion: 2 }; await expect(readWorkshop('sandbox-ulrich')).rejects.toMatchObject({ code: 'schema' });
  db.value = { schemaVersion: 1, environment: 'sandbox-romed', version: '1', comparisons: [] }; await expect(readWorkshop('sandbox-ulrich')).rejects.toMatchObject({ code: 'context' });
  db.value = null; const c = comparison(); c.b.gradium.temp += 0.1;
  await expect(saveWorkshopComparison(c, null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema' }); expect(db.writes).toBe(0);
 });
 it('supports one mapping variation for advanced providers and rejects a false no-change trial', async () => {
  const c = comparison(); c.provider = 'fish'; c.control = 'emotion'; c.b = structuredClone(c.a); c.b.settings.byCharacter.max.Retenu.emotion = 'angry';
  const saved = await saveWorkshopComparison(c, null, 'sandbox-ulrich');
  expect(saved.comparisons[0].b.settings.byCharacter.max.Retenu.emotion).toBe('angry');
  const identical = { ...c, b: structuredClone(c.a) };
  await expect(saveWorkshopComparison(identical, saved, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema' });
 });
 it('keeps only bounded parameter evidence, unknown provenance and separate human opinions in both exports', () => {
  const c = comparison();
  c.evidence = [workshopEvidence({ requests: [{ transport: 'rest', body: { text: 'full transcript', token: 'secret-token', prompt: 'full prompt', voice_id: 'max', json_config: { padding_bonus: 0.2, secret: 'hidden' } } }], transport: 'rest', cached: false, providerCalls: 1 }, 'A', true)];
  const json = exportWorkshop(c, 'json');
  expect(json).toContain('simulation'); expect(json).toContain('inconnue'); expect(json).toContain('padding_bonus');
  for (const secret of ['full transcript', 'secret-token', 'full prompt', 'hidden']) expect(json).not.toContain(secret);
  expect(exportWorkshop(c, 'text')).toContain('Coût : inconnu'); expect(exportWorkshop(c, 'text')).toContain('Aucune application au jeu');
 });
});
