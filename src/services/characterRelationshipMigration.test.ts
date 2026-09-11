import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20260911122837_character_relationship_policy.sql",
  "utf8",
);

describe("character relationship policy migration", () => {
  it("keeps relationship progression separate from intellectual references", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS politique_relationnelle text");
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS references_intellectuelles text");
  });

  it("returns the encounter frame through the authenticated runtime contract", () => {
    expect(SQL).toContain("situation_summary text");
    expect(SQL).toContain("prompt.situation_summary");
    expect(SQL).toContain("SECURITY DEFINER");
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.get_character_runtime_readiness_for_environment");
    expect(SQL).toContain("GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness_for_environment");
  });
});
