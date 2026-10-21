// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
const io = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/gameAuth', () => ({ ensureGameAuth: async () => {} }));
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return { supabase: createClient('https://handoff.invalid', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: io.fetch } }) };
});
import { writeHandoffSnapshot, HandoffConflictError, type HandoffSnapshot } from '@/services/sessionHandoff';
import { advanceHandoffTurn, revokeHandoff } from '@/services/characterHandoffState';

const db = new PGlite();
const initial: HandoffSnapshot = { id: 'session', active_character: 'emma', orchestration_version_id: 'v6',
  handoff_count: 0, pending_handoff: null, conversation_log: [] };
const context = { sessionId: 'session', sourceCharacter: 'emma' as const, orchestrationVersionId: 'v6', turnId: 'session:4', turnIndex: 4 };
describe('Postgres JSONB CAS through the actual Supabase REST filter builder', () => {
  beforeAll(async () => {
    await db.exec('create table sessions (id text primary key, ended_at timestamptz, active_character text, personnage_appele text, orchestration_version_id text, handoff_count int, pending_handoff jsonb, conversation_log jsonb)');
    io.fetch.mockImplementation(async (request: RequestInfo | URL, options: RequestInit) => {
      const url = new URL(String(request));
      const q = url.searchParams;
      expect(q.get('id')).toBe('eq.session');
      expect(q.get('ended_at')).toBe('is.null');
      const patch = JSON.parse(String(options.body));
      const old = q.get('pending_handoff')!;
      const { rows } = await db.query(`update sessions set pending_handoff=$1::jsonb,
        active_character=coalesce($2,active_character), personnage_appele=coalesce($2,personnage_appele),
        handoff_count=coalesce($3,handoff_count), conversation_log=coalesce($9::jsonb,conversation_log) where id=$4 and ended_at is null
        and active_character=$5 and orchestration_version_id=$6 and handoff_count=$7
        and pending_handoff is not distinct from $8::jsonb returning id`,
      [JSON.stringify(patch.pending_handoff), patch.active_character ?? null, patch.handoff_count ?? null,
        q.get('id')!.slice(3), q.get('active_character')!.slice(3), q.get('orchestration_version_id')!.slice(3),
        Number(q.get('handoff_count')!.slice(3)), old === 'is.null' ? null : old.slice(3), patch.conversation_log ? JSON.stringify(patch.conversation_log) : null]);
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });
  beforeEach(async () => { await db.exec("delete from sessions; insert into sessions values ('session',null,'emma','emma','v6',0,null,'[]')"); });
  afterAll(async () => db.close());
  it('allows only one of two concurrent acceptances, including retry of the same click', async () => {
    const state = advanceHandoffTurn(null, context);
    const saved = await writeHandoffSnapshot(initial, state);
    const results = await Promise.allSettled([writeHandoffSnapshot(saved, revokeHandoff(state), 'max'),
      writeHandoffSnapshot(saved, revokeHandoff(state), 'max')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: expect.any(HandoffConflictError) });
    expect((await db.query('select active_character,handoff_count from sessions')).rows).toEqual([{ active_character: 'max', handoff_count: 1 }]);
  });
  it('a revocation witness prevents a late GM from recreating an offer, even after none', async () => {
    const state = advanceHandoffTurn(null, context);
    const saved = await writeHandoffSnapshot(initial, state);
    await writeHandoffSnapshot(saved, revokeHandoff(state));
    await expect(writeHandoffSnapshot(saved, { ...state, revision: 'late' })).rejects.toBeInstanceOf(HandoffConflictError);
    await expect(writeHandoffSnapshot(initial, state)).rejects.toBeInstanceOf(HandoffConflictError);
  });
  it('a late GM cannot overwrite the transcript or offer after another window advances', async () => {
    const state = advanceHandoffTurn(null, context);
    const t4 = [{ role: 'user' as const, content: 'T4', timestamp: 4 }];
    const saved = await writeHandoffSnapshot(initial, state, undefined, t4);
    const t5 = [...t4, { role: 'user' as const, content: 'T5 from another window', timestamp: 5 }];
    const newer = advanceHandoffTurn(state, { ...context, turnId: 'session:5', turnIndex: 5 });
    await writeHandoffSnapshot(saved, newer, undefined, t5);
    await expect(writeHandoffSnapshot(saved, revokeHandoff(state), undefined, t4)).rejects.toBeInstanceOf(HandoffConflictError);
    const row = (await db.query<{ conversation_log: unknown; pending_handoff: unknown }>('select conversation_log,pending_handoff from sessions')).rows[0];
    expect(row.conversation_log).toEqual(t5);
    expect(row.pending_handoff).toEqual(newer);
  });
  it.each(["ended_at=now()", "orchestration_version_id='v7'", "active_character='max'", 'handoff_count=1'])(
    'refuses an outdated snapshot after %s', async change => {
      await db.exec(`update sessions set ${change}`);
      await expect(writeHandoffSnapshot(initial, advanceHandoffTurn(null, context))).rejects.toBeInstanceOf(HandoffConflictError);
    });
});
