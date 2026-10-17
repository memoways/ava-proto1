import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock("@/services/debugLogger", () => ({
  debugLogger: {
    logFetch: vi.fn(() => "debug-id"),
    logResponse: vi.fn(),
    logError: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { formatMaxRAGContext, queryRAGDetailed, type RAGMatch } from "@/services/ragService";

const MAX_ID = "11111111-1111-4111-8111-111111111111";

describe("queryRAGDetailed — requête réellement envoyée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omet query sans rewrite afin que le serveur combine message et contexte récent", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(new Response(JSON.stringify({
      matches: [],
      search_input: "Où est Ava ?\n\nContexte récent: Max a parlé de Lausanne",
      embedding_provider: "voyage",
      rerank_used: true,
      rerank_model: "rerank-2.5-lite",
      latency_ms: 17,
    }), { status: 200 }));

    const result = await queryRAGDetailed("Où est Ava ?", "Max a parlé de Lausanne", 5, 0.3, {
      characterId: MAX_ID,
      rerank: true,
      retrieveK: 15,
      rerankModel: "rerank-2.5-lite",
      rerankTruncation: false,
      includeRetrievalMatches: true,
    });

    const requestInit = vi.mocked(authenticatedFunctionFetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body).not.toHaveProperty("query");
    expect(body).toMatchObject({
      user_message: "Où est Ava ?",
      recent_context: "Max a parlé de Lausanne",
      character_id: MAX_ID,
      rerank_model: "rerank-2.5-lite",
      rerank_truncation: false,
      include_retrieval_matches: true,
    });
    expect(result.searchInput).toBe("Où est Ava ?\n\nContexte récent: Max a parlé de Lausanne");
    expect(result.request.variantKey).toBe("rerank=rerank-2.5-lite|retrieve=15|top=5|threshold=0.3|truncate=false|raw");
  });

  it("envoie la requête réécrite et conserve l'ordre ainsi que tous les scores", async () => {
    const matches = [
      { id: "2", source_table: "characters", source_id: MAX_ID, character_id: MAX_ID, content: "Second", similarity: 0.97, retrieval_similarity: 0.62, rerank_score: 0.97 },
      { id: "1", source_table: "characters", source_id: MAX_ID, character_id: MAX_ID, content: "Premier", similarity: 0.88, retrieval_similarity: 0.84, rerank_score: 0.88 },
    ];
    const retrievalMatches = [...matches].reverse();
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(new Response(JSON.stringify({
      matches,
      retrieval_matches: retrievalMatches,
      search_input: "Ava domicile Lausanne",
      embedding_provider: "voyage",
      rerank_used: true,
      latency_ms: 9,
    }), { status: 200 }));

    const result = await queryRAGDetailed("Et elle ?", "contexte ambigu", 5, 0.3, {
      rewrittenQuery: "Ava domicile Lausanne",
      characterId: MAX_ID,
    });

    const requestInit = vi.mocked(authenticatedFunctionFetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.query).toBe("Ava domicile Lausanne");
    expect(result.searchInput).toBe("Ava domicile Lausanne");
    expect(result.matches).toEqual(matches);
    expect(result.retrievalMatches).toEqual(retrievalMatches);
    expect(result.matches.map((match) => match.id)).toEqual(["2", "1"]);
  });

  it("écarte côté client tout extrait étranger ou sans propriétaire", async () => {
    const foreignId = "22222222-2222-4222-8222-222222222222";
    const candidates = [
      { id: "max", source_table: "characters", source_id: MAX_ID, character_id: MAX_ID, content: "Max", similarity: 0.9 },
      { id: "emma", source_table: "characters", source_id: foreignId, character_id: foreignId, content: "Emma", similarity: 0.99 },
      { id: "global", source_table: "characters", source_id: MAX_ID, character_id: null, content: "Global", similarity: 0.95 },
    ];
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(new Response(JSON.stringify({
      matches: candidates,
      retrieval_matches: [...candidates].reverse(),
    }), { status: 200 }));

    const result = await queryRAGDetailed("Question", undefined, 5, 0.3, { characterId: MAX_ID });
    expect(result.matches.map((match) => match.id)).toEqual(["max"]);
    expect(result.retrievalMatches.map((match) => match.id)).toEqual(["max"]);
  });

  it("ne donne pas à Max un souvenir privé d'Emma, ni l'inverse", async () => {
    const emmaId = "22222222-2222-4222-8222-222222222222";
    const privateMemories = [
      { id: "max-private", source_table: "characters", source_id: MAX_ID, character_id: MAX_ID, content: "### SOUVENIR MAX J-1.01 — Tu caches le thermos à Emma.", similarity: 0.91 },
      { id: "emma-private", source_table: "characters", source_id: emmaId, character_id: emmaId, content: "### SOUVENIR EMMA J-2.01 — Max t'avoue le thermos qu'il t'avait caché.", similarity: 0.99 },
    ];
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(new Response(JSON.stringify({
      matches: privateMemories,
      retrieval_matches: [...privateMemories].reverse(),
    }), { status: 200 }));

    const forMax = await queryRAGDetailed("Le thermos", undefined, 5, 0.3, { characterId: MAX_ID });
    expect(forMax.matches.map((item) => item.content).join("\n")).toContain("Tu caches le thermos");
    expect(forMax.matches.map((item) => item.content).join("\n")).not.toContain("EMMA");

    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(new Response(JSON.stringify({
      matches: privateMemories,
      retrieval_matches: [...privateMemories].reverse(),
    }), { status: 200 }));
    const forEmma = await queryRAGDetailed("Le thermos", undefined, 5, 0.3, { characterId: emmaId });
    expect(forEmma.matches.map((item) => item.content).join("\n")).toContain("Max t'avoue le thermos");
    expect(forEmma.matches.map((item) => item.content).join("\n")).not.toContain("MAX J-1.01");
  });

  it("refuse une recherche sans identifiant de personnage", async () => {
    await expect(queryRAGDetailed("Question", undefined, 5, 0.3, {} as never)).rejects.toThrow(/characterId/i);
    expect(authenticatedFunctionFetch).not.toHaveBeenCalled();
  });
});

describe("formatMaxRAGContext — contexte live compact", () => {
  const match = (id: string, content: string): RAGMatch => ({
    id,
    source_table: "characters",
    source_id: `source-${id}`,
    content,
    similarity: 0.9,
  });

  it("injecte au plus trois souvenirs sans métadonnées techniques", () => {
    const context = formatMaxRAGContext([
      match("1", "Personnage: Max Lorenzo | Partie 1/9 Une première mémoire canonique."),
      match("2", "Deuxième mémoire canonique."),
      match("3", "Troisième mémoire canonique."),
      match("4", "Quatrième mémoire qui ne doit pas être injectée."),
    ]);
    expect(context.match(/Souvenir \d/g)).toHaveLength(3);
    expect(context).not.toContain("Partie 1/9");
    expect(context).not.toContain("source_table");
    expect(context).not.toContain("score");
    expect(context).not.toContain("Quatrième");
    expect(context.length).toBeLessThanOrEqual(6_100);
  });

  it("écarte un chunk qui partage 120 caractères consécutifs", () => {
    const overlap = "a".repeat(125);
    const context = formatMaxRAGContext([
      match("1", `Début ${overlap} fin A.`),
      match("2", `Autre début ${overlap} fin B.`),
      match("3", "Mémoire distincte."),
    ]);
    expect(context.match(/Souvenir \d/g)).toHaveLength(2);
    expect(context).not.toContain("fin B");
  });

  it("conserve deux souvenirs distincts qui partagent Point de vue, Quand et Lieu", () => {
    const header = [
      "## Il y a quatre jours, jour 1 à la montagne",
      "Point de vue : Max Lorenzo",
      "Quand : il y a quatre jours — jour 1 à la montagne, dans la vieille voiture",
      "Lieu : vieille voiture près du chalet, au bout du chemin forestier",
    ].join("\n");
    const context = formatMaxRAGContext([
      match("1", `${header}\n### SOUVENIR MAX J-1.01 — Thermos\nTu trouves le thermos et tu te tais.`),
      match("2", `${header}\n### SOUVENIR MAX J-1.02 — Silence\nTu avoues le thermos et Emma quitte l'annexe.`),
    ]);
    expect(context).toContain("tu te tais");
    expect(context).toContain("quitte l'annexe");
    expect(context.match(/Souvenir \d/g)).toHaveLength(2);
  });

  it("injecte entier un souvenir de 1 694 caractères et écarte le suivant s'il ne tient pas", () => {
    const ending = "La dernière phrase du thermos reste entière.";
    const whole = `${"a".repeat(1694 - ending.length)}${ending}`;
    expect(whole).toHaveLength(1694);
    const kept = formatMaxRAGContext([match("1", whole)]);
    expect(kept).toContain(ending);
    expect(kept).not.toContain("…");

    const first = "Tu trouves le thermos et tu te tais jusqu'au bout.";
    const secondEnding = "La phrase d'Emma ne doit pas être coupée.";
    const second = `${"b".repeat(800)}${secondEnding}`;
    const partialBudget = formatMaxRAGContext(
      [match("1", first), match("2", second)],
      { totalChars: first.length + 20 },
    );
    expect(partialBudget).toContain("jusqu'au bout");
    expect(partialBudget).not.toContain(secondEnding);
    expect(partialBudget).not.toContain("…");

    const tooLong = `${"c".repeat(150)}Fin qui ne doit pas apparaître coupée.`;
    expect(formatMaxRAGContext([match("1", tooLong)], { itemChars: 100 })).toBe("");
  });
});
