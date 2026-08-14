import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertPinnedQuestion = vi.fn(async () => ({ error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "rag_lab_pinned_questions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
          insert: insertPinnedQuestion,
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          })),
        };
      }
      return {};
    }),
  },
}));

import SessionsTab, { type SessionRow } from "./SessionsTab";

const session: SessionRow = {
  id: "session-1",
  started_at: "2026-07-21T10:00:00Z",
  ended_at: "2026-07-21T10:10:00Z",
  trust_level: 1,
  game_over_reason: null,
  duration_seconds: 600,
  branch: null,
  triggers_activated: [],
  conversation_log: [{ role: "user", content: "Où habites-tu ?" }, { role: "max", content: "À Lausanne." }],
  questionnaire_responses: null,
  name: "Session test",
  admin_note: null,
  personnage_appele: "Max",
};

describe("SessionsTab — envoi vers le laboratoire RAG", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permet d’épingler une question utilisateur depuis l’historique", async () => {
    render(
      <MemoryRouter>
        <SessionsTab
          sessions={[session]}
          selectedSessionId={null}
          onSelectSession={vi.fn()}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Session test"));

    const checkbox = await screen.findByRole("checkbox", { name: "Envoyer question dans le laboratoire RAG" });
    await waitFor(() => expect(checkbox).toBeEnabled());
    fireEvent.click(checkbox);

    await waitFor(() => expect(insertPinnedQuestion).toHaveBeenCalledWith({
      session_id: "session-1",
      message_index: 0,
      question: "Où habites-tu ?",
      character_name: "Max",
    }));
  });
});
