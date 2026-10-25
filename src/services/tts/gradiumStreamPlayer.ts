import { encodeWavPcm16 } from '../stt/audioToWav';
import { observeVoice, type VoiceObserver } from "../voiceTurnTelemetryV2";
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
import { stripGradiumControlMarkup } from './gradiumSpeech';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TOKEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/proxy-tts-gradium`;
const GRADIUM_TTS_WS_URL = "wss://api.gradium.ai/api/speech/tts";

const TOKEN_TIMEOUT_MS = 6000;
const WS_OPEN_TIMEOUT_MS = 6000;
const FIRST_CHUNK_TIMEOUT_MS = 8000;
const INTER_CHUNK_STALL_MS = 6000;
/** Small scheduling safety margin so the first buffer never starts in the past. */
const SCHEDULE_MARGIN_S = 0.03;
/**
 * Jitter buffer: audio accumulated before (re)starting playback. Without it,
 * each late WS chunk created a gap then a hard restart — heard as "hiccups"
 * and clicks in the middle of words.
 */
export const GRADIUM_BUFFER_PRESETS = {
  current: { prebufferMs: 300, rebufferMs: 200 },
  "160": { prebufferMs: 160, rebufferMs: 160 },
  "240": { prebufferMs: 240, rebufferMs: 200 },
} as const;
export type GradiumBufferPreset = keyof typeof GRADIUM_BUFFER_PRESETS;
/** Short fade applied when playback (re)starts after silence, to avoid clicks. */
const FADE_S = 0.004;

export interface GradiumStreamOptions {
  voiceId: string;
  /** Raw PCM over the WS. "pcm_48000" is sent as Gradium's native "pcm" (48 kHz). */
  format: "pcm_24000" | "pcm_48000";
  /** temp / cfg_coef / padding_bonus / rewrite_rules / pronunciation_id */
  jsonConfig: Record<string, unknown>;
  deferSetup?: boolean;
  /** Sandbox auditions only. Capture decoded provider samples, max 30 s. */
  captureAudio?: boolean;
  onSetupSent?: () => void;
  validateContext?: () => void;
  /** Adapter-owned compiler, called only on validated speech units. */
  prepareText?: (text: string) => string;
  /** Lab-only playback buffer choice. Omitting it preserves the current 300/200 ms behaviour. */
  bufferPreset?: GradiumBufferPreset;
  signal?: AbortSignal;
  onVoiceObservation?: VoiceObserver;
  onProgress?: (progress: GradiumAudioProgress) => void;
}

export interface GradiumStreamStats {
  auditionAudio?: Blob;
  auditionCapture?: 'complete' | 'limit_exceeded';
  /** ms from session creation to the first audio chunk. */
  firstByteMs: number;
  /** ms from session creation to upstream end_of_stream (all audio received). */
  totalGenMs: number;
  bytes: number;
  bufferPreset: GradiumBufferPreset;
  prebufferMs: number;
  rebufferMs: number;
  rebufferCount: number;
  underrunCount: number;
  maxGapMs: number;
}

export interface GradiumAudioProgress {
  scheduledSamples: number;
  playedSamples: number;
  sampleRate: number;
  /** Only timestamped text whose stop sample has passed the output clock. */
  confirmedText: string;
}
export interface GradiumStreamSession {
  configure(jsonConfig: Record<string, unknown>): void;
  appendText(text: string): void;
  finish(): void;
  progress(): GradiumAudioProgress;
  open(): void;
  started: Promise<void>;
  finished: Promise<{ playbackTotalMs: number }>;
  generationDone: Promise<GradiumStreamStats>;
  cancel(reason?: unknown): void;
  attenuate(): boolean;
  pause(): boolean;
  resume(): boolean;
  estimatedStopAt(): number | null;
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
  const session = createGradiumTurnSession(opts);
  session.appendText(text);
  session.finish();
  return session;
}

/** One token/socket/setup and one EOS for the entire incrementally supplied turn. */
export function createGradiumTurnSession(opts: GradiumStreamOptions): GradiumStreamSession {
  const t0 = performance.now();
  const lifetime = new AbortController();
  const sampleRate = opts.format === "pcm_48000" ? 48000 : 24000;
  const wireFormat = opts.format === "pcm_48000" ? "pcm" : opts.format;
  const bufferPreset: GradiumBufferPreset = opts.bufferPreset ?? "current";
  const bufferConfig = GRADIUM_BUFFER_PRESETS[bufferPreset];

  const started = deferred<void>();
  const finished = deferred<{ playbackTotalMs: number }>();
  const generationDone = deferred<GradiumStreamStats>();

  const capture: Float32Array[] = [];
  let capturedSamples = 0;
  let captureExceeded = false;
  let ws: WebSocket | null = null;
  let socketReady = false;
  let setupConfigured = !opts.deferSetup;
  let setupSent = false;
  let jsonConfig = opts.jsonConfig;
  let finishRequested = false;
  let eosSent = false;
  const pendingText: string[] = [];
  let submittedChars = 0;
  let scheduledSamples = 0;
  let frozenProgress: GradiumAudioProgress | null = null;
  const scheduled: { start: number; length: number; offset: number; samples: Float32Array | null; source: AudioBufferSourceNode }[] = [];
  const timestamps: { text: string; stop: number }[] = [];
  const progress = (): GradiumAudioProgress => {
    if (frozenProgress) return frozenProgress;
    const ctx = getSharedAudioContext();
    const clock = ctx ? ctx.currentTime - (ctx.outputLatency || 0) : -1;
    let playedSamples = 0;
    for (const chunk of scheduled) {
      playedSamples += Math.max(0, Math.min(chunk.length, Math.floor((clock - chunk.start) * sampleRate)));
    }
    let confirmedText = '';
    for (const timestamp of timestamps) {
      if (timestamp.stop * sampleRate > playedSamples) break;
      confirmedText += timestamp.text;
    }
    return { scheduledSamples, playedSamples, sampleRate, confirmedText };
  };
  const notifyProgress = () => { try { opts.onProgress?.(progress()); } catch { /* observer only */ } };
  let gateOpen = false;
  let openedAt = 0;
  let eosReceived = false;
  let cancelled = false;
  let firstByteMs: number | null = null;
  let totalBytes = 0;
  let audibleOutput = false;
  let firstFrameLogged = false;
  const pendingChunks: { samples: Float32Array; offset?: number }[] = [];
  const liveSources = new Set<AudioBufferSourceNode>();
  const carry: { byte: number | null } = { byte: null };
  let gain: GainNode | null = null;
  let volume = 1;
  let paused = false;
  let playCursor = 0;
  let preAudioTimer: ReturnType<typeof setTimeout> | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  let gapOpen = false;
  let rebufferCount = 0;
  let underrunCount = 0;
  let maxGapMs = 0;

  const clearTimers = () => {
    if (drainTimer) { clearTimeout(drainTimer); drainTimer = null; }
    if (preAudioTimer) { clearTimeout(preAudioTimer); preAudioTimer = null; }
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
  };

  const teardownAudio = () => {
    for (const src of liveSources) {
      src.onended = null;
      try { src.stop(); } catch { /* already stopped */ }
    }
    liveSources.clear();
    capture.length = 0;
    pendingChunks.length = 0;
    pendingText.length = 0;
    try { gain?.disconnect(); } catch { /* ignore */ }
    gain = null;
  };

  const closeWs = () => {
    if (!ws) return;
    const socket = ws;
    ws = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch { /* ignore */ }
  };

  const fail = (err: unknown) => {
    if (cancelled) return;
    frozenProgress = progress();
    cancelled = true;
    lifetime.abort(err);
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
    if (cancelled || finished.settled || paused) return;
    if (eosReceived && gateOpen && pendingChunks.length === 0 && liveSources.size === 0 && started.settled) {
      if (progress().playedSamples < scheduledSamples) {
        if (!drainTimer) drainTimer = setTimeout(() => { drainTimer = null; checkFinished(); }, 25);
        return;
      }
      clearTimers();
      removeAbortListener();
      frozenProgress = { ...progress(), playedSamples: scheduledSamples };
      notifyProgress();
      finished.resolve({ playbackTotalMs: Math.round(performance.now() - openedAt) });
    }
  };

  let hasPlayed = false;
  const pendingDuration = () => pendingChunks.reduce((sum, c) => sum + c.samples.length, 0) / sampleRate;

  const setVolume = (value: number) => {
    volume = value;
    const ctx = getSharedAudioContext();
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(value, ctx.currentTime + FADE_S);
    }
  };

  const pause = (): boolean => {
    if (cancelled || finished.settled) return false;
    if (paused) return true;
    const ctx = getSharedAudioContext();
    if (!ctx) return false;
    paused = true;
    const suffixes: { samples: Float32Array; offset: number }[] = [];
    for (const chunk of scheduled) {
      if (!liveSources.has(chunk.source) || !chunk.samples) continue;
      // The render cursor includes the output tail still travelling to the device.
      // Keep that tail in the ledger; only samples not yet rendered may resume.
      const consumed = Math.max(0, Math.min(chunk.length, Math.floor((ctx.currentTime - chunk.start) * sampleRate)));
      if (consumed < chunk.length) suffixes.push({ samples: chunk.samples.slice(consumed), offset: chunk.offset + consumed });
      chunk.length = consumed;
      chunk.samples = null;
      chunk.source.onended = null;
      try { chunk.source.stop(); chunk.source.disconnect(); } catch { /* already ended */ }
    }
    liveSources.clear();
    pendingChunks.unshift(...suffixes);
    playCursor = ctx.currentTime;
    notifyProgress();
    return true;
  };

  const scheduleChunk = (chunk: { samples: Float32Array; offset?: number }, ctx: AudioContext, fadeIn = false) => {
    const { samples } = chunk;
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.connect(ctx.destination);
    }
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const data = buffer.getChannelData(0);
    data.set(samples);
    if (fadeIn) {
      const n = Math.min(data.length, Math.round(FADE_S * sampleRate));
      for (let i = 0; i < n; i++) data[i] *= i / n;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const startAt = Math.max(ctx.currentTime + SCHEDULE_MARGIN_S, playCursor);
    source.start(startAt);
    const record = { start: startAt, length: samples.length, offset: chunk.offset ?? scheduledSamples, samples: samples as Float32Array | null, source };
    scheduled.push(record);
    if (chunk.offset === undefined) scheduledSamples += samples.length;
    playCursor = startAt + buffer.duration;
    liveSources.add(source);
    source.onended = () => {
      if (cancelled) return;
      liveSources.delete(source);
      record.samples = null;
      try { source.disconnect(); } catch { /* already disconnected */ }
      notifyProgress();
      checkFinished();
    };
    audibleOutput = true;
    notifyProgress();
    if (!started.settled) {
      observeVoice(opts.onVoiceObservation, "audio_scheduled");
      const outputAt = performance.now() + Math.max(0, startAt - ctx.currentTime) * 1000 + (ctx.outputLatency || 0) * 1000;
      observeVoice(opts.onVoiceObservation, "output_estimated", outputAt);
      started.resolve();
    }
  };

  const flushPending = () => {
    if (!gateOpen || cancelled || paused) return;
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (pendingChunks.length === 0) { checkFinished(); return; }
    // Idle = nothing queued ahead of the audio clock (start, or underrun).
    const idle = playCursor <= ctx.currentTime + 0.005;
    if (idle && !eosReceived && pendingDuration() < (hasPlayed ? bufferConfig.rebufferMs : bufferConfig.prebufferMs) / 1000) {
      const gapMs = Math.max(0, ctx.currentTime - playCursor) * 1000;
      if (hasPlayed && gapMs > 5 && !gapOpen) {
        gapOpen = true;
        rebufferCount += 1;
        underrunCount += 1;
        maxGapMs = Math.max(maxGapMs, Math.round(gapMs));
      }
      return;
    }
    let first = idle;
    while (pendingChunks.length > 0) {
      scheduleChunk(pendingChunks.shift()!, ctx, first);
      first = false;
    }
    hasPlayed = true;
    gapOpen = false;
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
    let auditionAudio: Blob | undefined;
    if (opts.captureAudio && !captureExceeded && capturedSamples > 0) {
      const samples = new Float32Array(capturedSamples);
      let offset = 0;
      for (const chunk of capture) { samples.set(chunk, offset); offset += chunk.length; }
      auditionAudio = encodeWavPcm16(samples, sampleRate, true);
    }
    capture.length = 0;
    generationDone.resolve({
      ...(opts.captureAudio ? { auditionAudio, auditionCapture: captureExceeded ? 'limit_exceeded' as const : 'complete' as const } : {}),
      firstByteMs: firstByteMs ?? 0,
      totalGenMs: Math.round(performance.now() - t0),
      bytes: totalBytes,
      bufferPreset,
      prebufferMs: bufferConfig.prebufferMs,
      rebufferMs: bufferConfig.rebufferMs,
      rebufferCount,
      underrunCount,
      maxGapMs,
    });
    flushPending();
    checkFinished();
  };

  const handleMessage = (event: MessageEvent) => {
    if (cancelled) return;
    let msg: { type?: string; audio?: string; text?: string; start_s?: number; stop_s?: number; message?: string; code?: unknown };
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
      if (firstByteMs === null) {
        firstByteMs = Math.round(performance.now() - t0);
        observeVoice(opts.onVoiceObservation, "first_audio_chunk");
        debugLogger.log({ service: "tts", level: "info", direction: "in", label: `TTS-GR-WS first chunk in ${firstByteMs}ms` });
      }
      armStallTimer();
      totalBytes += msg.audio.length; // base64 length ≈ bytes × 4/3; good enough for stats
      const samples = decodePcmChunk(msg.audio, carry);
      if (samples.length === 0) return;
      if (opts.captureAudio && !captureExceeded) {
        capturedSamples += samples.length;
        if (capturedSamples > sampleRate * 30) { captureExceeded = true; capture.length = 0; }
        else capture.push(samples.slice());
      }
      const ctx = getSharedAudioContext();
      const ahead = Math.max(0, playCursor - (ctx?.currentTime ?? 0)) + pendingDuration() + samples.length / sampleRate;
      if (ahead > 30) { fail(new Error("Gradium audio buffer exceeded 30 seconds")); return; }
      pendingChunks.push({ samples });
      flushPending();
    } else if (msg.type === "text" && typeof msg.text === "string" && typeof msg.stop_s === "number"
      && Number.isFinite(msg.stop_s) && msg.stop_s >= 0) {
      if (timestamps.length >= 4000) { fail(new Error("Gradium timestamp buffer exceeded")); return; }
      if (!timestamps.length || msg.stop_s >= timestamps[timestamps.length - 1].stop) {
        const words = stripGradiumControlMarkup(msg.text);
        if (words.trim()) timestamps.push({ text: words, stop: msg.stop_s });
        notifyProgress();
      }
    } else if (msg.type === "end_of_stream" || msg.type === "eos") {
      if (firstByteMs === null) {
        fail(new Error("Gradium WS returned no audio"));
        return;
      }
      if (!eosSent) { fail(new Error("Gradium premature EOS")); return; }
      onGenerationComplete();
    } else if (msg.type === "error") {
      fail(new Error(`Gradium WS error: ${String(msg.message || msg.code || "unknown")}`));
    }
    // "ready" and unknown message types are ignored on purpose.
  };

  const sendPendingText = () => {
    if (cancelled || !socketReady || !ws || !setupConfigured) return;
    if (!setupSent) {
      try { opts.validateContext?.(); } catch (error) { fail(error); return; }
      ws.send(JSON.stringify({ type: 'setup', model_name: 'default', voice_id: opts.voiceId, output_format: wireFormat, json_config: jsonConfig }));
      setupSent = true;
      opts.onSetupSent?.();
    }
    for (const text of pendingText.splice(0)) {
      ws.send(JSON.stringify({ type: "text", text }));
      observeVoice(opts.onVoiceObservation, "tts_text_sent");
      if (firstByteMs === null) armPreAudioTimer("tts_gradium_ws_first_chunk", FIRST_CHUNK_TIMEOUT_MS);
    }
    if (finishRequested && !eosSent) {
      eosSent = true; ws.send(JSON.stringify({ type: "end_of_stream" }));
    }
  };

  const start = async () => {
    const timeout = createTimeoutSignal(TOKEN_TIMEOUT_MS, lifetime.signal);
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
      socketReady = true;
      if (preAudioTimer) { clearTimeout(preAudioTimer); preAudioTimer = null; }
      sendPendingText();
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
      if (firstByteMs !== null && eosSent && event.code === 1000) { onGenerationComplete(); return; }
      if (firstByteMs !== null) { fail(new Error("Gradium socket closed during turn")); return; }
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
    configure(value: Record<string, unknown>) {
      if (setupSent || cancelled) return;
      jsonConfig = value; setupConfigured = true; sendPendingText();
    },
    appendText(text: string) {
      if (cancelled) throw abortError();
      if (finishRequested) throw new Error("Gradium text after finish");
      if (!text.trim()) return;
      submittedChars += text.length;
      if (submittedChars > 12000) { fail(new Error("Gradium text buffer exceeded")); throw new Error("Gradium text buffer exceeded"); }
      const wireText = opts.prepareText ? opts.prepareText(text) : text;
      if (wireText.trim()) pendingText.push(wireText);
      sendPendingText();
    },
    finish() {
      if (cancelled || finishRequested) return;
      finishRequested = true; sendPendingText();
    },
    progress,
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
    attenuate() {
      if (cancelled || finished.settled) return false;
      setVolume(0.18); return true;
    },
    pause,
    resume() {
      if (cancelled || finished.settled) return false;
      paused = false; setVolume(1); flushPending(); return true;
    },
    estimatedStopAt() {
      const ctx = getSharedAudioContext();
      return ctx && audibleOutput && Number.isFinite(ctx.outputLatency)
        ? performance.now() + ctx.outputLatency * 1000 : null;
    },
    get hasAudibleOutput() { return audibleOutput; },
  };
}
