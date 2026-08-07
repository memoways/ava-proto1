import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationScreen from "./ConversationScreen";

const baseProps = {
  audioState: "idle" as const,
  userSubtitle: "",
  maxSubtitle: "Le texte exact envoyé au fournisseur.",
  conversationLog: [
    {
      role: "max" as const,
      content: "Le texte exact envoyé au fournisseur.",
      timestamp: 1,
    },
  ],
  sessionTimeRemaining: "04:00",
  onPTTPress: vi.fn(),
  onPTTRelease: vi.fn(),
  onHangUp: vi.fn(),
};

describe("ConversationScreen streaming avatar", () => {
  it("keeps the subtitle and controls over a receive-only video element", () => {
    const attachAvatarMedia = vi.fn();
    render(
      <ConversationScreen
        {...baseProps}
        streamingAvatarActive
        streamingAvatarState="ready"
        attachAvatarMedia={attachAvatarMedia}
      />,
    );

    const video = screen.getByLabelText("Flux vidéo en direct de Max");
    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("playsinline");
    fireEvent.loadedData(video);
    expect(video).toHaveClass("object-cover", "opacity-100");
    expect(attachAvatarMedia).toHaveBeenCalledWith(video);
    expect(screen.getByText("Le texte exact envoyé au fournisseur.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Terminer/i })).toBeInTheDocument();
  });

  it("keeps the Max poster visible and announces the TTS fallback", () => {
    render(
      <ConversationScreen
        {...baseProps}
        streamingAvatarActive
        streamingAvatarState="failed"
      />,
    );

    expect(screen.getByLabelText("Flux vidéo en direct de Max")).toHaveClass("opacity-0");
    expect(screen.getByText("Mode voix")).toBeInTheDocument();
  });

  it("asks for an explicit handoff choice and calls the selected action", () => {
    const onAcceptHandoff = vi.fn();
    const onRejectHandoff = vi.fn();
    render(
      <ConversationScreen
        {...baseProps}
        handoffOffer={{ reason: "Emma peut préciser ce point." }}
        onAcceptHandoff={onAcceptHandoff}
        onRejectHandoff={onRejectHandoff}
      />,
    );

    expect(screen.getByText("Max vous propose de parler avec Emma.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Appeler Emma" }));
    fireEvent.click(screen.getByRole("button", { name: "Rester avec Max" }));
    expect(onAcceptHandoff).toHaveBeenCalledOnce();
    expect(onRejectHandoff).toHaveBeenCalledOnce();
  });

  it("keeps the timer visible while calling Emma", () => {
    render(<ConversationScreen {...baseProps} handoffCalling />);

    expect(screen.getByText("Appel d’Emma…")).toBeInTheDocument();
    expect(screen.getByText(/04:00/)).toBeInTheDocument();
  });
});
