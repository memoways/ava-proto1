import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationScreen from "./ConversationScreen";

// Screen plan, lot 3: the tablet keeps the video screen; `touchFirst` only
// enlarges touch targets, says « touche » and uses 100svh.
const props = {
  audioState: "idle" as const,
  userSubtitle: "",
  maxSubtitle: "",
  conversationLog: [],
  sessionTimeRemaining: "12:00",
  onPTTPress: vi.fn(),
  onPTTRelease: vi.fn(),
  onHangUp: vi.fn(),
  activeCharacter: "max" as const,
  streamingAvatarActive: true,
  streamingAvatarState: "connecting" as const,
  attachAvatarMedia: vi.fn(),
  handoffOffer: { reason: "test", targetCharacter: "emma" as const },
  onAcceptHandoff: vi.fn(),
  onRejectHandoff: vi.fn(),
  cinematicAnnounced: true,
  onIgnoreCinematic: vi.fn(),
};

const summary = (container: HTMLElement) => ({
  buttons: [...container.querySelectorAll("button")].map(b => b.getAttribute("aria-label") ?? b.textContent?.trim()),
  videos: container.querySelectorAll("video").length,
  canvases: container.querySelectorAll("canvas").length,
  capsules: [...container.querySelectorAll("[data-character-capsule]")].map(c => c.getAttribute("data-character-capsule")),
});

describe("ConversationScreen — touch-first video screen (tablet)", () => {
  it("keeps the same video screen, avatar and capsules as desktop", () => {
    const desktop = render(<ConversationScreen {...props} />);
    const desktopSummary = summary(desktop.container);
    desktop.unmount();
    const tablet = render(<ConversationScreen {...props} touchFirst />);
    expect(summary(tablet.container)).toEqual(desktopSummary);
    expect(desktopSummary.videos).toBe(1);
    expect(tablet.container.querySelector("[data-layout=call]")).toBeNull();
  });

  it("desktop render is unchanged: min-h-screen, « Clique », compact Terminer and Ignorer", () => {
    const { container } = render(<ConversationScreen {...props} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    expect(root.hasAttribute("data-touch-first")).toBe(false);
    expect(screen.getByText("Clique pour parler")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer" }).className).not.toContain("min-h-11");
    expect(screen.getByRole("button", { name: "Ignorer" }).className).not.toContain("min-h-11");
    expect(screen.getByLabelText("Temps restant").parentElement!.className).not.toContain("flex-col");
  });

  it("tablet: 100svh, « Touche », 44 px Terminer and Ignorer", () => {
    const { container } = render(<ConversationScreen {...props} touchFirst />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-[100svh]");
    expect(root.className).not.toContain("min-h-screen");
    expect(root.getAttribute("data-touch-first")).toBe("true");
    expect(screen.getByText("Touche pour parler")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "Ignorer" }).className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "Rester avec Max" }).className).toContain("min-h-11");
    // Terminer on top, timer below; desktop keeps them side by side.
    expect(screen.getByLabelText("Temps restant").parentElement!.className).toContain("flex-col-reverse");
  });
});
