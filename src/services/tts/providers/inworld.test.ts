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
      new Response(new Blob(["audio"]), { status: 200 }),
    );
  });

  it("does not throw performance.now is not a function when acting intent is applied", async () => {
    const result = await inworldProvider.generate("Bonjour.", {
      performance: intentFromManualEmotion("angry", 2),
    });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(vi.mocked(authenticatedFunctionFetch)).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String(vi.mocked(authenticatedFunctionFetch).mock.calls[0][1]?.body),
    );
    expect(body.instruction).toMatch(/angry/);
    expect(body.deliveryMode).toBe("CREATIVE");
  });
});
