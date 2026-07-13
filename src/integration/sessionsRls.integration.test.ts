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
    await db.exec(await readFile(expandMigrationUrl, "utf8"));
    await db.exec(await readFile(enforceMigrationUrl, "utf8"));
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
});
