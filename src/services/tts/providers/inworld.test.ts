import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/gameAuth", () => ({
  authenticatedFunctionFetch: vi.fn(),
}));

vi.mock("@/services/debugLogger", () => ({
  debugLogger: {
    logFetch: vi.fn(() => "debug-id"),
    logResponse: vi.fn(),
  },
}));

vi.mock("@/services/tts/providerSettings", () => ({
  getInworldSettings: () => ({
    voiceId: "Alain",
    modelId: "inworld-tts-2",
    deliveryMode: "BALANCED",
    language: "AUTO",
    speakingRate: 1,
    temperature: 0.7,
  }),
}));

import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { intentFromManualEmotion } from "@/services/tts/performanceIntent";
import { inworldProvider } from "./inworld";

describe("inworldProvider.generate", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue(
      new Response("audio", { status: 200, headers: { "Content-Type": "audio/wav" } }),
    );
  });

  it("does not throw performance.now is not a function when acting intent is applied", async () => {
    const result = await inworldProvider.generate("Bonjour.", {
      performance: intentFromManualEmotion("angry", 2),
    });
    // Fetch Response uses Node's Blob realm on CI; verify the audio contract and payload size.
    expect(result.blob.size).toBe(5);
    expect(result.blob.type).toBe("audio/wav");
    expect(vi.mocked(authenticatedFunctionFetch)).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String(vi.mocked(authenticatedFunctionFetch).mock.calls[0][1]?.body),
    );
    expect(body.instruction).toMatch(/angry/);
    expect(body.deliveryMode).toBe("CREATIVE");
  });
});
