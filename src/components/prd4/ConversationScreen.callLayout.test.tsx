import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationScreen from "./ConversationScreen";

const baseProps = {
  layout: "call" as const,
  audioState: "idle" as const,
  userSubtitle: "",
  maxSubtitle: "",
  conversationLog: [],
  sessionTimeRemaining: "09:41",
  onPTTPress: vi.fn(),
  onPTTRelease: vi.fn(),
  onHangUp: vi.fn(),
  activeCharacter: "max" as const,
};

describe("ConversationScreen — smartphone call layout", () => {
  it("shows the round portrait, name, status and timer, with no avatar video even when requested", () => {
    const { container } = render(
      <ConversationScreen {...baseProps} portraitUrl="https://signed.example/max.jpg"
        streamingAvatarActive streamingAvatarState="connecting" attachAvatarMedia={vi.fn()} />,
    );
    expect(container.querySelector("[data-layout=call]")).not.toBeNull();
    const portrait = screen.getByTestId("call-portrait");
    expect(portrait).toHaveAttribute("src", "https://signed.example/max.jpg");
    expect(portrait.className).toContain("rounded-full");
    expect(screen.getByRole("heading", { name: "Max" })).toBeInTheDocument();
    expect(screen.getByTestId("call-status")).toHaveTextContent("en ligne");
    expect(screen.getByLabelText("Temps restant")).toHaveTextContent("09:41");
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.queryByText("Connexion vidéo…")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Flux vidéo en direct/)).not.toBeInTheDocument();
  });

  it("falls back to the bundled portrait and follows speaking and listening states", () => {
    const { rerender } = render(<ConversationScreen {...baseProps} activeCharacter="emma" audioState="max_speaking" />);
    expect(screen.getByTestId("call-portrait").getAttribute("src")).toMatch(/emma/);
    expect(screen.getByRole("heading", { name: "Emma" })).toBeInTheDocument();
    expect(screen.getByTestId("call-status")).toHaveTextContent("parle");
    rerender(<ConversationScreen {...baseProps} activeCharacter="emma" handsFree handsFreeListening onToggleHandsFree={vi.fn()} />);
    expect(screen.getByTestId("call-status")).toHaveTextContent("écoute");
  });

  it("keeps the same microphone handlers (push-to-talk and hands-free) and Terminer", () => {
    const onPTTPress = vi.fn();
    const onHangUp = vi.fn();
    const { rerender } = render(<ConversationScreen {...baseProps} onPTTPress={onPTTPress} onHangUp={onHangUp} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer l'enregistrement" }));
    expect(onPTTPress).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onHangUp).toHaveBeenCalledTimes(1);
    const onToggleHandsFree = vi.fn();
    rerender(<ConversationScreen {...baseProps} handsFree onToggleHandsFree={onToggleHandsFree} />);
    fireEvent.click(screen.getByRole("button", { name: "Activer le micro" }));
    expect(onToggleHandsFree).toHaveBeenCalledTimes(1);
  });

  it("reuses the handoff and cinematic capsules", () => {
    const onAcceptHandoff = vi.fn();
    const onRejectHandoff = vi.fn();
    const onIgnoreCinematic = vi.fn();
    render(<ConversationScreen {...baseProps} handoffOffer={{ reason: "Emma sait", targetCharacter: "emma" }}
      onAcceptHandoff={onAcceptHandoff} onRejectHandoff={onRejectHandoff}
      cinematicAnnounced onIgnoreCinematic={onIgnoreCinematic} />);
    fireEvent.click(screen.getByRole("button", { name: "Appeler Emma" }));
    fireEvent.click(screen.getByRole("button", { name: "Rester avec Max" }));
    expect(screen.getByTestId("cinematic-announced")).toHaveTextContent("Une vidéo arrive");
    fireEvent.click(screen.getByRole("button", { name: "Ignorer" }));
    expect(onAcceptHandoff).toHaveBeenCalledTimes(1);
    expect(onRejectHandoff).toHaveBeenCalledTimes(1);
    expect(onIgnoreCinematic).toHaveBeenCalledTimes(1);
  });

  it("leaves the default video layout unchanged", () => {
    const { container } = render(<ConversationScreen {...baseProps} layout={undefined}
      streamingAvatarActive streamingAvatarState="ready" attachAvatarMedia={vi.fn()} />);
    expect(container.querySelector("[data-layout=call]")).toBeNull();
    expect(container.querySelector("video")).not.toBeNull();
  });
});
