import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CharacterSelectScreen from "./CharacterSelectScreen";

vi.mock("@/services/experienceOrchestration", () => ({
  getCharacterRuntimeReadiness: vi.fn(),
}));

import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";

describe("CharacterSelectScreen", () => {
  beforeEach(() => {
    vi.mocked(getCharacterRuntimeReadiness).mockImplementation(async (characterKey) => ({
      characterKey,
      displayName: characterKey === "emma" ? "Emma" : "Max",
      enabled: true,
      ready: false,
      openingLine: null,
      ttsProvider: null,
      ttsVoiceId: null,
    }));
  });

  it("offers Max and Emma even when the runtime checklist is incomplete", () => {
    render(<CharacterSelectScreen onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Appeler Max" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Appeler Emma" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ava indisponible" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Léo indisponible" })).toBeInTheDocument();
  });

  it("hides Emma only when Orchestration has disabled her", async () => {
    vi.mocked(getCharacterRuntimeReadiness).mockResolvedValue({
      characterKey: "emma",
      displayName: "Emma",
      enabled: false,
      ready: false,
      openingLine: null,
      ttsProvider: null,
      ttsVoiceId: null,
    });
    render(<CharacterSelectScreen onSelect={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Emma indisponible" })).toBeInTheDocument());
  });

  it("starts with Emma when the player picks her", () => {
    const onSelect = vi.fn();
    render(<CharacterSelectScreen onSelect={onSelect} />);
    screen.getByRole("button", { name: "Appeler Emma" }).click();
    expect(onSelect).toHaveBeenCalledWith("emma");
  });
});
