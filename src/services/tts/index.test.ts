import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  recordAudioLatency: vi.fn(),
}));

const provider = {
  id: "elevenlabs" as const,
  label: "ElevenLabs",
  description: "test",
  generate: mocks.generate,
};

vi.mock("@/services/tts/registry", () => ({
  getActiveProvider: () => provider,
  getProviderById: () => provider,
}));

vi.mock("@/services/latencyTelemetry", () => ({
  recordAudioLatency: mocks.recordAudioLatency,
}));

vi.mock("@/services/audioPlayback", () => ({
  playAudioBlobRobust: vi.fn(),
}));

import { generateSpeech } from "@/services/tts";
import { parseElevenLabsErrorDetails } from "@/services/tts/providers/elevenlabs";
import { resetOpeningTTSCache } from '../openingTTSCache';
import { setActiveEnvironment } from '../environmentContext';

describe("ElevenLabs transient TTS recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.clearAllMocks();
    resetOpeningTTSCache();
    setActiveEnvironment('prod');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("parses the nested system_busy response returned by proxy-tts", () => {
    const raw = JSON.stringify({
      error: "ElevenLabs error: 429",
      details: JSON.stringify({
        detail: { type: "rate_limit_error", code: "system_busy", status: "system_busy" },
      }),
    });

    expect(parseElevenLabsErrorDetails(raw)).toEqual({
      type: "rate_limit_error",
      code: "system_busy",
    });
  });

  it("retries system_busy once, without generating duplicate playback blobs", async () => {
    const busy = Object.assign(new Error("ElevenLabs TTS error: 429 (system_busy)"), {
      statusCode: 429,
      providerErrorType: "rate_limit_error",
      providerErrorCode: "system_busy",
    });
    const audio = new Blob(["audio"], { type: "audio/mpeg" });
    mocks.generate
      .mockRejectedValueOnce(busy)
      .mockResolvedValueOnce({
        blob: audio,
        meta: { provider: "elevenlabs", statusCode: 200, totalMs: 100 },
      });

    const generation = generateSpeech("Bonjour Max.");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(650);

    await expect(generation).resolves.toBe(audio);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.recordAudioLatency).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ retry_count: 1, error_type: "ok" }),
    }));
  });

  it("does not retry non-transient credit errors", async () => {
    const credits = Object.assign(new Error("insufficient_credits"), {
      statusCode: 402,
      providerErrorType: "payment_required",
      providerErrorCode: "insufficient_credits",
    });
    mocks.generate.mockRejectedValueOnce(credits);

    await expect(generateSpeech("Bonjour Max.")).rejects.toThrow("insufficient_credits");
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it('reuses an explicit opening with cache provenance and no new generation timing, isolated by environment/voice', async () => {
    mocks.generate.mockResolvedValue({ blob: new Blob(['audio']), meta: { provider: 'elevenlabs', model: 'eleven-v1' } });
    const observed = vi.fn();
    const opts = { cacheOpening: true, characterKey: 'max', voiceId: 'v1', onServiceObserved: observed };
    await generateSpeech('Allô.', opts);
    await generateSpeech('Allô.', opts);
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.recordAudioLatency).toHaveBeenCalledOnce();
    expect(observed).toHaveBeenLastCalledWith(expect.objectContaining({ transport: 'cache', effective_model: 'eleven-v1' }));
    setActiveEnvironment('sandbox-ulrich');
    await generateSpeech('Allô.', opts);
    await generateSpeech('Allô.', { ...opts, voiceId: 'v2' });
    await generateSpeech('Allô.', { ...opts, cacheOpening: false });
    expect(mocks.generate).toHaveBeenCalledTimes(4);
  });
});
