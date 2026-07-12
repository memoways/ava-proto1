// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

/**
 * Phase 0 characterization test.
 *
 * It reproduces the session policies currently committed in the Supabase
 * migrations using an isolated PostgreSQL 17 runtime. The expected failure is
 * deliberate: it keeps the public-release gate closed until session ownership
 * is implemented in Phase 1, without weakening RLS by adding a broad SELECT.
 */
describe("sessions RLS contract for anonymous game clients", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create table public.sessions (
        id uuid primary key default gen_random_uuid(),
        started_at timestamptz not null default now(),
        conversation_log jsonb not null default '[]'::jsonb
      );
      alter table public.sessions enable row level security;
      grant select, insert, update on public.sessions to anon;
      create policy "Anon insert sessions"
        on public.sessions for insert to anon with check (true);
      create policy "Anon update recent sessions"
        on public.sessions for update to anon
        using (started_at > now() - interval '4 hours')
        with check (started_at > now() - interval '4 hours');
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it("proves insert-returning is blocked without a matching SELECT policy", async () => {
    await db.exec("set role anon");

    await expect(
      db.query("insert into public.sessions default values returning id"),
    ).rejects.toThrow(/row-level security policy/i);
  });

  it("proves UPDATE silently affects zero rows without a matching SELECT policy", async () => {
    const created = await db.query<{ id: string }>(
      "insert into public.sessions default values returning id",
    );
    const sessionId = created.rows[0].id;
    await db.exec("set role anon");

    const result = await db.query(
      "update public.sessions set conversation_log = '[{\"role\":\"user\"}]'::jsonb where id = $1",
      [sessionId],
    );

    expect(result.affectedRows).toBe(0);
  });
});
