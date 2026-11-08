import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationalSessionContext, QuestionnaireConversationalData } from "@/types";
import { baseDimensionQuestions } from "@/services/conversationalQuestionnaire";

const stt = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/services/stt", () => ({ createConfiguredSTT: stt.create }));

import ConversationalQuestionnaire from "./ConversationalQuestionnaire";

const context = {
  session_id: "s1", film: "vu", teaser: { seen: true, skipped: false }, starting_character: "max",
  characters_called: ["max"], handoffs: [], cinematics: [], duration_seconds: 200, turn_count: 4,
  avg_latency_ms: 1800, max_latency_ms: 3000, mic_errors: 0, hands_free: false, end_reason: "timer",
  device_class: "desktop", call_mode: "tts", avatar_fallback: false, role_profile: null, posture: null,
  transcript_available: true,
} satisfies ConversationalSessionContext;

const questions = baseDimensionQuestions(context);

function answer(text: string) {
  fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Valider ma réponse" }));
}

describe("ConversationalQuestionnaire", () => {
  it("runs five dimensions by keyboard, skips a failed follow-up and saves a provisional payload", async () => {
    const requestFollowUp = vi.fn().mockRejectedValue(new Error("proxy-llm down"));
    const onSave = vi.fn<(data: QuestionnaireConversationalData) => void>();
    render(<ConversationalQuestionnaire questions={questions} sessionContext={context} requestFollowUp={requestFollowUp} onSave={onSave} />);

    const scores = ["4", null, "3", "5", "2"];
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByText(`${i + 1}/5`)).toBeInTheDocument();
      answer(`Réponse ${i + 1}`);
      // No automatic advance: the score must be chosen and confirmed.
      const next = await screen.findByRole("button", { name: i === 4 ? "Terminer" : "Question suivante" });
      expect(next).toBeDisabled();
      if (scores[i]) fireEvent.click(screen.getByRole("button", { name: `Note ${scores[i]} sur 5` }));
      else fireEvent.click(screen.getByRole("button", { name: "Je préfère ne pas noter" }));
      fireEvent.click(next);
    }
    expect(requestFollowUp).toHaveBeenCalledTimes(5);

    const save = screen.getByRole("button", { name: "Enregistrer mes réponses" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(save);
    const data = onSave.mock.calls[0][0];
    expect(data.dimensions.fluidity).toMatchObject({ answer: "Réponse 1", follow_up: null, score: 4, score_source: "touch" });
    expect(data.dimensions.interest).toMatchObject({ score: null, score_source: null });
    expect(data.summary.edited_by_user).toBe(false);
    expect(stt.create).not.toHaveBeenCalled();
  });

  it("shows a single follow-up and a spoken score that needs confirmation", async () => {
    const requestFollowUp = vi.fn().mockResolvedValue("Qu'est-ce qui accrochait ?");
    render(<ConversationalQuestionnaire questions={questions} sessionContext={context} requestFollowUp={requestFollowUp} onSave={vi.fn()} />);
    answer("Bof, je dirais 2.");
    expect(await screen.findByText("Qu'est-ce qui accrochait ?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ta précision"), { target: { value: "Les silences." } });
    fireEvent.click(screen.getByRole("button", { name: "Valider ma précision" }));
    expect(screen.getByText("Tu as parlé de 2/5. Tu confirmes cette note ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question suivante" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer 2/5" }));
    fireEvent.click(screen.getByRole("button", { name: "Question suivante" }));
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(requestFollowUp).toHaveBeenCalledTimes(1);
  });

  it("dictates through the STT facade, shows words live and keeps them editable", async () => {
    let emit: (text: string, final: boolean) => void = () => {};
    const session = {
      isActive: true,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setManualMode: vi.fn(),
      flush: vi.fn(async () => { emit("Ça a bien marché", true); }),
    };
    stt.create.mockImplementation(async (cb: typeof emit) => { emit = cb; return session; });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
    render(<ConversationalQuestionnaire questions={questions} sessionContext={context} requestFollowUp={vi.fn().mockResolvedValue(null)} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Répondre à la voix" }));
    await screen.findByRole("button", { name: "J'ai fini de parler" });
    act(() => emit("Ça a bien", false));
    expect(screen.getByLabelText("Ta réponse")).toHaveValue("Ça a bien");
    expect(screen.getByRole("button", { name: "Valider ma réponse" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "J'ai fini de parler" }));
    await waitFor(() => expect(screen.getByLabelText("Ta réponse")).toHaveValue("Ça a bien marché"));
    expect(session.setManualMode).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByLabelText("Ta réponse"), { target: { value: "Ça a très bien marché" } });
    expect(screen.getByRole("button", { name: "Valider ma réponse" })).toBeEnabled();
  });
});
