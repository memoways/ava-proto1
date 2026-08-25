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
      ready: characterKey === "max",
      openingLine: null,
      ttsProvider: null,
      ttsVoiceId: null,
    }));
  });

  it("keeps Emma locked until her runtime profile is ready", async () => {
    render(<CharacterSelectScreen onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Appeler Max" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Emma indisponible" })).toBeInTheDocument();
  });

  it("lets the player start with Emma when she is ready", async () => {
    const onSelect = vi.fn();
    vi.mocked(getCharacterRuntimeReadiness).mockImplementation(async (characterKey) => ({
      characterKey,
      displayName: characterKey === "emma" ? "Emma" : "Max",
      ready: true,
      openingLine: characterKey === "emma" ? "Allô ?" : "Oui ?",
      ttsProvider: "elevenlabs",
      ttsVoiceId: "voice",
    }));
    render(<CharacterSelectScreen onSelect={onSelect} />);
    const emma = await screen.findByRole("button", { name: "Appeler Emma" });
    emma.click();
    expect(onSelect).toHaveBeenCalledWith("emma");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Emma indisponible" })).not.toBeInTheDocument());
  });
});
