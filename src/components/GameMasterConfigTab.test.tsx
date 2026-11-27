import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/NewsletterSettingsPanel", () => ({ NewsletterSettingsPanel: () => null }));
vi.mock("@/services/experienceOrchestration", () => ({
  listCharacterRuntimeProfiles: vi.fn(async () => []),
  updateCharacterRuntimeActivation: vi.fn(),
}));
vi.mock("@/services/settingsService", async (original) => {
  const actual = await original<typeof import("@/services/settingsService")>();
  return { ...actual, loadGameplaySettingsFromDB: vi.fn(async () => actual.getGameplaySettings()) };
});

import GameMasterConfigTab from "./GameMasterConfigTab";

describe("GameMasterConfigTab — test settings apart from durable ones", () => {
  it("folds the hands-free test settings by default, with plain labels", async () => {
    render(<GameMasterConfigTab />);
    const fold = await screen.findByTestId("test-settings-hands-free");
    expect(fold.tagName).toBe("DETAILS");
    expect(fold).not.toHaveAttribute("open");
    expect(fold).toHaveTextContent("Réglages de test (temporaires)");
    expect(fold).toContainElement(screen.getByLabelText("Sortie vocale progressive"));
    expect(fold).toContainElement(screen.getByLabelText("Voix seule : réponse parlée en cours de génération"));
    expect(fold).toContainElement(screen.getByLabelText("Détection d'interruption", { exact: false }));
    expect(document.body.textContent).not.toMatch(/Lot \d|Canary|\(mesure\)/);
  });

  it("turns the player transcript into a behaviour note, not a setting", async () => {
    render(<GameMasterConfigTab />);
    expect(await screen.findByTestId("player-transcript-note")).toHaveTextContent("Ce comportement est fixe.");
    expect(screen.queryByText("Transcription du joueur")).toBeNull();
  });
});
