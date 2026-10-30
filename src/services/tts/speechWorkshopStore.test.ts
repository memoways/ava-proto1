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
import { WORKSHOP_KEY, readWorkshop, saveWorkshopComparison, saveIntentTrial, cardEvidence, workshopEvidence, exportWorkshop, type IntentTrial, type WorkshopComparison } from './speechWorkshopStore';
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
function trial(id = 'trial-1'): IntentTrial {
 const heard = cardEvidence({ requests: [{ transport: 'rest', body: { voice_id: 'max', text: 'never stored', json_config: { temp: 0.74, padding_bonus: 0.7 } } }], transport: 'rest', cached: false, providerCalls: 1 });
 return { id, environment: 'sandbox-ulrich', createdAt: 'date', character: 'max',
  passage: { id: 'P1', situation: 'Premier échange', text: 'Emma est dans la cuisine depuis ce matin.', edited: false },
  intent: { id: 'peur', label: 'Peur', recipe: { emotion: 'scared', intensity: 2, delivery: 'rushed', speedHint: 1.08, pauses: 'short', actingNl: 'very frightened' } },
  cards: [
   { provider: 'gradium', voice: 'max', voiceSource: 'game', planned: { 'Variabilité (temp)': 0.8 }, ignored: ['Chuchotement'], evidence: heard, rating: 3, off: 'trop posé' },
   { provider: 'fish', voice: 'ref', voiceSource: 'provider_default', planned: { 'Marqueur d’émotion': '(scared)' }, ignored: ['Instruction de jeu'], evidence: heard, rating: 5, off: '' },
   { provider: 'cartesia', voice: null, voiceSource: 'provider_default', planned: { Vitesse: 1.08 }, ignored: ['Émotion'], evidence: null, rating: null, off: '' },
  ] };
}
describe('AP4 — intent trials in the same document', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); Object.assign(db, { value: null, member: true, user: true, failRead: false, failWrite: false, conflict: false, duplicate: false, mismatch: false, failReadback: false, writes: 0, filters: [], keys: [], duringWrite: null }); });
 it('appends a trial with CAS and exact readback, keeping AP2 comparisons and extensions intact', async () => {
  const ap2 = await saveWorkshopComparison(comparison(), null, 'sandbox-ulrich');
  db.value = { ...ap2, extension: { keep: true } }; const baseline = await readWorkshop('sandbox-ulrich');
  const saved = await saveIntentTrial(trial(), baseline, 'sandbox-ulrich');
  expect(saved.comparisons).toEqual(ap2.comparisons); expect(saved).toMatchObject({ extension: { keep: true }, intentTrials: [{ id: 'trial-1' }] });
  expect(await readWorkshop('sandbox-ulrich')).toEqual(saved); expect(JSON.stringify(saved)).not.toContain('never stored');
  const second = await saveIntentTrial(trial('trial-2'), saved, 'sandbox-ulrich');
  expect(second.intentTrials?.map(t => t.id)).toEqual(['trial-2', 'trial-1']);
  await expect(saveIntentTrial(trial('trial-2'), second, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'conflict' });
 });
 it('reads AP2-only documents and refuses stale baselines, failed readback and foreign trials', async () => {
  const ap2 = await saveWorkshopComparison(comparison(), null, 'sandbox-ulrich');
  expect((await readWorkshop('sandbox-ulrich'))?.intentTrials).toBeUndefined();
  db.value = { ...ap2, version: 'elsewhere' };
  await expect(saveIntentTrial(trial(), ap2, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'conflict' });
  db.value = ap2; db.mismatch = true; db.writes = 0;
  await expect(saveIntentTrial(trial(), ap2, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'readback' });
  db.value = { ...ap2, intentTrials: [{ ...trial(), environment: 'sandbox-romed' }] }; db.mismatch = false;
  await expect(readWorkshop('sandbox-ulrich')).rejects.toMatchObject({ code: 'context' });
 });
 it('requires a heard card, a reason below 5 and unique providers; a 5 needs no reason', async () => {
  const noReason = trial(); noReason.cards[0].off = ' ';
  await expect(saveIntentTrial(noReason, null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema', message: expect.stringContaining('off') });
  const unheard = trial(); unheard.cards[2].rating = 4; unheard.cards[2].off = 'plat';
  await expect(saveIntentTrial(unheard, null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema', message: expect.stringContaining('générée') });
  const none = trial(); for (const card of none.cards) card.rating = null;
  await expect(saveIntentTrial(none, null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema' });
  const duplicate = trial(); duplicate.cards[2] = { ...duplicate.cards[1] };
  await expect(saveIntentTrial(duplicate, null, 'sandbox-ulrich')).rejects.toMatchObject({ code: 'schema' });
  expect(db.writes).toBe(0);
  const five = trial(); five.cards = [five.cards[1]];
  expect((await saveIntentTrial(five, null, 'sandbox-ulrich')).intentTrials?.[0].cards[0]).toMatchObject({ rating: 5, off: '' });
 });
});
