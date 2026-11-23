import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionRow } from "./SessionsTab";

const traceRow = {
  turn_index: 1,
  character_name: "Max",
  matches: [{
    source_id: "src-camp",
    content: "Mona a été envoyée au camp par son père, et Max l'a su trop tard.",
    similarity: 0.71,
    rerank_score: 0.91,
  }],
  settings: { model: "anthropic/claude-test", temperature: 0.4, maxTokens: 800 },
};

function query(data: unknown) {
  const result = Promise.resolve({ data, error: null });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => result),
    then: result.then.bind(result),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "conversation_turn_traces") return query([traceRow]);
      if (table === "audio_latencies") {
        return query([{ turn_index: 1, metadata_json: { performance_emotion: "tense", performance_speech_state: "à vif", model: "eleven_v3" } }]);
      }
      if (table === "voice_turn_events") {
        return query([{ turn_index: 1, character: "max", cue: { provider: "tavus", cue: "concerned", sent: true, origin: "intent", emotion: "tense", intensity: 1, source: "speech_state", speech_state: "à vif", tempered: false } }]);
      }
      if (table === "rag_lab_pinned_questions") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })),
          insert: vi.fn(async () => ({ error: null })),
          delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
        };
      }
      return query([]);
    }),
  },
}));

import SessionsTab from "./SessionsTab";

function session(traced: boolean): SessionRow {
  return {
    id: traced ? "session-traced" : "session-plain",
    started_at: "2026-11-23T10:00:00Z",
    ended_at: "2026-11-23T10:10:00Z",
    trust_level: 1,
    game_over_reason: null,
    duration_seconds: 600,
    branch: null,
    triggers_activated: [],
    conversation_log: [
      { role: "user", content: "Où est Mona ?", labels: { themes: ["famille"], topics: ["Mona"], intentions: [] } },
      { role: "max", content: "Au camp.", pipeline: { rag_ms: 120, max_ms: 800, total_ms: 1000 } },
    ],
    questionnaire_responses: null,
    name: traced ? "Session tracée" : "Session normale",
    admin_note: null,
    personnage_appele: "Max",
    diagnostic_trace_enabled: traced,
    environment_id: "sandbox-ulrich",
    context_type: "sandbox",
    campaign_id: null,
    tester_label: null,
    test_invitation_id: null,
    started_by_user_id: null,
    gm_post_turn_log: [{
      turn_index: 1,
      character_key: "max",
      injected: { text: "Réponds court.", speechState: "à vif", topicsCovered: [] },
    }],
  };
}

function open(row: SessionRow) {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessionsTab sessions={[row]} selectedSessionId={null} onSelectSession={vi.fn()} onRefresh={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText(row.name!));
}

describe("SessionsTab — lecture d'une session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("met la liste, la conversation et les détails dans trois régions, avec le numéro de tour", async () => {
    open(session(false));
    expect(screen.getByTestId("sessions-layout").className).toContain("22rem");
    expect(screen.getByTestId("session-list")).toBeInTheDocument();
    const conversation = screen.getByTestId("session-conversation");
    const details = screen.getByTestId("session-details");
    expect(conversation).toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(within(conversation).getByText("Tour 1")).toBeInTheDocument();
    expect(within(conversation).getByText(/Au camp\./)).toBeInTheDocument();
    expect(within(conversation).getByTestId("turn-labels")).toHaveTextContent("Thèmes : famille · Mots-clés : Mona");
    expect(await within(conversation).findByText("Chunks et paramètres du modèle non enregistrés pour cette session")).toBeInTheDocument();
    expect(within(conversation).queryByTestId("turn-chunk")).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/src-camp/)).not.toBeInTheDocument();
    expect(await within(conversation).findByRole("checkbox", { name: "Épingler pour le laboratoire RAG" })).toBeInTheDocument();
    expect(within(details).getByText("Non enregistrée")).toBeInTheDocument();
  });

  it("montre les chunks et le modèle seulement quand la session est tracée", async () => {
    open(session(true));
    const conversation = screen.getByTestId("session-conversation");
    expect(within(conversation).getByText("Tour 1")).toBeInTheDocument();
    const chunk = await within(conversation).findByTestId("turn-chunk");
    expect(chunk).toHaveTextContent("src-camp");
    expect(chunk).toHaveTextContent("rerang 0.91");
    expect(chunk).toHaveTextContent("Mona a été envoyée au camp");
    expect(within(conversation).getByTestId("turn-model")).toHaveTextContent("Modèle demandé : anthropic/claude-test · température 0.4");
    expect(within(conversation).queryByText("Chunks et paramètres du modèle non enregistrés pour cette session")).not.toBeInTheDocument();
    expect(within(conversation).getByRole("link", { name: "Analyser ce tour" })).toBeInTheDocument();
    expect(await within(conversation).findByRole("checkbox", { name: "Épingler pour le laboratoire RAG" })).toBeInTheDocument();
    expect(within(conversation).getByText(/État de parole : à vif/)).toBeInTheDocument();
    expect(within(conversation).getByText(/Émotion de jeu : tense/)).toBeInTheDocument();
    expect(within(conversation).getByText(/Visage : concerned · tense/)).toBeInTheDocument();
    expect(within(conversation).getByTestId("turn-pipeline")).toHaveTextContent("RAG 120 ms · modèle 800 ms · total 1000 ms");
  });

  it("signale un tour joueur dont la réponse n'est pas dans le journal", async () => {
    const row = session(false);
    open({ ...row, conversation_log: [{ role: "user", content: "Tu es là ?" }] });
    const conversation = screen.getByTestId("session-conversation");
    expect(await within(conversation).findByTestId("missing-character-reply")).toHaveTextContent("Réponse du personnage non enregistrée pour ce tour.");
    expect(within(conversation).getByText(/Aucun thème ni mot-clé enregistré/)).toBeInTheDocument();
  });
});
