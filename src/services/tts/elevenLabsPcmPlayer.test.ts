import { describe, expect, it, vi } from "vitest";
import { createElevenLabsPcmPlayback, type ElevenLabsPcmPlaybackDeps } from "./elevenLabsPcmPlayer";

const RATE = 1000; // 100 ms chunk = 100 samples = 200 bytes

/** Minimal AudioContext double: sources "end" when `advance()` moves the clock past them. */
class FakeSource {
  buffer: { duration: number; length: number } | null = null;
  onended: (() => void) | null = null;
  startAt = -1;
  stopped = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start(at: number) { this.startAt = at; }
  stop() { this.stopped = true; }
}
class FakeContext {
  currentTime = 0;
  state: AudioContextState = "running";
  destination = {};
  sources: FakeSource[] = [];
  resume = vi.fn(async () => {});
  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length);
    return { duration: length / rate, length, getChannelData: () => data };
  }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  advance(seconds: number) {
    this.currentTime += seconds;
    for (const s of this.sources) {
      if (!s.stopped && s.onended && s.buffer && s.startAt + s.buffer.duration <= this.currentTime) {
        const end = s.onended; s.onended = null; end();
      }
    }
  }
}

function pcmStream(parts: number[], opts: { failAfter?: number; hold?: Promise<void> } = {}): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (let i = 0; i < parts.length; i++) {
      if (opts.hold && i === 1) await opts.hold;
      if (opts.failAfter === i) throw new TypeError("network lost");
      yield new Uint8Array(parts[i]);
    }
  })();
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };

function setup(overrides: Partial<ElevenLabsPcmPlaybackDeps> = {}, ctx: Parameters<typeof createElevenLabsPcmPlayback>[0] = {}) {
  const audio = new FakeContext();
  const playBlob = vi.fn(async (_blob: Blob, _stall?: number, onStart?: (ms: number) => void) => {
    onStart?.(5);
    return { status: "played" as const, playbackTotalMs: 40 };
  });
  const generateBlob = vi.fn(async () => ({ blob: new Blob([new Uint8Array(8)], { type: "audio/mpeg" }), meta: { provider: "elevenlabs" as const, statusCode: 200 } }));
  const handle = createElevenLabsPcmPlayback(ctx, {
    model: "eleven_v4_turbo",
    openStream: async () => pcmStream([400, 400]),
    generateBlob,
    audioContext: () => audio as unknown as AudioContext,
    playBlob: playBlob as never,
    sampleRate: RATE,
    ...overrides,
  });
  return { audio, handle, playBlob, generateBlob };
}

