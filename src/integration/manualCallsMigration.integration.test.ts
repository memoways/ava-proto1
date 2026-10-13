// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

describe("manual calls against the historical session constraint", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`create table public.sessions (
      id integer primary key,
      active_character text not null,
      handoff_count integer not null default 0
        constraint sessions_handoff_count_check check (handoff_count >= 0 and handoff_count <= 1)
    ); insert into public.sessions values (1, 'max', 1);`);
  });

  afterEach(async () => db.close());

  it("preserves the existing session and accepts repeated calls after migration", async () => {
    await expect(db.exec("update public.sessions set active_character = 'emma', handoff_count = 2 where id = 1"))
      .rejects.toThrow(/sessions_handoff_count_check/);
    const migration = await readFile(new URL(
      "../../supabase/migrations/20261013090739_allow_repeated_manual_calls.sql", import.meta.url,
    ), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    expect((await db.query("select * from public.sessions")).rows)
      .toEqual([{ id: 1, active_character: "max", handoff_count: 1 }]);
    await db.exec("update public.sessions set active_character = 'emma', handoff_count = 2 where id = 1");
    await db.exec("update public.sessions set active_character = 'max', handoff_count = 3 where id = 1");
    expect((await db.query("select * from public.sessions")).rows)
      .toEqual([{ id: 1, active_character: "max", handoff_count: 3 }]);
    await expect(db.exec("update public.sessions set handoff_count = -1 where id = 1"))
      .rejects.toThrow(/sessions_handoff_count_check/);
    await expect(db.exec("update public.sessions set handoff_count = null where id = 1"))
      .rejects.toThrow(/not-null/);
  });
});
