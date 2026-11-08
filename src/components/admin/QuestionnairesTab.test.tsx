import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationalDimensionKey, DimensionAnswer } from "@/types";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

import QuestionnairesTab from "./QuestionnairesTab";
import type { SessionRow } from "./SessionsTab";

const KEYS: ConversationalDimensionKey[] = ["fluidity", "interest", "immersion", "character_credibility", "emotional_engagement"];

function conversational(scores: Array<1 | 2 | 3 | 4 | 5 | null>, device: "smartphone" | "tablet" | "desktop", answer: string) {
  const dimensions = {} as Record<ConversationalDimensionKey, DimensionAnswer>;
  KEYS.forEach((key, i) => {
    dimensions[key] = { question: `Q ${key}`, answer, follow_up: null, score: scores[i], score_source: scores[i] === null ? null : "touch", score_comment: null };
  });
  return {
    version: "conversational-v1", submitted_at: "2026-11-08T12:00:00Z", dimensions,
    summary: { text: `Synthèse ${answer}`, edited_by_user: false, validated_at: "2026-11-08T12:00:00Z" },
    consent: { transcript_storage: true, opt_in_updates: false, opt_in_feedback: false },
    session_context: { device_class: device, call_mode: "tts", avatar_fallback: false },
  };
}

const row = (id: string, questionnaire: unknown) =>
  ({ id, name: id, started_at: "2026-11-08T11:00:00Z", trust_level: 2, questionnaire_responses: questionnaire }) as unknown as SessionRow;

describe("QuestionnairesTab", () => {
  const sessions = [
    row("phone", conversational([4, null, 3, 5, 2], "smartphone", "Sur le téléphone")),
    row("desk", conversational([2, null, null, 3, 4], "desktop", "Sur l'ordinateur")),
    row("legacy", { experience_rating: 8, experience_word: "Bluffant", nps: 9, immersion_story: 4, open_feedback: "Top" }),
  ];

  it("aggregates conversational scores apart from not-rated and filters by device", () => {
    render(<QuestionnairesTab sessions={sessions} onRefresh={vi.fn()} />);
    const panel = screen.getByRole("region", { name: "Questionnaire conversationnel" });
    expect(within(panel).getByTestId("aggregate-fluidity")).toHaveTextContent("3.0/5");
    expect(within(panel).getByTestId("aggregate-interest")).toHaveTextContent("—");
    expect(within(panel).getByTestId("aggregate-interest")).toHaveTextContent("2");
    expect(within(panel).getByTestId("radar-not-rated")).toHaveTextContent("Intérêt");

    fireEvent.click(within(panel).getByRole("button", { name: "Desktop" }));
    expect(within(panel).getByText("(1 réponse)")).toBeInTheDocument();
    expect(within(panel).getByTestId("aggregate-fluidity")).toHaveTextContent("2.0/5");
    expect(within(panel).queryByText("Sur le téléphone")).not.toBeInTheDocument();
    expect(within(panel).getAllByText("Sur l'ordinateur").length).toBeGreaterThan(0);

    fireEvent.click(within(panel).getByRole("button", { name: "Tablette" }));
    expect(within(panel).getByText("Aucune réponse conversationnelle pour ce filtre.")).toBeInTheDocument();
  });

  it("keeps the legacy row rendering unchanged", () => {
    render(<QuestionnairesTab sessions={sessions} onRefresh={vi.fn()} />);
    const legacy = screen.getByText("legacy").closest("tr")!;
    expect(within(legacy).getByText("8/10")).toBeInTheDocument();
    expect(within(legacy).getByText("Bluffant")).toBeInTheDocument();
    expect(within(legacy).getByText("9/10")).toBeInTheDocument();
    const phone = screen.getByText("phone").closest("tr")!;
    expect(within(phone).getByText("Conversationnel · Smartphone")).toBeInTheDocument();
    expect(within(phone).queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