describe("ElevenLabs PCM playback through Web Audio (latency lot 1)", () => {
  it("schedules the stream as it arrives, contiguously, and finishes after the last source", async () => {
    const milestones: string[] = [];
    const { audio, handle, generateBlob, playBlob } = setup({}, { onVoiceObservation: (name) => milestones.push(name) });
    handle.open();
    await flush();
    await handle.started;
    const stats = await handle.generationDone;
    expect(stats.transport).toBe("http_stream_pcm");
    expect(audio.sources).toHaveLength(4);
    for (let i = 1; i < audio.sources.length; i++) {
      expect(audio.sources[i].startAt).toBeCloseTo(audio.sources[i - 1].startAt + 0.1, 6);
    }
    expect(milestones).toContain("audio_scheduled");
    expect(generateBlob).not.toHaveBeenCalled();
    expect(playBlob).not.toHaveBeenCalled();
    let done = false;
    void handle.finished.then(() => { done = true; });
    audio.advance(0.2);
    await flush();
    expect(done).toBe(false);
    audio.advance(1);
    await flush();
    expect(done).toBe(true);
  });

  it("waits for open() before any sound (the queue keeps line order)", async () => {
    const { audio, handle } = setup();
    await handle.generationDone;
    expect(audio.sources).toHaveLength(0);
    handle.open();
    await handle.started;
    expect(audio.sources.length).toBeGreaterThan(0);
  });

  it("waits for the prebuffer before the first source of a slow stream", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const { audio, handle } = setup({ openStream: async () => pcmStream([100, 400], { hold }) });
    handle.open();
    await flush();
    expect(audio.sources).toHaveLength(0); // 50 ms received, below the 200 ms prebuffer
    release();
    await handle.started;
    expect(audio.sources.length).toBeGreaterThan(0);
  });

  it("falls back to one REST blob when the stream fails before the first byte", async () => {
    const { handle, generateBlob, playBlob, audio } = setup({ openStream: async () => { throw Object.assign(new Error("502"), { statusCode: 502 }); } });
    handle.open();
    await handle.started;
    await handle.finished;
    expect(await handle.generationDone).toMatchObject({ transport: "rest_fallback", fallbackReason: "pcm: Error: 502" });
    expect(generateBlob).toHaveBeenCalledTimes(1);
    expect(playBlob).toHaveBeenCalledTimes(1);
    expect(audio.sources).toHaveLength(0);
  });

  it("does not retry over REST on a client error that would fail the same way", async () => {
    const { handle, generateBlob } = setup({ openStream: async () => { throw Object.assign(new Error("401"), { statusCode: 401 }); } });
    handle.open();
    await expect(handle.finished).rejects.toThrow("401");
    expect(generateBlob).not.toHaveBeenCalled();
  });

  it("replays over REST when the stream breaks before anything was scheduled", async () => {
    const { handle, generateBlob, audio } = setup({ openStream: async () => pcmStream([100, 100], { failAfter: 1 }) });
    handle.open();
    await handle.finished;
    expect(generateBlob).toHaveBeenCalledTimes(1);
    expect(audio.sources).toHaveLength(0);
  });

  it("surfaces a cut once speech is scheduled, never replays it", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const { handle, generateBlob } = setup({ openStream: async () => pcmStream([400, 400, 400], { hold, failAfter: 2 }) });
    handle.open();
    await handle.started;
    release();
    await expect(handle.finished).rejects.toThrow("network lost");
    expect(generateBlob).not.toHaveBeenCalled();
  });

  it("cancel (barge-in) aborts the request and stops every scheduled source", async () => {
    let signal!: AbortSignal;
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const { handle, audio } = setup({ openStream: async (s) => { signal = s; return pcmStream([400, 400], { hold }); } });
    handle.open();
    await handle.started;
    handle.cancel("barge-in");
    release();
    expect(signal.aborted).toBe(true);
    expect(audio.sources.every((s) => s.stopped)).toBe(true);
    await expect(handle.finished).rejects.toBeDefined();
    await expect(handle.generationDone).rejects.toBeDefined();
  });

  it("follows the parent signal (TTSQueue.cancel)", async () => {
    const parent = new AbortController();
    const { handle, audio } = setup({}, { signal: parent.signal });
    handle.open();
    await handle.started;
    parent.abort("tts-queue-cancelled");
    expect(audio.sources.every((s) => s.stopped)).toBe(true);
    await expect(handle.finished).rejects.toBeDefined();
  });

  it("plays the received PCM as one WAV when the AudioContext stays suspended", async () => {
    const audio = new FakeContext();
    audio.state = "suspended";
    const { handle, playBlob, generateBlob } = setup({ audioContext: () => audio as unknown as AudioContext });
    handle.open();
    await handle.finished;
    expect(playBlob).toHaveBeenCalledTimes(1);
    expect((playBlob.mock.calls[0][0] as Blob).type).toBe("audio/wav");
    expect(generateBlob).not.toHaveBeenCalled();
    expect(audio.sources).toHaveLength(0);
  });

  it("replays over REST when the stream is empty", async () => {
    const { handle, generateBlob } = setup({ openStream: async () => pcmStream([]) });
    handle.open();
    await handle.finished;
    expect(generateBlob).toHaveBeenCalledTimes(1);
  });
});
