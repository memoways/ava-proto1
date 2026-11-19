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
import { createAvatarAudioProgress, streamAvatarSpeech } from "./avatarAudioBridge";

const pcmBytes = (samples: number) => {
  const bytes = new Uint8Array(samples * 2);
  new DataView(bytes.buffer).setInt16(0, 1, true);
  return bytes;
};
/** A stream whose reads are released one by one by the test. */
function controlledStream(reads: Uint8Array[], failAfter?: Error) {
  const gates: Array<() => void> = [];
  let delivered = 0;
  async function* gen() {
    for (const read of reads) {
      await new Promise<void>((resolve) => { gates.push(resolve); });
      delivered++;
      yield read;
    }
    if (failAfter) throw failAfter;
  }
  return {
    stream: gen(),
    release: async () => { await vi.waitFor(() => expect(gates.length).toBeGreaterThan(delivered)); gates[delivered]?.(); },
  };
}
const blob = (samples: number) => ({ arrayBuffer: async () => new Int16Array(samples).fill(900).buffer }) as unknown as Blob;

function run(text: string, extra: Partial<Parameters<typeof streamAvatarSpeech>[0]> = {}) {
  const sent: Array<{ length: number; final: boolean }> = [];
  const progress = createAvatarAudioProgress();
  const controller = new AbortController();
  const promise = streamAvatarSpeech({
    text, sampleRate: 24_000, chunkMs: 250, signal: controller.signal, speechStartTimeoutMs: 3000,
    label: "Tavus", streamFirstLine: true, progress,
    sendChunk: (pcm, final) => { sent.push({ length: pcm.length, final }); return true; },
    ...extra,
  });
  return { sent, progress, controller, promise };
}

describe("streamAvatarSpeech — first line streamed (lot T1)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.generateSpeech.mockImplementation(async () => blob(6000)); });

  it("sends the first chunk before the end of the body and marks the last one final", async () => {
    const { stream, release } = controlledStream([pcmBytes(6000), pcmBytes(6000), pcmBytes(3000)]);
    mocks.open.mockResolvedValue(stream);
    const { sent, promise } = run("Une seule ligne");
    await release(); await release();
    // Two full chunks read: the first is out, the second is held back to carry `final`.
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ length: 6000, final: false });
    await release();
    await promise;
    expect(sent).toEqual([{ length: 6000, final: false }, { length: 6000, final: false }, { length: 3000, final: true }]);
    expect(mocks.generateSpeech).not.toHaveBeenCalled();
  });

  it("cuts 250 ms chunks across odd read boundaries", async () => {
    const odd = pcmBytes(9000); // 18 000 bytes, read as 7 001 + rest
    mocks.open.mockResolvedValue((async function* () { yield odd.subarray(0, 7001); yield odd.subarray(7001); })());
    const { sent, promise } = run("Une ligne");
    await promise;
    expect(sent).toEqual([{ length: 6000, final: false }, { length: 3000, final: true }]);
  });

  it("streams line 0 then sends later lines from the blob path, final only on the very last chunk", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); yield pcmBytes(2000); })());
    const { sent, promise } = run("Premier | Second");
    await promise;
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(1);
    expect(mocks.generateSpeech.mock.calls[0][0]).toBe("Second");
    expect(sent.map((c) => c.final)).toEqual([false, false, true]);
    expect(sent.map((c) => c.length)).toEqual([6000, 2000, 6000]);
  });

  it("falls back to the blob path when the stream fails before any byte", async () => {
    mocks.open.mockRejectedValue(new Error("ElevenLabs TTS error: 500"));
    const { sent, promise } = run("Ligne");
    await promise;
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([{ length: 6000, final: true }]);
  });

  it("falls back when the stream is unavailable (no body)", async () => {
    mocks.open.mockResolvedValue(null);
    const { sent, promise } = run("Ligne");
    await promise;
    expect(sent).toEqual([{ length: 6000, final: true }]);
  });

  it("throws, without a blob retry, when the stream breaks after audio was sent", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); throw new Error("connection reset"); })());
    const { sent, progress, promise } = run("Premier | Second");
    await expect(promise).rejects.toThrow("connection reset");
    expect(progress.sentChunks).toBe(1);
    expect(sent).toEqual([{ length: 6000, final: false }]);
    // Only the next line was prefetched; line 0 is never re-synthesized.
    expect(mocks.generateSpeech.mock.calls.map(([text]) => text)).toEqual(["Second"]);
  });

  it("aborts mid-stream on barge-in and stops sending", async () => {
    const { stream, release } = controlledStream([pcmBytes(6000), pcmBytes(6000)]);
    mocks.open.mockResolvedValue(stream);
    const { sent, controller, promise } = run("Premier | Second");
    const caught = promise.catch((error: unknown) => error);
    await release();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    controller.abort();
    await release();
    expect(await caught).toMatchObject({ name: "AbortError" });
    expect(sent).toHaveLength(1);
  });

  it("does not stream other engines, other sample rates, the cached opening or when not requested", async () => {
    mocks.open.mockResolvedValue((async function* () { yield pcmBytes(6000); })());
    await run("Ligne", { sampleRate: 16_000 }).promise;
    await run("Ligne", { streamFirstLine: false }).promise;
    await run("Ligne", { context: { cacheOpening: true } }).promise;
    await run("Ligne", { context: { providerId: "gradium" } }).promise;
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.generateSpeech).toHaveBeenCalledTimes(4);
  });

  it("fails on the first-chunk deadline instead of waiting forever", async () => {
    vi.useFakeTimers();
    try {
      mocks.open.mockResolvedValue((async function* () { await new Promise(() => {}); yield pcmBytes(1); })());
      const { promise } = run("Ligne");
      const caught = promise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(8_001);
      expect(String(await caught)).toContain("Ava TTS did not answer for Tavus");
    } finally { vi.useRealTimers(); }
  });
});
