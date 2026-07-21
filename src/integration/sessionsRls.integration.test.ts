// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

async function authenticate(db: PGlite, userId: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec(`set role ${role}`);
}

describe("Phase 1 sessions RLS and provider quotas", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
      create function auth.uid() returns uuid
        language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;

      create type public.app_role as enum ('admin');
      create function public.has_role(uuid, public.app_role) returns boolean
        language sql stable as $$ select false $$;
      create schema private;
      alter function public.has_role(uuid, public.app_role) set schema private;
      revoke all on function private.has_role(uuid, public.app_role) from public;
      grant usage on schema private to authenticated, service_role;
      grant execute on function private.has_role(uuid, public.app_role)
        to authenticated, service_role;

      create table public.sessions (
        id uuid primary key default gen_random_uuid(),
        started_at timestamptz default now(),
        ended_at timestamptz,
        branch text default 'male',
        trust_level integer default 0,
        triggers_activated text[] default '{}',
        game_over_reason text,
        conversation_log jsonb default '[]',
        questionnaire_responses jsonb,
        duration_seconds integer,
        name text,
        personnage_appele text,
        admin_note text
      );
      alter table public.sessions enable row level security;
      grant select, insert, update, delete on public.sessions to anon, authenticated;
      create policy "Anon insert sessions" on public.sessions
        for insert to anon, authenticated with check (true);
      create policy "Anon update recent sessions" on public.sessions
        for update to anon, authenticated
        using (started_at > now() - interval '4 hours')
        with check (started_at > now() - interval '4 hours');
    `);

    const expandMigrationUrl = new URL(
      "../../supabase/migrations/20260712165019_secure_public_game_sessions.sql",
      import.meta.url,
    );
    const enforceMigrationUrl = new URL(
      "../../supabase/migrations/20260712165020_enforce_public_game_security.sql",
      import.meta.url,
    );
    const diagnosticTraceMigrationUrl = new URL(
      "../../supabase/migrations/20260721120000_conversation_turn_traces.sql",
      import.meta.url,
    );
    const ragLabQuestionsMigrationUrl = new URL(
      "../../supabase/migrations/20260721210000_rag_lab_pinned_questions.sql",
      import.meta.url,
    );
    const ragLabCorpusMigrationUrl = new URL(
      "../../supabase/migrations/20260721233000_rag_lab_semantic_question_cache.sql",
      import.meta.url,
    );
    await db.exec(await readFile(expandMigrationUrl, "utf8"));
    await db.exec(await readFile(enforceMigrationUrl, "utf8"));
    await db.exec(await readFile(diagnosticTraceMigrationUrl, "utf8"));
    await db.exec(await readFile(ragLabQuestionsMigrationUrl, "utf8"));
    await db.exec(await readFile(ragLabCorpusMigrationUrl, "utf8"));
  });

  afterEach(async () => {
    await db.close();
  });

  it("rejects a caller carrying only the public anon key", async () => {
    await db.exec("set role anon");
    await expect(
      db.query("insert into public.sessions default values returning id"),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("lets a participant create, read and update only their own session", async () => {
    await authenticate(db, USER_A);
    const created = await db.query<{ id: string; user_id: string }>(
      "insert into public.sessions default values returning id, user_id",
    );
    const sessionId = created.rows[0].id;
    expect(created.rows[0].user_id).toBe(USER_A);

    const ownUpdate = await db.query(
      "update public.sessions set conversation_log = '[{\"role\":\"user\"}]'::jsonb where id = $1",
      [sessionId],
    );
    expect(ownUpdate.affectedRows).toBe(1);

    await authenticate(db, USER_B);
    const foreignRead = await db.query(
      "select id from public.sessions where id = $1",
      [sessionId],
    );
    expect(foreignRead.rows).toHaveLength(0);

    const foreignUpdate = await db.query(
      "update public.sessions set conversation_log = '[]'::jsonb where id = $1",
      [sessionId],
    );
    expect(foreignUpdate.affectedRows).toBe(0);
  });

  it("prevents participants from changing protected administrative fields", async () => {
    await authenticate(db, USER_A);
    const created = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );

    await expect(
      db.query("update public.sessions set admin_note = 'tampered' where id = $1", [created.rows[0].id]),
    ).rejects.toThrow(/protected session fields/i);
  });

  it("rejects session-scoped side effects for another participant", async () => {
    await authenticate(db, USER_A);
    const created = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );

    await authenticate(db, USER_B);
    await expect(
      db.query(
        "select public.consume_game_rate_limit('sync-questionnaire', $1::uuid)",
        [created.rows[0].id],
      ),
    ).rejects.toThrow(/session ownership mismatch/i);
  });

  it("atomically refuses provider calls after the configured quota", async () => {
    await authenticate(db, USER_A);
    let last: { allowed: boolean; remaining: number } | null = null;
    for (let request = 0; request < 31; request += 1) {
      const result = await db.query<{ quota: { allowed: boolean; remaining: number } }>(
        "select public.consume_game_rate_limit('proxy-stt') as quota",
      );
      last = result.rows[0].quota;
    }

    expect(last).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("prevents a participant from enabling diagnostic capture", async () => {
    await authenticate(db, USER_B);
    await expect(db.query(
      "insert into public.sessions (diagnostic_trace_enabled) values (true) returning id",
    )).rejects.toThrow(/only admins can enable diagnostic traces/i);

    const created = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );

    await expect(db.query(
      "update public.sessions set diagnostic_trace_enabled = true where id = $1",
      [created.rows[0].id],
    )).rejects.toThrow(/diagnostic trace mode is immutable/i);
  });

  it("allows only an admin to create and read a trace for an enabled session", async () => {
    await db.exec("reset role");
    await db.exec(`
      create or replace function private.has_role(candidate uuid, requested public.app_role)
      returns boolean language sql stable
      as $$ select candidate = '${USER_A}'::uuid and requested = 'admin'::public.app_role $$;
    `);
    await authenticate(db, USER_A);
    const created = await db.query<{ id: string }>(
      "insert into public.sessions (diagnostic_trace_enabled) values (true) returning id",
    );
    const sessionId = created.rows[0].id;
    await expect(db.query(
      "update public.sessions set diagnostic_trace_enabled = false where id = $1",
      [sessionId],
    )).rejects.toThrow(/diagnostic trace mode is immutable/i);
    await db.query(
      `insert into public.conversation_turn_traces
        (session_id, turn_id, turn_index, trace)
       values ($1, 'turn-1', 1, '{"schemaVersion":1}'::jsonb)`,
      [sessionId],
    );

    const adminRead = await db.query(
      "select turn_index from public.conversation_turn_traces where session_id = $1",
      [sessionId],
    );
    expect(adminRead.rows).toHaveLength(1);

    await authenticate(db, USER_B);
    const participantRead = await db.query(
      "select turn_index from public.conversation_turn_traces where session_id = $1",
      [sessionId],
    );
    expect(participantRead.rows).toHaveLength(0);
  });

  it("deletes all turn traces when their diagnostic session is deleted", async () => {
    await db.exec("reset role");
    await db.exec(`
      create or replace function private.has_role(candidate uuid, requested public.app_role)
      returns boolean language sql stable
      as $$ select candidate = '${USER_A}'::uuid and requested = 'admin'::public.app_role $$;
    `);
    await authenticate(db, USER_A);
    const created = await db.query<{ id: string }>(
      "insert into public.sessions (diagnostic_trace_enabled) values (true) returning id",
    );
    const sessionId = created.rows[0].id;
    await db.query(
      `insert into public.conversation_turn_traces
        (session_id, turn_id, turn_index, trace)
       values ($1, 'turn-1', 1, '{"schemaVersion":1}'::jsonb)`,
      [sessionId],
    );
    await db.query("delete from public.sessions where id = $1", [sessionId]);

    await db.exec("reset role");
    const remaining = await db.query(
      "select id from public.conversation_turn_traces where session_id = $1",
      [sessionId],
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("reserves RAG laboratory pinned questions to admins and deletes them with their session", async () => {
    await authenticate(db, USER_B);
    const participantSession = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );
    await expect(db.query(
      "insert into public.rag_lab_pinned_questions (session_id, message_index, question) values ($1, 0, 'Où habites-tu ?')",
      [participantSession.rows[0].id],
    )).rejects.toThrow(/row-level security|permission denied/i);

    await db.exec("reset role");
    await db.exec(`
      create or replace function private.has_role(candidate uuid, requested public.app_role)
      returns boolean language sql stable
      as $$ select candidate = '${USER_A}'::uuid and requested = 'admin'::public.app_role $$;
    `);
    await authenticate(db, USER_A);
    const adminSession = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );
    await db.query(
      "insert into public.rag_lab_pinned_questions (session_id, message_index, question) values ($1, 0, 'Où habites-tu ?')",
      [adminSession.rows[0].id],
    );
    const pinned = await db.query(
      "select question from public.rag_lab_pinned_questions where session_id = $1",
      [adminSession.rows[0].id],
    );
    expect(pinned.rows).toHaveLength(1);

    await db.query("delete from public.sessions where id = $1", [adminSession.rows[0].id]);
    await db.exec("reset role");
    const remaining = await db.query(
      "select id from public.rag_lab_pinned_questions where session_id = $1",
      [adminSession.rows[0].id],
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("marks the semantic question cache stale without exposing it to participants", async () => {
    await db.exec("reset role");
    const before = await db.query<{ source_revision: number }>(
      "select source_revision from public.rag_lab_question_corpus_cache where id = true",
    );

    await authenticate(db, USER_B);
    const created = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );
    await db.query(
      `update public.sessions
          set conversation_log = '[{"role":"user","content":"Pourquoi Ava a-t-elle disparu ?"}]'::jsonb
        where id = $1`,
      [created.rows[0].id],
    );
    const hidden = await db.query("select id from public.rag_lab_question_corpus_cache");
    expect(hidden.rows).toHaveLength(0);

    await db.exec("reset role");
    const after = await db.query<{ source_revision: number; status: string }>(
      "select source_revision, status from public.rag_lab_question_corpus_cache where id = true",
    );
    expect(after.rows[0].source_revision).toBeGreaterThan(before.rows[0].source_revision);
    expect(after.rows[0].status).toBe("stale");
  });
});
