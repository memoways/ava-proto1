import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const legacy = {
  smartphone: { output: "voice", avatarProvider: null, ttsProvider: "elevenlabs", voiceIds: { max: "e-old", emma: "e-emma" } },
};

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/experienceSettings", () => ({ startExperienceSettingsLoad: vi.fn(async () => null) }));
vi.mock("@/services/experienceOrchestration", () => ({
  getCharacterRuntimeReadiness: vi.fn(async (character: string) => ({
    ttsProvider: character === "max" ? "gradium" : "elevenlabs",
    ttsVoiceId: character === "max" ? "g-max" : "e-emma",
  })),
}));
vi.mock("@/services/tts/characterVoices", async (original) => ({
  ...await original<typeof import("@/services/tts/characterVoices")>(),
  loadCharacterVoicesFromDB: vi.fn(async () => ({ max: { elevenlabs: "e-cat" }, emma: { elevenlabs: "e-emma" } })),
}));
vi.mock("@/services/tts/providerSettings", async (original) => ({
  ...await original<typeof import("@/services/tts/providerSettings")>(),
  loadActiveProviderFromDB: vi.fn(async () => "elevenlabs"),
  setActiveProvider: vi.fn(async () => undefined),
}));
vi.mock("@/services/stt/settings", async (original) => ({
  ...await original<typeof import("@/services/stt/settings")>(),
  loadSTTSettingsFromDB: vi.fn(async () => ({ activeProvider: "deepgram" })),
}));
vi.mock("@/services/deviceServices", async (original) => {
  const actual = await original<typeof import("@/services/deviceServices")>();
  return {
    ...actual,
    loadDeviceServicesRawFromDB: vi.fn(async () => ({ raw: legacy, value: actual.normalizeDeviceServices(legacy) })),
    saveDeviceServicesToDB: vi.fn(async (value: unknown) => actual.normalizeDeviceServices(value)),
  };
});

import { saveDeviceServicesToDB } from "@/services/deviceServices";
import DevicesTab from "./DevicesTab";

describe("Expérience › Appareils", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the former format without loss, flags the typed voice and saves the new format", async () => {
    render(<DevicesTab />);
    expect(await screen.findByTestId("device-services-legacy")).toBeInTheDocument();
    // Max keeps the typed ID (different from the catalogue): flagged; Emma's matches the catalogue: not flagged.
    expect(await screen.findByTestId("device-smartphone-legacy-max")).toHaveTextContent("e-old");
    expect(screen.queryByTestId("device-smartphone-legacy-emma")).toBeNull();
    expect(screen.getByTestId("device-smartphone-stt")).toHaveTextContent("Deepgram");
    await waitFor(() => expect(screen.getByTestId("effective-voice-smartphone-max")).toHaveTextContent("ancien ID appareil"));

    fireEvent.click(screen.getByRole("button", { name: "Utiliser le catalogue" }));
    await waitFor(() => expect(screen.getByTestId("effective-voice-smartphone-max")).toHaveTextContent("(catalogue)"));
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder" }));
    await waitFor(() => expect(saveDeviceServicesToDB).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveDeviceServicesToDB).mock.calls[0][0];
    expect(saved.smartphone.characters).toEqual({
      max: { ttsProvider: "elevenlabs", legacyVoiceId: "" },
      emma: { ttsProvider: "elevenlabs", legacyVoiceId: "" },
    });
    expect(saved.tablet.characters.max).toEqual({ ttsProvider: null, legacyVoiceId: "" });
    await waitFor(() => expect(screen.queryByTestId("device-services-legacy")).toBeNull());
  });
});
