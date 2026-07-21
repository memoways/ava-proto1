import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: [{ id: "session-1", name: "Diagnostic Max", started_at: "2026-07-21T10:00:00Z", ended_at: null }],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));
vi.mock("@/services/conversationTraceService", () => ({
  fetchConversationTurnTraces: vi.fn(),
}));

import { fetchConversationTurnTraces } from "@/services/conversationTraceService";
import PipelineTraceTab from "./PipelineTraceTab";

const LONG_PROMPT = `PROMPT EXACT ${"x".repeat(2_000)}`;

function traceRow() {
  return {
    id: "trace-1",
    session_id: "session-1",
    turn_id: "turn-1",
    turn_index: 1,
    schema_version: 1,
    character_name: "Max",
    status: "causal_complete",
    created_at: "2026-07-21T10:01:00Z",
    updated_at: "2026-07-21T10:01:00Z",
    trace: {
      schemaVersion: 1,
      identity: { sessionId: "session-1", turnId: "turn-1", turnIndex: 1, characterName: "Max", createdAt: "2026-07-21T10:01:00Z", status: "causal_complete" },
      input: { userMessage: "Où est Ava ?" },
      memory: { totalHistoryMessages: 0, selectedHistory: [], sessionSummary: null, summaryLastTurn: 0, userRoleSummary: null, userPostureRaw: null, postVideoContext: null, temporalContext: { timeElapsedSeconds: 1, sessionDurationSeconds: 930, turnIndex: 1 }, gmGuidance: null, gmTopicsCovered: [] },
      rag: { request: { userMessage: "Où est Ava ?", recentContext: "", rewrittenQuery: null, searchInput: "Où est Ava ?", matchCount: 5, retrieveK: 15, matchThreshold: 0.3, characterId: "max-id", provider: "voyage", rerankRequested: true }, matches: [], formattedContext: "", knowledgeContext: { allowedFacts: [], activeMemories: [], hypotheses: [], forbiddenTopics: [], blockedAssertions: [] }, embeddingProvider: "voyage", rerankUsed: true, error: null, serverLatencyMs: 8 },
      prompt: { baseSystemPrompt: "BASE", baseSource: { kind: "database", characterId: "max-id", canonicalName: "Max", updatedAt: null }, characterPrompt: { characterId: "max-id", canonicalName: "Max", updatedAt: null, renderedSections: "FICHE" }, technicalRules: "RULES", injectedSections: [], finalSystemPrompt: LONG_PROMPT },
      maxCall: { messages: [{ role: "system", content: LONG_PROMPT }], diagnostic: { clientPayload: {}, upstreamPayload: { model: "test" }, requestedModel: "test", returnedModel: "test", provider: null, generationId: "g1", usage: null, upstreamLatencyMs: 20, proxyLatencyMs: 25 }, requestedSettings: { model: "test", temperature: 0.2, maxTokens: 100, topP: 0.9, reasoning: false, timeoutMs: 8000 }, error: null },
      response: { rawLlmResponse: "Réponse brute", deliveredResponse: "Réponse brute", source: "llm" },
      gm: { causalGuidance: { guidance: null, topicsCovered: [], source: "none" }, preTurnPlanner: { status: "not_executed", reason: "disabled_in_prd4_live" }, validator: { status: "not_executed", reason: "disabled_in_prd4_live" }, labelPass: { status: "pending" }, postTurn: { status: "pending" } },
      timings: { summaryFetchMs: 1, ragMs: 8, promptBuildMs: 2, maxClientMs: 30, maxProxyMs: 25, maxUpstreamMs: 20, pipelineUninstrumentedMs: 2, coreTotalMs: 40, traceWriteMs: 3, observedTotalMs: 43 },
    },
  };
}

describe("PipelineTraceTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchConversationTurnTraces).mockResolvedValue([traceRow()] as never);
  });

  it("sélectionne le tour demandé et affiche les états causaux/non causaux", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=pipeline&session=session-1&turn=1"]}>
        <PipelineTraceTab />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Chronologie — tour 1")).toBeInTheDocument();
    expect(screen.getByText("GM labels (parallèle)")).toBeInTheDocument();
    expect(screen.getByText("GM post-tour (pour la suite)")).toBeInTheDocument();
    expect(screen.getAllByText("Réponse brute", { exact: false })).toHaveLength(2);
  });

  it("affiche sans troncature un prompt système long", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=pipeline&session=session-1&turn=1"]}>
        <PipelineTraceTab />
      </MemoryRouter>,
    );

    await screen.findByText("Chronologie — tour 1");
    fireEvent.click(screen.getByText("1. Prompt maître et prompt système final"));
    await waitFor(() => expect(screen.getByText(LONG_PROMPT)).toBeInTheDocument());
  });
});
