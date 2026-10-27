import { fireEvent, render, screen, within } from "@testing-library/react";
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

it.each([false, true])('locks microphone and choices during validation without hiding hangup (hands-free=%s)', handsFree => {
  const press = vi.fn(); const toggle = vi.fn(); const accept = vi.fn(); const reject = vi.fn();
  render(<ConversationScreen {...baseProps} activeCharacter="max" conversationLog={[]} handsFree={handsFree} handoffInputLocked
    handoffOffer={{ reason: 'Consentement prouvé', targetCharacter: 'emma' }}
    onPTTPress={press} onToggleHandsFree={toggle} onAcceptHandoff={accept} onRejectHandoff={reject} />);
  expect(screen.getByRole('button', { name: handsFree ? 'Activer le micro' : "Démarrer l'enregistrement" })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Appeler Emma' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Rester avec Max' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Terminer' })).toBeEnabled();
  fireEvent.keyDown(window, { code: 'Space' });
  expect(press).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
});


it('leaves Space on a focused call button to its native activation without opening the microphone', () => {
  const press = vi.fn();
  render(<ConversationScreen {...baseProps} activeCharacter="emma" conversationLog={[]}
    handoffOffer={{ reason: 'Accord prouvé', targetCharacter: 'max' }} onPTTPress={press} />);
  const call = screen.getByRole('button', { name: 'Appeler Max' });
  call.focus();
  fireEvent.keyDown(call, { code: 'Space', key: ' ' });
  expect(press).not.toHaveBeenCalled();
});


it.each([['emma', 'max', 'Max'], ['max', 'emma', 'Emma']] as const)(
  'keeps a plain call action below %s toward %s and removes it on revocation',
  (source, target, name) => {
    const props = { ...baseProps, activeCharacter: source, conversationLog: [],
      handoffOffer: { reason: 'Accord prouvé', targetCharacter: target },
      handoffPortraitUrl: `https://portraits.example/${target}-runtime.jpg` };
    const { rerender } = render(<ConversationScreen {...props} />);
    const header = screen.getByRole('banner');
    const call = within(header).getByRole('button', { name: `Appeler ${name}` });
    expect(screen.getAllByRole('button', { name: /^Appeler / })).toHaveLength(1);
    expect(within(call).queryByRole('img')).not.toBeInTheDocument();
    expect(call.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(within(header).getByRole('button', { name: /^Rester avec/ })).toBeInTheDocument();
    expect(screen.getByText(`${source === 'emma' ? 'Emma' : 'Max'} vous propose de parler avec ${name}.`))
      .toHaveAttribute('aria-live', 'polite');
    rerender(<ConversationScreen {...props} handoffOffer={null} />);
    expect(screen.queryByRole('button', { name: /^Appeler / })).not.toBeInTheDocument();
  });


it.each(['mic_starting', 'user_speaking', 'user_finalizing'] as const)(
  'blocks the offer while %s without removing it', audioState => {
    const accept = vi.fn();
    render(<ConversationScreen {...baseProps} audioState={audioState} activeCharacter="emma" conversationLog={[]}
      handoffOffer={{ reason: 'Accord prouvé', targetCharacter: 'max' }} onAcceptHandoff={accept} />);
    const call = screen.getByRole('button', { name: 'Appeler Max' });
    expect(call).toBeDisabled();
    fireEvent.click(call);
    expect(accept).not.toHaveBeenCalled();
  });
