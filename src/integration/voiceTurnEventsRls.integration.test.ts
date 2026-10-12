// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT = "22222222-2222-4222-8222-222222222222";
const EXTERNAL = "33333333-3333-4333-8333-333333333333";
const OWN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXPIRED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXTERNAL_SESSION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const migration = await readFile(new URL("../../supabase/migrations/20261012170925_p0_voice_turn_events_storage.sql", import.meta.url), "utf8");

describe("P0 telemetry storage RLS", () => {
  let db: PGlite;
  async function login(user: string | null, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
  }
  async function insert(session: string | null, environment = "prod", context = "public", event = "voice_turn_started") {
    return db.query(`insert into public.voice_turn_events
      (session_id, turn_id, turn_index, event_name, environment_id, context_type, metadata_json)
      values ($1, 'test-turn', 1, $2, $3, $4, '{"schema_version":2}'::jsonb)`,
    [session, event, environment, context]);
  }
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, private to authenticated, service_role;
      grant execute on function auth.uid() to authenticated, service_role;
      create table public.admin_users (user_id uuid primary key);
      insert into public.admin_users values ('${ADMIN}');
      create function private.is_admin_member(candidate uuid) returns boolean
        language sql stable security definer set search_path = pg_catalog, public, private
        as $$ select candidate is not null and exists (select 1 from public.admin_users where user_id = candidate) $$;
      revoke all on function private.is_admin_member(uuid) from public, anon;
      grant execute on function private.is_admin_member(uuid) to authenticated, service_role;
      create table public.environments (id text primary key);
      insert into public.environments values ('prod'), ('sandbox-ulrich');
      create table public.sessions (id uuid primary key, user_id uuid, started_at timestamptz,
        environment_id text not null, context_type text not null, ended_at timestamptz);
      insert into public.sessions values
        ('${OWN}', '${PARTICIPANT}', now(), 'prod', 'public'),
        ('${FOREIGN}', '${ADMIN}', now(), 'sandbox-ulrich', 'sandbox'),
        ('${EXPIRED}', '${PARTICIPANT}', now() - interval '5 hours', 'prod', 'public'),
        ('${EXTERNAL_SESSION}', '${EXTERNAL}', now(), 'sandbox-ulrich', 'user_test');
      alter table public.sessions enable row level security;
      grant select on public.sessions to authenticated;
      create policy own_sessions on public.sessions for select to authenticated using
        (user_id = (select auth.uid()) or (select private.is_admin_member((select auth.uid()))));
      -- Simulate the older Cloud default grants: the migration must revoke them.
      alter default privileges in schema public grant all on tables to anon, authenticated;
    `);
    await db.exec(migration);
  }, 30_000);
  afterAll(async () => { await db?.close(); });

  it("creates the actual query columns instead of failing with a missing relation", async () => {
    await login(ADMIN);
    const result = await db.query(`select id, created_at, event_name, metadata_json from public.voice_turn_events
      where environment_id = 'sandbox-ulrich' and metadata_json->>'schema_version' = '2'
      order by created_at desc, id desc limit 101`);
    expect(result.rows).toEqual([]);
  });
  it("accepts own-session telemetry, including failures and finalization after hangup", async () => {
    await login(PARTICIPANT);
    await expect(insert(OWN)).resolves.toMatchObject({ affectedRows: 1 });
    await db.exec("reset role");
    await db.query("update public.sessions set ended_at = now() where id = $1", [OWN]);
    await login(PARTICIPANT);
    await expect(insert(OWN, "prod", "public", "voice_turn_finished")).resolves.toMatchObject({ affectedRows: 1 });
  });
  it("keeps external participant sandbox attribution and admin capture", async () => {
    await login(EXTERNAL);
    await expect(insert(EXTERNAL_SESSION, "sandbox-ulrich", "user_test")).resolves.toMatchObject({ affectedRows: 1 });
    await login(ADMIN);
    await expect(insert(FOREIGN, "sandbox-ulrich", "sandbox", "voice_turn_gm")).resolves.toMatchObject({ affectedRows: 1 });
  });
  it.each([
    [FOREIGN, "sandbox-ulrich", "sandbox"], [OWN, "sandbox-ulrich", "public"],
    [OWN, "prod", "sandbox"], [EXPIRED, "prod", "public"], [null, "prod", "public"],
  ])("rejects foreign, forged, expired or unscoped capture (%s %s %s)", async (session, environment, context) => {
    await login(PARTICIPANT);
    await expect(insert(session, environment, context)).rejects.toThrow(/row-level security|permission denied/i);
  });
  it("rejects the public anon role and authenticated callers without an identity", async () => {
    await login(null, "anon");
    await expect(insert(OWN)).rejects.toThrow(/permission denied/i);
    await expect(db.query("select id from public.voice_turn_events")).rejects.toThrow(/permission denied/i);
    await login(null);
    await expect(insert(OWN)).rejects.toThrow(/row-level security/i);
  });
  it("hides all telemetry from participants and forbids mutation", async () => {
    await login(PARTICIPANT);
    expect((await db.query("select id from public.voice_turn_events")).rows).toEqual([]);
    await expect(db.query("update public.voice_turn_events set event_name = 'tampered'")).rejects.toThrow(/permission denied/i);
    await expect(db.query("delete from public.voice_turn_events")).rejects.toThrow(/permission denied/i);
  });
  it("preserves V1/V2 rows and existing sessions when reapplied", async () => {
    await login(null, "service_role");
    await db.exec("reset role");
    await db.query("insert into public.voice_turn_events (turn_id, metadata_json) values ('legacy', '{}'::jsonb)");
    const before = (await db.query<{ count: number }>("select count(*)::int as count from public.voice_turn_events")).rows[0].count;
    await db.exec(migration);
    await login(ADMIN);
    expect((await db.query<{ count: number }>("select count(*)::int as count from public.voice_turn_events")).rows[0].count).toBe(before);
    expect((await db.query("select id from public.sessions")).rows).toHaveLength(4);
  });
  it("reads ordered V2 pages without mixing legacy rows", async () => {
    await login(ADMIN);
    const query = `select id from public.voice_turn_events where metadata_json->>'schema_version' = '2'
      order by created_at desc, id desc limit 2 offset $1`;
    const first = (await db.query<{ id: string }>(query, [0])).rows;
    const second = (await db.query<{ id: string }>(query, [2])).rows;
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(new Set([...first, ...second].map(row => row.id)).size).toBe(4);
  });
  it("secures an already-created historical table without deleting its rows", async () => {
    await db.exec("reset role");
    await db.exec("drop table public.voice_turn_events");
    const historical = await readFile(new URL("../../supabase/migrations/20260522103000_voice_observability_events.sql", import.meta.url), "utf8");
    await db.exec(historical);
    await db.query("insert into public.voice_turn_events (turn_id) values ('historical')");
    await db.exec(migration);
    await login(null, "anon");
    await expect(db.query("select id from public.voice_turn_events")).rejects.toThrow(/permission denied/i);
    await login(PARTICIPANT);
    expect((await db.query("select id from public.voice_turn_events")).rows).toEqual([]);
    await login(ADMIN);
    expect((await db.query<{ turn_id: string }>("select turn_id from public.voice_turn_events")).rows).toEqual([{ turn_id: "historical" }]);
  });
});
