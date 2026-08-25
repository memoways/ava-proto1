import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
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

describe("TTSConfigTab Gradium character selector", () => {
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

  it("lists Max and Emma in the Gradium panel", () => {
    render(<TTSConfigTab />);
    expect(screen.getByRole("button", { name: "Réglages Gradium Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réglages Gradium Emma" })).toBeInTheDocument();
  });

  it("tests Gradium with the selected character voice", async () => {
    render(<TTSConfigTab />);
    screen.getByRole("button", { name: "Réglages Gradium Emma" }).click();
    screen.getByRole("button", { name: /Tester REST/ }).click();
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
    render(<TTSConfigTab />);
    screen.getByRole("button", { name: "Colère" }).click();
    screen.getByRole("button", { name: /Tester REST/ }).click();
    await waitFor(() => expect(generateSpeech).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        performance: expect.objectContaining({ emotion: "angry", source: "manual" }),
      }),
    ));
  });
});
