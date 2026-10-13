import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationScreen from "./ConversationScreen";
import { tagSpokenWith } from "@/services/characterConversation";

const baseProps = {
  audioState: "idle" as const,
  userSubtitle: "",
  maxSubtitle: "",
  sessionTimeRemaining: "12:00",
  onPTTPress: vi.fn(),
  onPTTRelease: vi.fn(),
  onHangUp: vi.fn(),
};

describe("ConversationScreen", () => {
  it.each([
    ["emma", "Max"],
    ["max", "Emma"],
  ] as const)("lets the player call the other character while %s is speaking without a GM offer", (activeCharacter, targetName) => {
    const onManualCall = vi.fn();
    render(<ConversationScreen {...baseProps} activeCharacter={activeCharacter}
      audioState="max_speaking" conversationLog={[]} onManualCall={onManualCall} />);

    const call = screen.getByRole("button", { name: `Appeler ${targetName}` });
    expect(call).toBeEnabled();
    fireEvent.click(call);
    expect(onManualCall).toHaveBeenCalledOnce();
  });

  it("waits for microphone startup to settle before a manual call", () => {
    const onManualCall = vi.fn();
    render(<ConversationScreen {...baseProps} activeCharacter="emma"
      audioState="mic_starting" conversationLog={[]} onManualCall={onManualCall} />);
    const call = screen.getByRole("button", { name: "Appeler Max" });
    expect(call).toBeDisabled();
    fireEvent.click(call);
    expect(onManualCall).not.toHaveBeenCalled();
  });

  it("shows a bidirectional GM offer and hides the other character's last line", () => {
    render(
      <ConversationScreen
        {...baseProps}
        activeCharacter="max"
        conversationLog={[
          tagSpokenWith({ role: "max", content: "Je t'écoute.", timestamp: 1 }, "max"),
          tagSpokenWith({ role: "user", content: "Salut Max", timestamp: 2 }, "max"),
          tagSpokenWith({ role: "emma", content: "Secret d'Emma", timestamp: 3 }, "emma"),
        ]}
        handoffOffer={{ reason: "Emma peut éclairer ce sujet.", targetCharacter: "emma" }}
      />,
    );

    expect(screen.getByText("Max vous propose de parler avec Emma.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appeler Emma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rester avec Max" })).toBeInTheDocument();
    expect(screen.getByText("Je t'écoute.")).toBeInTheDocument();
    expect(screen.queryByText("Secret d'Emma")).not.toBeInTheDocument();
  });

  it("labels a return offer toward Max while talking to Emma", () => {
    render(
      <ConversationScreen
        {...baseProps}
        activeCharacter="emma"
        conversationLog={[
          tagSpokenWith({ role: "emma", content: "Oui ?", timestamp: 1 }, "emma"),
        ]}
        handoffOffer={{ reason: "Max connaît cette partie.", targetCharacter: "max" }}
      />,
    );

    expect(screen.getByText("Emma vous propose de parler avec Max.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appeler Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rester avec Emma" })).toBeInTheDocument();
  });

  it("uses the portrait runtime of the active character", () => {
    render(
      <ConversationScreen
        {...baseProps}
        activeCharacter="emma"
        portraitUrl="https://portraits.example/emma-runtime.jpg"
        conversationLog={[]}
      />,
    );

    expect(screen.getByRole("img", { name: "Portrait d’Emma" }))
      .toHaveAttribute("src", "https://portraits.example/emma-runtime.jpg");
  });
});
