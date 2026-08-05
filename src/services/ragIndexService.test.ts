import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "admin-token" } } })) } },
}));
vi.mock("@/services/ragService", () => ({ AVA_NOTION_DATABASES: { characters: "characters" } }));

import {
  activateExistingRagProfile,
  RAG_EMBEDDING_PROFILES,
  summarizeRagRuntimeMetrics,
} from "@/services/ragIndexService";

afterEach(() => vi.unstubAllGlobals());

describe("RAG embedding profiles", () => {
  it("uses the shared Voyage 4 space for realtime documents and queries", () => {
    const profile = RAG_EMBEDDING_PROFILES["voyage-4-realtime"];
    expect(profile.documentModel).toBe("voyage-4-large");
    expect(profile.queryModel).toBe("voyage-4-lite");
    expect(profile.dimension).toBe(1024);
    expect(profile.dtype).toBe("float");
  });

  it("keeps contextual embeddings isolated in a dedicated profile", () => {
    const profile = RAG_EMBEDDING_PROFILES["voyage-context-4-quality"];
    expect(profile.endpoint).toBe("contextualizedembeddings");
    expect(profile.chunkingStrategy).toContain("contextualized");
    expect(profile.chunkOverlapChars).toBe(0);
  });
});

describe("RAG profile activation", () => {
  it("requests an atomic switch without rebuilding an existing profile", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      rag_profile: "voyage-3-legacy",
      activated_profile: "voyage-3-legacy",
      profile_embeddings_in_db: 42,
      characters_synced: 0,
      latency_ms: 10,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await activateExistingRagProfile("voyage-3-legacy");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      rag_profile: "voyage-3-legacy",
      activate_existing_profile: true,
    });
  });
});

describe("summarizeRagRuntimeMetrics", () => {
  it("computes p50, p95 and the zero-result rate from measured turns", () => {
    const metrics = summarizeRagRuntimeMetrics([
      { t_rag_total_ms: 100, rag_matches_count: 3, created_at: "2026-08-05T12:00:00Z" },
      { t_rag_total_ms: 200, rag_matches_count: 0, created_at: "2026-08-05T11:00:00Z" },
      { t_rag_total_ms: 300, rag_matches_count: 2, created_at: "2026-08-05T10:00:00Z" },
      { t_rag_total_ms: 900, rag_matches_count: 0, created_at: "2026-08-05T09:00:00Z" },
    ]);
    expect(metrics).toMatchObject({ sampleSize: 4, p50Ms: 200, p95Ms: 900, missRate: 0.5 });
  });
});
