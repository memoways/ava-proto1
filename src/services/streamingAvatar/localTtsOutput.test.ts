import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), drain: vi.fn(), chunk: vi.fn(() => ["Bonjour"]), cancel: vi.fn() }));
vi.mock("@/services/tts/queue", () => ({ TTSQueue: class { enqueue = mocks.enqueue; drain = mocks.drain; cancel = mocks.cancel; } }));
vi.mock("@/services/tts/textChunking", () => ({ chunkTextForTTS: mocks.chunk }));
vi.mock("@/services/tts/providerSettings", () => ({ getActiveProviderId: () => "elevenlabs" }));
import { LocalTTSOutput } from "./localTtsOutput";
describe("executed TTS attribution", () => {
  beforeEach(() => vi.clearAllMocks());
  it('passes explicit opening eligibility to the real queue boundary', async () => {
    mocks.drain.mockResolvedValue({ status: 'played', playedSegments: 1, generatedSegments: 1 });
    await new LocalTTSOutput().renderText('Bonjour', { cacheOpening: true });
    expect(mocks.enqueue).toHaveBeenCalledWith('Bonjour', expect.objectContaining({ cacheOpening: true }));
  });
  it('cancels an already aborted greeting before it can enqueue generation', async () => {
    const controller = new AbortController(); controller.abort();
    mocks.drain.mockResolvedValue({ status: 'cancelled', playedSegments: 0, generatedSegments: 0 });
    await new LocalTTSOutput().renderText('Bonjour', { signal: controller.signal });
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });
  it("uses the character-resolved provider for chunking and returns observed transport/model", async () => {
    mocks.drain.mockResolvedValue({ status: "played", playedSegments: 1, generatedSegments: 1, services: [{ service: "tts", effective_provider: "gradium", effective_model: "gradium-tts", transport: "rest_fallback" }] });
    const output = await new LocalTTSOutput().renderText("Bonjour", { providerId: "gradium", characterKey: "emma", attemptId: "a1" });
    expect(mocks.chunk).toHaveBeenCalledWith("Bonjour", { maxSingleChars: 320, targetChars: 320 });
    expect(mocks.enqueue).toHaveBeenCalledWith("Bonjour", expect.objectContaining({ providerId: "gradium", attempt_id: "a1", characterKey: "emma" }));
    expect(output.provider).toBe("gradium");
    expect(output.model).toBe("gradium-tts");
    expect(output.services?.[0].transport).toBe("rest_fallback");
  });
  it("does not claim configured global provider if generation never ran", async () => {
    mocks.drain.mockResolvedValue({ status: "failed", playedSegments: 0, generatedSegments: 0 });
    const output = await new LocalTTSOutput().renderText("Bonjour");
    expect(output.provider).toBe("unknown");
    expect(output.model).toBeUndefined();
  });
});
