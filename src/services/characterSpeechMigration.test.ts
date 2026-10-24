import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("drizzle/migrations/0007_pin_character_speech_runtime.sql", "utf8");
describe("speech snapshot access contract", () => {
  it("requires a session owner or verified admin and an authorized environment", () => {
    expect(sql).toContain("v_session.user_id IS DISTINCT FROM auth.uid() AND NOT v_admin");
    expect(sql).toContain("v_session.environment_id IS DISTINCT FROM v_env");
    expect(sql).toContain("private.current_external_test_access()");
    expect(sql).toContain("FROM PUBLIC, anon");
  });
  it("pins only once under a session lock and keeps the last two character turns", () => {
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("IF v_snapshot IS NULL THEN");
    expect(sql).toContain("entry ->> 'character_key' = p_character_key");
    expect(sql).toContain("ORDER BY ord DESC LIMIT 2");
  });
});