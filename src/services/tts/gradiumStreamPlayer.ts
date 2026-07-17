/**
 * Gradium TTS WebSocket streaming — WS transport + progressive Web Audio playback.
 *
 * The browser mints a short-lived token from the `proxy-tts-gradium` edge
 * function (GET), then talks to `wss://api.gradium.ai/api/speech/tts` directly —
 * same pattern as the realtime STT client (`src/services/stt/providers/gradiumSTT.ts`).
 * Protocol: send `setup` (+ json_config) → send `text` → send `end_of_stream`;
 * receive `{type:"audio", audio:<base64 pcm16>}` chunks then `end_of_stream`.
 *
 * Playback is gated: chunks buffer until `open()` is called, then get scheduled
 * on the shared AudioContext with a play cursor. This lets TTSQueue generate
 * sentence N+1 while N is still playing without ever overlapping audio.
 */

import { getSharedAudioContext } from "@/services/audioPlayback";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { createTimeoutSignal, TimeoutError } from "@/services/asyncUtils";
import { debugLogger } from "@/services/debugLogger";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TOKEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/proxy-tts-gradium`;
const GRADIUM_TTS_WS_URL = "wss://api.gradium.ai/api/speech/tts";

const TOKEN_TIMEOUT_MS = 6000;
const WS_OPEN_TIMEOUT_MS = 6000;
const FIRST_CHUNK_TIMEOUT_MS = 8000;
const INTER_CHUNK_STALL_MS = 6000;
/** Small scheduling safety margin so the first buffer never starts in the past. */
const SCHEDULE_MARGIN_S = 0.03;

export interface GradiumStreamOptions {
  voiceId: string;
  /** Raw PCM over the WS. "pcm_48000" is sent as Gradium's native "pcm" (48 kHz). */
  format: "pcm_24000" | "pcm_48000";
  /** temp / cfg_coef / padding_bonus / rewrite_rules / pronunciation_id */
  jsonConfig: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GradiumStreamStats {
  /** ms from session creation to the first audio chunk. */
  firstByteMs: number;
  /** ms from session creation to upstream end_of_stream (all audio received). */
  totalGenMs: number;
  bytes: number;
}

export interface GradiumStreamSession {
  open(): void;
  started: Promise<void>;
  finished: Promise<{ playbackTotalMs: number }>;
  generationDone: Promise<GradiumStreamStats>;
  cancel(reason?: unknown): void;
  /** True once at least one chunk has been scheduled for playback (audible). */
  readonly hasAudibleOutput: boolean;
}

export function isStreamingSupported(): boolean {
  return typeof WebSocket !== "undefined" && getSharedAudioContext() !== null;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  settled: boolean;
}

function deferred<T>(): Deferred<T> {
  const d = { settled: false } as Deferred<T>;
  d.promise = new Promise<T>((resolve, reject) => {
    d.resolve = (v) => { d.settled = true; resolve(v); };
    d.reject = (e) => { d.settled = true; reject(e); };
  });
  // Consumers may attach handlers late (or only to some promises) — pre-mark handled.
  d.promise.catch(() => {});
  return d;
}

function abortError(reason?: unknown): DOMException {
  const message = typeof reason === "string" && reason ? reason : "Gradium stream cancelled";
  return new DOMException(message, "AbortError");
}

/** base64 pcm16le mono → Float32Array in [-1, 1]. `carry` holds a dangling odd byte. */
function decodePcmChunk(base64: string, carry: { byte: number | null }): Float32Array {
  const binary = atob(base64);
  let bytes: Uint8Array;
  if (carry.byte !== null) {
    bytes = new Uint8Array(binary.length + 1);
    bytes[0] = carry.byte;
    for (let i = 0; i < binary.length; i++) bytes[i + 1] = binary.charCodeAt(i);
  } else {
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }
  carry.byte = null;
  let usable = bytes.length;
  if (usable % 2 !== 0) {
    usable -= 1;
    carry.byte = bytes[usable];
  }
  const samples = new Float32Array(usable / 2);
  const view = new DataView(bytes.buffer, 0, usable);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

export function createGradiumStreamSession(text: string, opts: GradiumStreamOptions): GradiumStreamSession {
  const t0 = performance.now();
  const sampleRate = opts.format === "pcm_48000" ? 48000 : 24000;
  const wireFormat = opts.format === "pcm_48000" ? "pcm" : opts.format;

  const started = deferred<void>();
  const finished = deferred<{ playbackTotalMs: number }>();
  const generationDone = deferred<GradiumStreamStats>();

  let ws: WebSocket | null = null;
  let gateOpen = false;
  let openedAt = 0;
  let eosReceived = false;
  let cancelled = false;
  let firstByteMs = 0;
  let totalBytes = 0;
  let audibleOutput = false;
  let firstFrameLogged = false;
  const pendingChunks: Float32Array[] = [];
  const liveSources = new Set<AudioBufferSourceNode>();
  const carry: { byte: number | null } = { byte: null };
  let gain: GainNode | null = null;
  let playCursor = 0;
  let preAudioTimer: ReturnType<typeof setTimeout> | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (preAudioTimer) { clearTimeout(preAudioTimer); preAudioTimer = null; }
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
  };

  const teardownAudio = () => {
    for (const src of liveSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    liveSources.clear();
    pendingChunks.length = 0;
    try { gain?.disconnect(); } catch { /* ignore */ }
    gain = null;
  };

  const closeWs = () => {
    if (!ws) return;
    const socket = ws;
    ws = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch { /* ignore */ }
  };

  const fail = (err: unknown) => {
    if (cancelled) return;
    cancelled = true;
    clearTimers();
    closeWs();
    teardownAudio();
    removeAbortListener();
    if (!started.settled) started.reject(err);
    if (!generationDone.settled) generationDone.reject(err);
    if (!finished.settled) finished.reject(err);
  };

  const cancel = (reason?: unknown) => {
    if (cancelled) return;
    const err = reason instanceof Error || reason instanceof DOMException ? reason : abortError(reason);
    fail(err);
  };

  const onAbort = () => cancel(opts.signal?.reason);
  const removeAbortListener = () => opts.signal?.removeEventListener("abort", onAbort);
  if (opts.signal?.aborted) {
    queueMicrotask(() => cancel(opts.signal?.reason));
  } else {
    opts.signal?.addEventListener("abort", onAbort, { once: true });
  }

  const checkFinished = () => {
    if (cancelled || finished.settled) return;
    if (eosReceived && gateOpen && pendingChunks.length === 0 && liveSources.size === 0 && started.settled) {
      clearTimers();
      removeAbortListener();
      finished.resolve({ playbackTotalMs: Math.round(performance.now() - openedAt) });
    }
  };

  const scheduleChunk = (samples: Float32Array, ctx: AudioContext) => {
    if (!gain) {
      gain = ctx.createGain();
      gain.connect(ctx.destination);
    }
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const startAt = Math.max(ctx.currentTime + SCHEDULE_MARGIN_S, playCursor);
    source.start(startAt);
    playCursor = startAt + buffer.duration;
    liveSources.add(source);
    source.onended = () => {
      liveSources.delete(source);
      checkFinished();
    };
    audibleOutput = true;
    if (!started.settled) started.resolve();
  };

  const flushPending = () => {
    if (!gateOpen || cancelled) return;
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    while (pendingChunks.length > 0) {
      scheduleChunk(pendingChunks.shift()!, ctx);
    }
    checkFinished();
  };

  const armPreAudioTimer = (label: string, ms: number) => {
    if (preAudioTimer) clearTimeout(preAudioTimer);
    preAudioTimer = setTimeout(() => fail(new TimeoutError(label, ms)), ms);
  };

  const armStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => fail(new TimeoutError("tts_gradium_ws_stall", INTER_CHUNK_STALL_MS)), INTER_CHUNK_STALL_MS);
  };

  const onGenerationComplete = () => {
    if (eosReceived || cancelled) return;
    eosReceived = true;
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    closeWs();
    generationDone.resolve({
      firstByteMs,
      totalGenMs: Math.round(performance.now() - t0),
      bytes: totalBytes,
    });
    flushPending();
    checkFinished();
  };

  const handleMessage = (event: MessageEvent) => {
    if (cancelled) return;
    let msg: { type?: string; audio?: string; message?: string; code?: unknown };
    try {
      msg = JSON.parse(event.data);
    } catch {
      if (!firstFrameLogged) {
        firstFrameLogged = true;
        debugLogger.log({ service: "tts", level: "warn", direction: "in", label: "TTS-GR-WS first frame is non-JSON", detail: String(event.data).slice(0, 120) });
      }
      return; // ignore non-JSON frames
    }
    if (!firstFrameLogged) {
      firstFrameLogged = true;
      debugLogger.log({ service: "tts", level: "info", direction: "in", label: `TTS-GR-WS first frame type=${msg.type ?? "?"}` });
    }
    if (msg.type === "audio" && typeof msg.audio === "string") {
      if (preAudioTimer) { clearTimeout(preAudioTimer); preAudioTimer = null; }
      if (!firstByteMs) {
        firstByteMs = Math.round(performance.now() - t0);
        debugLogger.log({ service: "tts", level: "info", direction: "in", label: `TTS-GR-WS first chunk in ${firstByteMs}ms` });
      }
      armStallTimer();
      totalBytes += msg.audio.length; // base64 length ≈ bytes × 4/3; good enough for stats
      const samples = decodePcmChunk(msg.audio, carry);
      if (samples.length === 0) return;
      if (gateOpen) {
        const ctx = getSharedAudioContext();
        if (ctx) scheduleChunk(samples, ctx);
      } else {
        pendingChunks.push(samples);
      }
    } else if (msg.type === "end_of_stream" || msg.type === "eos") {
      if (!firstByteMs) {
        fail(new Error("Gradium WS returned no audio"));
        return;
      }
      onGenerationComplete();
    } else if (msg.type === "error") {
      fail(new Error(`Gradium WS error: ${String(msg.message || msg.code || "unknown")}`));
    }
    // "ready" and unknown message types are ignored on purpose.
  };

  const start = async () => {
    const timeout = createTimeoutSignal(TOKEN_TIMEOUT_MS, opts.signal);
    let token: string;
    try {
      const tokenRes = await authenticatedFunctionFetch(TOKEN_ENDPOINT, { method: "GET", signal: timeout.signal });
      if (!tokenRes.ok) {
        const err = new Error(`Gradium token ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 200)}`);
        (err as Error & { statusCode?: number }).statusCode = tokenRes.status;
        throw err;
      }
      token = (await tokenRes.json())?.token;
      if (!token) throw new Error("Gradium token missing");
    } finally {
      timeout.cancel();
    }
    if (cancelled) return;

    const wsUrl = new URL(GRADIUM_TTS_WS_URL);
    wsUrl.searchParams.set("token", token);
    ws = new WebSocket(wsUrl);
    armPreAudioTimer("tts_gradium_ws_open", WS_OPEN_TIMEOUT_MS);

    ws.onopen = () => {
      if (cancelled || !ws) return;
      ws.send(JSON.stringify({
        type: "setup",
        model_name: "default",
        voice_id: opts.voiceId,
        output_format: wireFormat,
        json_config: opts.jsonConfig,
      }));
      ws.send(JSON.stringify({ type: "text", text }));
      ws.send(JSON.stringify({ type: "end_of_stream" }));
      armPreAudioTimer("tts_gradium_ws_first_chunk", FIRST_CHUNK_TIMEOUT_MS);
    };
    ws.onmessage = handleMessage;
    ws.onerror = () => {
      debugLogger.log({ service: "tts", level: "error", direction: "in", label: "TTS-GR-WS error event", detail: `firstByte=${firstByteMs || "none"} firstFrame=${firstFrameLogged}` });
      fail(new Error("Gradium WS connection error"));
    };
    ws.onclose = (event) => {
      // A clean close after audio means the server finished without an explicit
      // end_of_stream frame (or we missed it) — treat as generation complete.
      if (cancelled || eosReceived) return;
      if (firstByteMs) { onGenerationComplete(); return; }
      // Closed before any audio: surface the close code/reason so a failure
      // that survives the redeploy is diagnosable in one round-trip (e.g. token
      // rejected, setup parse error, unexpected message shape).
      const detail = `code=${event.code} reason=${event.reason || "none"} firstFrame=${firstFrameLogged}`;
      debugLogger.log({ service: "tts", level: "error", direction: "in", label: "TTS-GR-WS closed before audio", detail });
      fail(new Error(`Gradium WS closed before any audio (${detail})`));
    };
  };

  start().catch((err) => fail(err));

  return {
    open() {
      if (gateOpen || cancelled) return;
      gateOpen = true;
      openedAt = performance.now();
      const ctx = getSharedAudioContext();
      if (!ctx) {
        fail(new Error("AudioContext unavailable"));
        return;
      }
      if (ctx.state === "suspended") {
        ctx.resume().then(
          () => {
            if (ctx.state !== "running") fail(new DOMException("AudioContext suspended (autoplay policy)", "NotAllowedError"));
            else flushPending();
          },
          () => fail(new DOMException("AudioContext resume failed", "NotAllowedError")),
        );
      } else {
        flushPending();
      }
    },
    started: started.promise,
    finished: finished.promise,
    generationDone: generationDone.promise,
    cancel,
    get hasAudibleOutput() { return audibleOutput; },
  };
}
