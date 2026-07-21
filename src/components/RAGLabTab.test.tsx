import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => ({
          data: [{ id: "max-id", name: "Max" }, { id: "ava-id", name: "Ava" }],
          error: null,
        })),
      })),
    })),
  },
}));

vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: () => ({
    RAG_EMBEDDING_PROVIDER: "voyage",
    RAG_TOP_K: 5,
    RAG_RETRIEVE_K: 15,
    RAG_RERANK_ENABLED: true,
  }),
}));

vi.mock("@/services/ragService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ragService")>();
  return {
    ...actual,
    queryRAGDetailed: vi.fn(),
    rewriteRAGQuery: vi.fn(),
  };
});

vi.mock("@/services/ragQuestionCorpus", () => ({
  fetchRAGQuestionCorpus: vi.fn(),
}));

import { queryRAGDetailed } from "@/services/ragService";
import { fetchRAGQuestionCorpus } from "@/services/ragQuestionCorpus";
import RAGLabTab from "./RAGLabTab";

describe("RAGLabTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRAGQuestionCorpus).mockResolvedValue({
      questions: [{
        id: "question-home",
        question: "Où habites-tu ?",
        occurrences: 8,
        variants: ["Où habites-tu ?", "Tu vis où ?"],
        characterNames: ["Max"],
        latestAt: "2026-07-21T10:00:00Z",
        pinned: true,
        sourceKeys: ["session-1:0"],
      }],
      sourceQuestionCount: 24,
      sessionCount: 5,
      updatedAt: "2026-07-21T10:00:00Z",
      pinnedStorageAvailable: true,
    });
    vi.mocked(queryRAGDetailed).mockResolvedValue({
      matches: [
        { id: "chunk-b", source_table: "characters", source_id: "page-b", character_id: "max-id", content: "Max habite à Lausanne.", similarity: 0.96, retrieval_similarity: 0.61, rerank_score: 0.96, retrieval_rank: 2 },
        { id: "chunk-a", source_table: "characters", source_id: "page-a", character_id: "max-id", content: "Max aime son appartement.", similarity: 0.72, retrieval_similarity: 0.81, rerank_score: 0.72, retrieval_rank: 1 },
      ],
      retrievalMatches: [
        { id: "chunk-a", source_table: "characters", source_id: "page-a", character_id: "max-id", content: "Max aime son appartement.", similarity: 0.81, retrieval_similarity: 0.81, retrieval_rank: 1 },
        { id: "chunk-b", source_table: "characters", source_id: "page-b", character_id: "max-id", content: "Max habite à Lausanne.", similarity: 0.61, retrieval_similarity: 0.61, retrieval_rank: 2 },
      ],
      latencyMs: 120,
      serverLatencyMs: 100,
      embeddingProvider: "voyage",
      rerankUsed: true,
      rerankModel: "rerank-2.5",
      searchInput: "Où habite Max ?",
      request: {
        userMessage: "Où habite Max ?",
        recentContext: "",
        rewrittenQuery: null,
        matchCount: 5,
        matchThreshold: 0.3,
        characterId: "max-id",
        provider: "voyage",
        rerankRequested: true,
        retrieveK: 15,
        rerankModel: "rerank-2.5",
        rerankTruncation: true,
      },
    });
  });

  it("montre le passage retrieval → reranking → injection pour le personnage sélectionné", async () => {
    render(<RAGLabTab />);

    expect(screen.getByText("Laboratoire RAG")).toBeInTheDocument();
    expect(await screen.findByText("Questions fréquentes des conversations")).toBeInTheDocument();
    expect(screen.getByText(/1 groupes issus de 24 questions/)).toBeInTheDocument();
    const runButton = screen.getByRole("button", { name: "Lancer l’expérience RAG" });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    expect(await screen.findByText("3. Mécanique observée")).toBeInTheDocument();
    expect(screen.getByText("2 candidat(s)")).toBeInTheDocument();
    expect(screen.getByText("Max habite à Lausanne.")).toBeInTheDocument();
    expect(screen.getAllByText("Injecté")).toHaveLength(2);
    expect(screen.getAllByText(/Max habite à Lausanne\./, { selector: "pre" })).toHaveLength(2);
    expect(queryRAGDetailed).toHaveBeenCalledWith(
      "Où habite Max ?",
      "",
      5,
      0.3,
      expect.objectContaining({ characterId: "max-id", provider: "voyage", rerank: true, retrieveK: 15, includeRetrievalMatches: true }),
    );
  });
});
