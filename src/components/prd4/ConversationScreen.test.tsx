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
  it("voice-only preserves user transcription and hides character dialogue while preserving status, microphone and explicit GM consent", () => {
    render(<ConversationScreen {...baseProps} voiceOnly handsFree handsFreeListening activeCharacter="max" audioState="max_speaking"
      userSubtitle="Parole du joueur" maxSubtitle="Parole du personnage" conversationLog={[tagSpokenWith({ role: "user", content: "Parole du joueur", timestamp: 1 }, "max")]}
      handoffOffer={{ reason: "Consentement validé", targetCharacter: "emma" }} />);
    expect(screen.getByText("« Parole du joueur »")).toBeInTheDocument();expect(screen.queryByText("Parole du personnage")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Max répond");
    expect(screen.getByRole("button", { name: "Couper le micro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appeler Emma" })).toBeInTheDocument();expect(screen.getByRole("button", { name: "Rester avec Max" })).toBeInTheDocument();
  });
  it.each(["emma", "max"] as const)("has no default call button while talking to %s", (activeCharacter) => {
    render(<ConversationScreen {...baseProps} activeCharacter={activeCharacter}
      audioState="max_speaking" conversationLog={[]} onAcceptHandoff={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Appeler / })).not.toBeInTheDocument();
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
    expect(screen.queryByText("Je t'écoute.")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret d'Emma")).not.toBeInTheDocument();
  });

  it("labels a return offer toward Max while talking to Emma", () => {
    const onAcceptHandoff = vi.fn();
    const onRejectHandoff = vi.fn();
    render(
      <ConversationScreen
        {...baseProps}
        activeCharacter="emma"
        conversationLog={[
          tagSpokenWith({ role: "emma", content: "Oui ?", timestamp: 1 }, "emma"),
        ]}
        handoffOffer={{ reason: "Max connaît cette partie.", targetCharacter: "max" }}
        onAcceptHandoff={onAcceptHandoff}
        onRejectHandoff={onRejectHandoff}
      />,
    );

    expect(screen.getByText("Emma vous propose de parler avec Max.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appeler Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rester avec Emma" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Appeler Max" }));
    expect(onAcceptHandoff).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Rester avec Emma" }));
    expect(onRejectHandoff).toHaveBeenCalledOnce();
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
