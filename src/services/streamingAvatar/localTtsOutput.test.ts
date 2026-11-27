import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), drain: vi.fn(), chunk: vi.fn((_text: string, _options?: unknown) => ["Bonjour"]), cancel: vi.fn() }));
vi.mock("@/services/tts/queue", () => ({ TTSQueue: class { enqueue = mocks.enqueue; drain = mocks.drain; cancel = mocks.cancel; } }));
vi.mock("@/services/tts/textChunking", () => ({ chunkTextForTTS: mocks.chunk }));
vi.mock("@/services/tts/providerSettings", () => ({ getActiveProviderId: () => "elevenlabs" }));
const gameplay = vi.hoisted(() => ({ VOICE_STREAMED_LLM: false as boolean }));
vi.mock("@/services/settingsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/settingsService")>()),
  getGameplaySettings: () => ({ VOICE_STREAMED_LLM: gameplay.VOICE_STREAMED_LLM }),
}));
import { LocalTTSOutput } from "./localTtsOutput";
import { createAvatarLineFeed } from "./avatarAudioBridge";
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

describe("voice-only streamed reply (latency lot 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gameplay.VOICE_STREAMED_LLM = false;
    mocks.chunk.mockImplementation((text: string) => [text]);
    mocks.drain.mockResolvedValue({ status: "played", playedSegments: 2, generatedSegments: 2 });
  });

  it("streams only when the switch is on, read at each call", () => {
    const output = new LocalTTSOutput();
    expect(output.canStreamText()).toBe(false);
    gameplay.VOICE_STREAMED_LLM = true;
    expect(output.canStreamText()).toBe(true);
  });

  it("enqueues each segment as soon as it arrives, in order, then drains once the feed ended", async () => {
    const feed = createAvatarLineFeed();
    const render = new LocalTTSOutput().renderTextStream(feed, { turnId: "t1", voiceId: "v1" });
    feed.push("Première phrase.");
    await vi.waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    expect(mocks.enqueue).toHaveBeenLastCalledWith("Première phrase.", expect.objectContaining({ providerId: "elevenlabs", turn_id: "t1", voiceId: "v1" }));
    expect(mocks.drain).not.toHaveBeenCalled();
    feed.push("Deuxième phrase.");
    feed.end();
    await expect(render).resolves.toMatchObject({ status: "played", started: true });
    expect(mocks.enqueue.mock.calls.map(([text]) => text)).toEqual(["Première phrase.", "Deuxième phrase."]);
    expect(mocks.drain).toHaveBeenCalledOnce();
  });

  it("cancels what was not played and rethrows when the generation fails", async () => {
    const feed = createAvatarLineFeed();
    const render = new LocalTTSOutput().renderTextStream(feed);
    feed.push("Début.");
    feed.fail(new Error("llm stream failed"));
    await expect(render).rejects.toThrow("llm stream failed");
    expect(mocks.cancel).toHaveBeenCalled();
  });

  it("stops reading the feed and cancels the queue on interruption", async () => {
    mocks.drain.mockResolvedValue({ status: "cancelled", playedSegments: 1, generatedSegments: 1 });
    const feed = createAvatarLineFeed();
    const controller = new AbortController();
    const output = new LocalTTSOutput();
    const render = output.renderTextStream(feed, { signal: controller.signal });
    feed.push("Une phrase.");
    await vi.waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    controller.abort("player-barge-in");
    await expect(render).resolves.toMatchObject({ status: "cancelled" });
    feed.push("Jamais dite.");
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).toHaveBeenCalled();
  });
});
