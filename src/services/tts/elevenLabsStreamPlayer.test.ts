import { describe, expect, it, vi } from "vitest";
import { createElevenLabsStreamingPlayback, type ElevenLabsStreamDeps } from "./elevenLabsStreamPlayer";

/** Minimal MediaSource / SourceBuffer / <audio> doubles: appends complete on a microtask. */
class FakeSourceBuffer extends EventTarget {
  updating = false;
  appended: number[] = [];
  failOnAppend = false;
  appendBuffer(data: Uint8Array) {
    if (this.failOnAppend) throw new DOMException("bad mp3", "NotSupportedError");
    this.updating = true;
    this.appended.push(data.byteLength);
    queueMicrotask(() => { this.updating = false; this.dispatchEvent(new Event("updateend")); });
  }
}
let lastBuffer: FakeSourceBuffer | null = null;
let failNextAppend = false;
class FakeMediaSource extends EventTarget {
  static isTypeSupported = () => true;
  readyState: "closed" | "open" | "ended" = "closed";
  ended = false;
  addSourceBuffer() {
    lastBuffer = new FakeSourceBuffer();
    lastBuffer.failOnAppend = failNextAppend;
    return lastBuffer as unknown as SourceBuffer;
  }
  endOfStream() { this.readyState = "ended"; this.ended = true; }
}
const sources = new Map<string, FakeMediaSource>();
URL.createObjectURL = vi.fn((ms: FakeMediaSource) => { const url = `blob:${sources.size}`; sources.set(url, ms); return url; }) as never;
URL.revokeObjectURL = vi.fn();

class FakeAudio {
  onplaying: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  preload = "";
  paused = true;
  private _src = "";
  set src(url: string) {
    this._src = url;
    const ms = sources.get(url)!;
    queueMicrotask(() => { ms.readyState = "open"; ms.dispatchEvent(new Event("sourceopen")); });
  }
  get src() { return this._src; }
  /** Like a real element: `playing` only once some audio was appended. */
  play = vi.fn(async () => {
    this.paused = false;
    const fire = () => {
      if (this.paused) return;
      if (lastBuffer?.appended.length) this.onplaying?.();
      else setTimeout(fire, 0);
    };
    queueMicrotask(fire);
  });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn();
  load = vi.fn();
  end() { this.onended?.(); }
}

function streamOf(parts: number[], opts: { failAfter?: number; hold?: Promise<void> } = {}) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (opts.hold && i === 1) await opts.hold;
      if (opts.failAfter !== undefined && i === opts.failAfter) { controller.error(new TypeError("network lost")); return; }
      if (i >= parts.length) { controller.close(); return; }
      controller.enqueue(new Uint8Array(parts[i++]));
    },
  });
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(overrides: Partial<ElevenLabsStreamDeps> = {}, ctx: Parameters<typeof createElevenLabsStreamingPlayback>[0] = {}) {
  const audio = new FakeAudio();
  const playBlob = vi.fn(async (_blob: Blob, _stall?: number, onStart?: (ms: number) => void) => {
    onStart?.(5);
    return { status: "played" as const, playbackTotalMs: 40 };
  });
  const deps: ElevenLabsStreamDeps = {
    model: "eleven_v4_turbo",
    label: "TTS-EL test",
    request: vi.fn(async () => new Response(streamOf([100, 200, 300]), { status: 200, headers: { "Content-Type": "audio/mpeg" } })),
    generateBlob: vi.fn(async () => ({ blob: new Blob(["rest"]), meta: { provider: "elevenlabs" as const, model: "eleven_v4_turbo", statusCode: 200 } })),
    mediaSource: FakeMediaSource as unknown as typeof MediaSource,
    createAudio: () => audio as unknown as HTMLAudioElement,
    playBlob: playBlob as never,
    stallTimeoutMs: 1000,
    ...overrides,
  };
  const handle = createElevenLabsStreamingPlayback(ctx, deps);
  return { handle, audio, deps, playBlob };
}

