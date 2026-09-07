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
      portraitUrl: characterKey === "emma" ? "https://portraits.example/emma-runtime.jpg" : "https://portraits.example/max-runtime.jpg",
      ttsProvider: null,
      ttsVoiceId: null,
    }));
  });

  it("offers Max and Emma even when the runtime checklist is incomplete", async () => {
    render(<CharacterSelectScreen onSelect={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Portrait d’Emma" })).toBeInTheDocument());
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
      portraitUrl: null,
      ttsProvider: null,
      ttsVoiceId: null,
    });
    render(<CharacterSelectScreen onSelect={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Emma indisponible" })).toBeInTheDocument());
  });

  it("starts with Emma when the player picks her", async () => {
    const onSelect = vi.fn();
    render(<CharacterSelectScreen onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Portrait d’Emma" })).toBeInTheDocument());
    screen.getByRole("button", { name: "Appeler Emma" }).click();
    expect(onSelect).toHaveBeenCalledWith("emma");
  });

  it("uses the runtime portrait configured for Emma", async () => {
    render(<CharacterSelectScreen onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("img", { name: "Portrait d’Emma" }))
      .toHaveAttribute("src", "https://portraits.example/emma-runtime.jpg"));
  });
});
