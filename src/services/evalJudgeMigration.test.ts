import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("supabase/migrations/20260825180000_eval_llm_as_judge.sql", "utf8");

describe("eval_llm_as_judge migration", () => {
  it("creates admin-only tables and revokes anonymous access", () => {
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.eval_items");
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.eval_runs");
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.eval_results");
    expect(SQL).toContain("REVOKE ALL ON public.eval_items FROM PUBLIC, anon");
    expect(SQL).toContain("REVOKE ALL ON public.eval_runs FROM PUBLIC, anon");
    expect(SQL).toContain("REVOKE ALL ON public.eval_results FROM PUBLIC, anon");
    expect(SQL).toContain("private.is_admin_member");
    expect(SQL).not.toContain("TO anon");
  });
});
