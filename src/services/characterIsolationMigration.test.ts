import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20260911080000_lock_character_identity_and_rag.sql",
  "utf8",
);

describe("character isolation migration", () => {
  it("refuse les recherches globales, les sources sans propriétaire et les pages étrangères", () => {
    expect(SQL).toContain("p_character_id IS NOT NULL");
    expect(SQL).toContain("p_embedding_profile IS NOT NULL");
    expect(SQL).toContain("e.source_table = 'characters'");
    expect(SQL).toContain("e.source_id = p_character_id");
    expect(SQL).toContain("e.character_id = p_character_id");
    expect(SQL).not.toMatch(/p_character_id IS NULL OR e\.character_id IS NULL/);
  });

  it("stocke les résumés par session et personnage en laissant les anciens globaux diagnostiquables", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS character_key text");
    expect(SQL).toContain("session_summaries_session_character_key");
    expect(SQL).toContain("character_key IS NULL OR character_key IN ('max', 'emma')");
  });

  it("remplace le corpus d'un personnage dans une seule transaction RPC", () => {
    expect(SQL).toContain("replace_character_embeddings");
    expect(SQL.indexOf("INSERT INTO public.embeddings")).toBeLessThan(SQL.indexOf("DELETE FROM public.embeddings"));
    expect(SQL).toContain("service role required");
  });
});
