import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tts/providerSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/tts/providerSettings")>();
  return {
    ...actual,
    loadActiveProviderFromDB: vi.fn(async () => actual.getActiveProviderId()),
    loadInworldSettingsFromDB: vi.fn(async () => actual.getInworldSettings()),
    loadHumeSettingsFromDB: vi.fn(async () => actual.getHumeSettings()),
    loadGradiumSettingsFromDB: vi.fn(async () => actual.getGradiumSettings()),
    loadCartesiaSettingsFromDB: vi.fn(async () => actual.getCartesiaSettings()),
  };
});

vi.mock("@/services/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/settingsService")>();
  return {
    ...actual,
    loadTTSSettingsFromDB: vi.fn(async () => actual.getTTSSettings()),
  };
});

// Tooltip positioning is outside this test's scope and schedules asynchronous
// Popper updates that would otherwise obscure actionable test diagnostics.
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/services/experienceOrchestration", () => ({
  listCharacterRuntimeProfiles: vi.fn().mockResolvedValue([
    {
      id: "max-id",
      character_key: "max",
      display_name: "Max",
      enabled: true,
      notion_character_id: null,
      opening_line: null,
      portrait_url: null,
      tts_provider: "gradium",
      tts_voice_id: "voice-max",
      prompt_validated: false,
      rag_validated: false,
      qualitative_tests_validated: false,
      knowledge_isolation_validated: false,
      updated_at: "2026-08-25",
      environment_id: "prod",
    },
    {
      id: "emma-id",
      character_key: "emma",
      display_name: "Emma",
      enabled: true,
      notion_character_id: null,
      opening_line: null,
      portrait_url: null,
      tts_provider: "gradium",
      tts_voice_id: "voice-emma",
      prompt_validated: false,
      rag_validated: false,
      qualitative_tests_validated: false,
      knowledge_isolation_validated: false,
      updated_at: "2026-08-25",
      environment_id: "prod",
    },
  ]),
}));

vi.mock("@/services/tts", () => ({
  generateSpeech: vi.fn(),
  playAudioBlob: vi.fn(),
  tryCreateStreamingPlayback: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { generateSpeech, playAudioBlob } from "@/services/tts";
import TTSConfigTab from "./TTSConfigTab";

async function renderTTSConfigTab() {
  await act(async () => {
    render(<TTSConfigTab />);
  });
}

// The complete unit suite runs many jsdom files concurrently. These rendering
// assertions remain deterministic but can be CPU-starved beyond Vitest's 5 s
// default, while the panel is intentionally rendered as a real integration.
describe("TTSConfigTab Gradium character selector", { timeout: 15_000 }, () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    localStorage.clear();
    vi.mocked(generateSpeech).mockClear();
    vi.mocked(playAudioBlob).mockClear();
    vi.mocked(generateSpeech).mockResolvedValue(new Blob(["audio"]));
    vi.mocked(playAudioBlob).mockResolvedValue({ status: "played" } as never);
  });

  it("lists Max and Emma in the Gradium panel", async () => {
    await renderTTSConfigTab();
    expect(screen.getByRole("button", { name: "Réglages Gradium Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réglages Gradium Emma" })).toBeInTheDocument();
  });

  it("tests Gradium with the selected character voice", async () => {
    await renderTTSConfigTab();
    fireEvent.click(screen.getByRole("button", { name: "Réglages Gradium Emma" }));
    fireEvent.click(screen.getByRole("button", { name: /Tester REST/ }));
    await waitFor(() => expect(generateSpeech).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        providerId: "gradium",
        characterKey: "emma",
        performance: expect.objectContaining({ emotion: "tense", source: "manual" }),
      }),
    ));
  });

  it("sends the selected audition emotion on a provider test", async () => {
    await renderTTSConfigTab();
    fireEvent.click(screen.getByRole("button", { name: "Colère" }));
    fireEvent.click(screen.getByRole("button", { name: /Tester REST/ }));
    await waitFor(() => expect(generateSpeech).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        performance: expect.objectContaining({ emotion: "angry", source: "manual", intensity: 2 }),
      }),
    ));
  });

  it("does not play audio when an audition chip is clicked", async () => {
    await renderTTSConfigTab();
    fireEvent.click(screen.getByRole("button", { name: "Colère" }));
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("lists which providers can actually perform the acting intent", async () => {
    await renderTTSConfigTab();
    expect(screen.getByText("Où l'intention est réellement utilisée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Écouter Hume/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Écouter Inworld/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Oui — audible/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Volume \/ vitesse en FR/).length).toBeGreaterThanOrEqual(1);
  });

  it("warns when the in-game provider cannot perform acting audibly", async () => {
    await renderTTSConfigTab();
    expect(screen.getByText(/En jeu,.*l'intention y est/)).toBeInTheDocument();
  });

  it("plays Hume when Écouter Hume is clicked with the selected emotion", async () => {
    await renderTTSConfigTab();
    fireEvent.click(screen.getByRole("button", { name: "Colère" }));
    fireEvent.click(screen.getByRole("button", { name: /Écouter Hume/ }));
    await waitFor(() => expect(generateSpeech).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        providerId: "hume",
        performance: expect.objectContaining({ emotion: "angry", intensity: 2 }),
      }),
    ));
  });
});
