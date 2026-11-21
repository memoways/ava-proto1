import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generateSpeech: vi.fn(), open: vi.fn() }));
vi.mock("@/services/tts", () => ({ generateSpeech: mocks.generateSpeech }));
vi.mock("@/services/settingsService", () => ({ getTTSSettings: () => ({ outputFormat: "pcm_24000" }) }));
vi.mock("@/services/tts/providerSettings", () => ({ getActiveProviderId: () => "elevenlabs", resolveGradiumSettings: () => ({ outputFormat: "pcm_24000" }) }));
vi.mock("@/services/tts/textChunking", () => ({ chunkTextForTTS: (text: string) => text.split("|").map((l) => l.trim()).filter(Boolean) }));
vi.mock("@/services/tts/elevenLabsPcmStream", async (importActual) => ({
  ...(await importActual<typeof import("@/services/tts/elevenLabsPcmStream")>()),
  openElevenLabsPcmStream: mocks.open,
}));
import { createAvatarLineFeed, createAvatarAudioProgress, streamAvatarSpeechFromFeed } from "./avatarAudioBridge";

const pcmBytes = (samples: number) => {
  const bytes = new Uint8Array(samples * 2);
  new DataView(bytes.buffer).setInt16(0, 1, true);
  return bytes;
};
const blob = (samples: number) => ({ arrayBuffer: async () => new Int16Array(samples).fill(900).buffer }) as unknown as Blob;

function run(feed = createAvatarLineFeed(), extra: Partial<Parameters<typeof streamAvatarSpeechFromFeed>[0]> = {}) {
  const sent: Array<{ length: number; final: boolean }> = [];
  const progress = createAvatarAudioProgress();
  const controller = new AbortController();
  const promise = streamAvatarSpeechFromFeed({
    feed, sampleRate: 24_000, chunkMs: 250, signal: controller.signal, speechStartTimeoutMs: 3000,
    label: "Tavus", streamFirstLine: true, progress,
    sendChunk: (pcm, final) => { sent.push({ length: pcm.length, final }); return true; },
    ...extra,
  });
  return { feed, sent, progress, controller, promise };
}

describe("createAvatarLineFeed (lot T7)", () => {
  it("serves segments in order, waits for the producer and ends with null", async () => {
    const feed = createAvatarLineFeed();
    const second = feed.segmentAt(1);
    feed.push("A");
    feed.push("B");
    expect(await feed.segmentAt(0)).toBe("A");
    expect(await second).toBe("B");
    const third = feed.segmentAt(2);
    feed.end();
    expect(await third).toBeNull();
    expect(await feed.completed()).toBe("A B");
    expect(feed.pushed).toBe(2);
  });

  it("rejects readers and completed() after fail, and ignores later pushes", async () => {
    const feed = createAvatarLineFeed();
    feed.push("A");
    const waiting = feed.segmentAt(1);
    const boom = new Error("llm down");
    feed.fail(boom);
    await expect(waiting).rejects.toBe(boom);
    await expect(feed.completed()).rejects.toBe(boom);
    feed.push("late");
    expect(feed.pushed).toBe(1);
    expect(feed.failure()).toBe(boom);
  });
});

describe("streamAvatarSpeechFromFeed (lot T7)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.generateSpeech.mockImplementation(async () => blob(6000)); });

  it("starts speaking the first phrase before the producer ended, then closes the turn with an empty final chunk", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); yield pcmBytes(3000); })());
    const { feed, sent, promise } = run();
    feed.push("Premiere phrase");
    // The reply is not complete: audio is already out and nothing is final.
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.every((chunk) => !chunk.final)).toBe(true);
    feed.end();
    await promise;
    expect(sent).toEqual([{ length: 6000, final: false }, { length: 3000, final: false }, { length: 0, final: true }]);
    expect(mocks.generateSpeech).not.toHaveBeenCalled();
  });

  it("speaks later phrases through the blob path, in order, as they arrive", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); })());
    const { feed, sent, promise } = run();
    feed.push("Premiere");
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    feed.push("Deuxieme | Troisieme");
    feed.end();
    await promise;
    expect(mocks.generateSpeech.mock.calls.map(([text]) => text)).toEqual(["Deuxieme", "Troisieme"]);
    expect(sent.map((chunk) => chunk.final)).toEqual([false, false, false, true]);
  });

  it("uses the blob path for the first phrase when the stream is unavailable", async () => {
    mocks.open.mockResolvedValue(null);
    const { feed, sent, progress, promise } = run();
    feed.push("Phrase");
    feed.end();
    await promise;
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([{ length: 6000, final: false }, { length: 0, final: true }]);
    expect(progress.lines).toBe(1);
  });

  it("sends nothing when the producer ends without a phrase", async () => {
    const { feed, sent, promise } = run();
    feed.end();
    await promise;
    expect(sent).toEqual([]);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("throws when the producer fails after audio went out, without closing the turn", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); })());
    const { feed, sent, promise } = run();
    const caught = promise.catch((error: unknown) => error);
    feed.push("Premiere");
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const boom = new Error("llm stream broke");
    feed.fail(boom);
    expect(await caught).toBe(boom);
    expect(sent.some((chunk) => chunk.final)).toBe(false);
  });

  it("stops on barge-in while waiting for the next phrase", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); })());
    const { feed, sent, controller, promise } = run();
    const caught = promise.catch((error: unknown) => error);
    feed.push("Premiere");
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    controller.abort();
    expect(await caught).toMatchObject({ name: "AbortError" });
    expect(sent).toHaveLength(1);
  });
});