describe("ElevenLabs progressive playback (L1.1)", () => {
  it("feeds every chunk to MediaSource, starts on open and finishes on ended", async () => {
    failNextAppend = false;
    const observe = vi.fn();
    const { handle, audio, playBlob } = setup({}, { onVoiceObservation: observe });
    const stats = await handle.generationDone;
    expect(stats).toMatchObject({ provider: "elevenlabs", model: "eleven_v4_turbo", transport: "http_stream", statusCode: 200 });
    expect(stats.firstByteMs).toBeGreaterThanOrEqual(0);
    await tick();
    expect(lastBuffer!.appended).toEqual([100, 200, 300]);
    expect(audio.play).not.toHaveBeenCalled();
    handle.open();
    await handle.started;
    audio.end();
    await expect(handle.finished).resolves.toMatchObject({ playbackTotalMs: expect.any(Number) });
    expect(playBlob).not.toHaveBeenCalled();
    expect(audio.pause).not.toHaveBeenCalled();
    expect(observe.mock.calls.map((c) => c[0])).toEqual(["first_audio_chunk", "audio_blob_ready", "audio_scheduled"]);
  });

  it("can start before the stream ends (progressive, not whole-MP3)", async () => {
    failNextAppend = false;
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const { handle } = setup({ request: vi.fn(async () => new Response(streamOf([100, 200], { hold }), { status: 200 })) });
    handle.open();
    await handle.started;
    let generated = false;
    void handle.generationDone.then(() => { generated = true; });
    await tick();
    expect(generated).toBe(false);
    release();
    await handle.generationDone;
  });

  it("falls back to the received MP3 blob when MediaSource refuses the data", async () => {
    failNextAppend = true;
    const { handle, playBlob } = setup();
    handle.open();
    await handle.started;
    await handle.finished;
    expect(playBlob).toHaveBeenCalledTimes(1);
    expect((playBlob.mock.calls[0][0] as Blob).size).toBe(600);
    expect((await handle.generationDone).transport).toBe("rest_fallback");
    failNextAppend = false;
  });

  it("plays the blob path without MediaSource support", async () => {
    const { handle, playBlob } = setup({ mediaSource: null });
    handle.open();
    await handle.finished;
    expect(playBlob).toHaveBeenCalledTimes(1);
  });

  it("retries once over REST when the stream request fails, not on a client error", async () => {
    const serverError = Object.assign(new Error("ElevenLabs TTS error: 503"), { statusCode: 503 });
    const a = setup({ request: vi.fn(async () => { throw serverError; }) });
    a.handle.open();
    await a.handle.finished;
    expect(a.deps.generateBlob).toHaveBeenCalledTimes(1);
    expect((await a.handle.generationDone).transport).toBe("rest_fallback");

    const clientError = Object.assign(new Error("ElevenLabs TTS error: 400"), { statusCode: 400 });
    const b = setup({ request: vi.fn(async () => { throw clientError; }) });
    b.handle.open();
    await expect(b.handle.finished).rejects.toBe(clientError);
    expect(b.deps.generateBlob).not.toHaveBeenCalled();
  });

  it("cancels the request and the audio at once (barge-in)", async () => {
    failNextAppend = false;
    const parent = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const hold = new Promise<void>(() => {});
    const { handle, audio } = setup({
      request: vi.fn(async (signal: AbortSignal) => { requestSignal = signal; return new Response(streamOf([100, 200], { hold }), { status: 200 }); }),
    }, { signal: parent.signal });
    handle.open();
    await handle.started;
    parent.abort("barge-in");
    await expect(handle.finished).rejects.toMatchObject({ name: "AbortError" });
    expect(requestSignal?.aborted).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("surfaces a cut after audio started instead of replaying", async () => {
    failNextAppend = false;
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    const { handle, playBlob } = setup({ request: vi.fn(async () => new Response(streamOf([100, 200, 300], { failAfter: 2, hold }), { status: 200 })) });
    handle.open();
    await handle.started;
    release();
    await expect(handle.finished).rejects.toThrow("network lost");
    expect(playBlob).not.toHaveBeenCalled();
  });
});
