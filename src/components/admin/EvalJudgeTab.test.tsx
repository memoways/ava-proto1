import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/evalJudgeStore", () => ({
  loadEvalNotionDatabaseId: vi.fn(async () => ""),
  saveEvalNotionDatabaseId: vi.fn(),
  fetchEvalItems: vi.fn(async () => []),
  fetchEvalRuns: vi.fn(async () => []),
  fetchEvalResults: vi.fn(async () => []),
  syncEvalItemsFromNotion: vi.fn(),
  createEvalRun: vi.fn(),
  patchEvalRun: vi.fn(),
  insertEvalResult: vi.fn(),
}));

vi.mock("@/services/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/settingsService")>();
  return {
    ...actual,
    getLLMSettings: () => ({
      LLM_MODEL: "google/gemini-2.5-flash",
      LLM_TEMPERATURE: 0.8,
      LLM_TOP_P: 0.9,
      LLM_MAX_TOKENS: 220,
    }),
    getGameplaySettings: () => ({
      MAX_PROMPT_VARIANT: "legacy",
      RAG_TOP_K: 3,
      RAG_RETRIEVE_K: 8,
      RAG_RERANK_ENABLED: true,
      RAG_MATCH_THRESHOLD: 0.3,
      RAG_RERANK_MODEL: "rerank-2.5-lite",
      RAG_RERANK_TRUNCATION: true,
    }),
  };
});

import EvalJudgeTab from "./EvalJudgeTab";

describe("EvalJudgeTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Notion schema and OFAT launch controls", async () => {
    render(<EvalJudgeTab />);
    expect(await screen.findByRole("heading", { name: /LLM as judge/i })).toBeTruthy();
    expect(screen.getAllByText("Reponse visee").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Must include").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Lancer" })).toBeTruthy();
    expect(screen.getByText(/configs ×/)).toBeTruthy();
  });
});
