/**
 * ElevenLabs raw PCM playback through Web Audio (latency lot 1).
 *
 * Voice-only turns stream MP3 into a MediaSource (`elevenLabsStreamPlayer.ts`).
 * Where that cannot work, they waited for the whole MP3 before the first sound
 * (≈ 2 s on 26 Nov 2026): engines without MediaSource MP3 (plain `rest`), and
 * iPhone once `<audio>` was refused outside a gesture (`rest_fallback`). This
 * handle reads the same `pcm_24000` stream as the Tavus first line (lot T1) and
 * schedules it on the shared, unlocked AudioContext as it arrives.
 *
 * Same contract as the MP3 handle (TTSStreamPlaybackHandle):
 *  - generation starts on creation, playback waits for `open()`;
 *  - a failure before any sound is scheduled replays the line through the blob
 *    path (one REST request, or the PCM already received as a WAV when only the
 *    AudioContext is unusable), so a line is never silently dropped;
 *  - once sound is scheduled, a failure is surfaced, never replayed;
 *  - `cancel()` aborts the request and stops every scheduled source (barge-in).
 */

import { getSharedAudioContext, playAudioBlobRobust } from "@/services/audioPlayback";
import { encodeWavPcm16 } from "@/services/stt/audioToWav";
import { observeVoice } from "@/services/voiceTurnTelemetryV2";
import { createPcmChunker, ELEVENLABS_PCM_STREAM_RATE } from "./elevenLabsPcmStream";
import type {
  TTSGenerateContext,
  TTSGenerateResult,
  TTSStreamGenerationStats,
  TTSStreamPlaybackHandle,
} from "./types";

/** Audio queued before the first source starts: absorbs network jitter at the line start. */
export const PCM_PREBUFFER_MS = 200;
/** Audio queued again after an underrun before playback resumes. */
export const PCM_REBUFFER_MS = 120;
const CHUNK_MS = 100;
const SCHEDULE_MARGIN_S = 0.03;
const FADE_S = 0.004;

export interface ElevenLabsPcmPlaybackDeps {
  /** Opens the PCM16 byte stream; rejects before the first byte, null without a readable body. */
  openStream: (signal: AbortSignal) => Promise<AsyncIterable<Uint8Array> | null>;
  /** Full REST generation, used only when nothing was scheduled yet. */
  generateBlob: () => Promise<TTSGenerateResult>;
  model: string;
  audioContext?: () => AudioContext | null;
  playBlob?: typeof playAudioBlobRobust;
  sampleRate?: number;
}

function abortError(reason?: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException(typeof reason === "string" ? reason : "ElevenLabs PCM stream cancelled", "AbortError");
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** A client error other than rate limiting will fail the same way over REST. */
function canRetryOverRest(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode;
  return !(status && status >= 400 && status < 500 && status !== 429);
}

export function createElevenLabsPcmPlayback(
  ctx: TTSGenerateContext | undefined,
  deps: ElevenLabsPcmPlaybackDeps,
): TTSStreamPlaybackHandle {
  const t0 = performance.now();
  const controller = new AbortController();
  const sampleRate = deps.sampleRate ?? ELEVENLABS_PCM_STREAM_RATE;
  const audioContext = deps.audioContext ?? getSharedAudioContext;
  const playBlob = deps.playBlob ?? playAudioBlobRobust;
  const chunker = createPcmChunker(sampleRate, CHUNK_MS);

  let mode: "pcm" | "blob" = "pcm";
  let openRequested = false;
  let openedAt = 0;
  let contextReady = false;
  let cancelled = false;
  let audible = false;
  let settled = false;
  let streamDone = false;
  let statusCode: number | undefined;
  let firstByteMs: number | undefined;
  let receivedSamples = 0;
  const received: Float32Array[] = [];
  const pending: Float32Array[] = [];
  const live = new Set<AudioBufferSourceNode>();
  let playCursor = 0;
  let hasPlayed = false;
  let fallbackBlob: Blob | null = null;
  let blobLaunched = false;

  let resolveStarted!: () => void, rejectStarted!: (e: unknown) => void;
  let resolveFinished!: (v: { playbackTotalMs: number }) => void, rejectFinished!: (e: unknown) => void;
  let resolveGeneration!: (v: TTSStreamGenerationStats) => void, rejectGeneration!: (e: unknown) => void;
  const startedP = new Promise<void>((res, rej) => { resolveStarted = res; rejectStarted = rej; });
  const finishedP = new Promise<{ playbackTotalMs: number }>((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  const generationP = new Promise<TTSStreamGenerationStats>((res, rej) => { resolveGeneration = res; rejectGeneration = rej; });
  startedP.catch(() => {});
  finishedP.catch(() => {});
  generationP.catch(() => {});

  const stats = (transport: TTSStreamGenerationStats["transport"]): TTSStreamGenerationStats => ({
    provider: "elevenlabs", model: deps.model, transport, statusCode: statusCode ?? 200,
    firstByteMs, totalMs: Math.round(performance.now() - t0),
  });

  function stopSources() {
    for (const source of live) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    live.clear();
    pending.length = 0;
  }

  function failAll(err: unknown) {
    rejectGeneration(err);
    if (settled) return;
    settled = true;
    stopSources();
    rejectStarted(err);
    rejectFinished(err);
  }

  function toFloat(samples: Int16Array): Float32Array {
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] / 0x8000;
    return out;
  }

  function addSamples(samples: Int16Array) {
    if (samples.length === 0) return;
    const floats = toFloat(samples);
    received.push(floats);
    receivedSamples += floats.length;
    if (mode === "pcm") pending.push(floats);
  }

  const pendingSeconds = () => pending.reduce((sum, chunk) => sum + chunk.length, 0) / sampleRate;

  function checkFinished() {
    if (settled || mode !== "pcm" || !streamDone || !audible || pending.length > 0 || live.size > 0) return;
    settled = true;
    resolveFinished({ playbackTotalMs: Math.round(performance.now() - openedAt) });
  }

  function scheduleChunk(samples: Float32Array, audio: AudioContext, fadeIn: boolean) {
    const buffer = audio.createBuffer(1, samples.length, sampleRate);
    const data = buffer.getChannelData(0);
    data.set(samples);
    if (fadeIn) {
      const n = Math.min(data.length, Math.round(FADE_S * sampleRate));
      for (let i = 0; i < n; i++) data[i] *= i / n;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const startAt = Math.max(audio.currentTime + SCHEDULE_MARGIN_S, playCursor);
    source.start(startAt);
    playCursor = startAt + buffer.duration;
    live.add(source);
    source.onended = () => {
      if (cancelled) return;
      live.delete(source);
      try { source.disconnect(); } catch { /* already disconnected */ }
      schedule();
      checkFinished();
    };
    if (!audible) {
      audible = true;
      observeVoice(ctx?.onVoiceObservation, "audio_scheduled");
      resolveStarted();
    }
  }

  function schedule() {
    if (mode !== "pcm" || settled || cancelled || !openRequested || !contextReady) return;
    const audio = audioContext();
    if (!audio) return;
    if (pending.length === 0) { checkFinished(); return; }
    const idle = playCursor <= audio.currentTime + 0.005;
    const threshold = (hasPlayed ? PCM_REBUFFER_MS : PCM_PREBUFFER_MS) / 1000;
    if (idle && !streamDone && pendingSeconds() < threshold) return;
    let first = idle;
    while (pending.length > 0) {
      scheduleChunk(pending.shift()!, audio, first);
      first = false;
    }
    hasPlayed = true;
  }

  function launchBlobPlayback() {
    if (blobLaunched || cancelled || settled || !openRequested) return;
    if (!fallbackBlob && streamDone && receivedSamples > 0) {
      const samples = new Float32Array(receivedSamples);
      let offset = 0;
      for (const chunk of received) { samples.set(chunk, offset); offset += chunk.length; }
      fallbackBlob = encodeWavPcm16(samples, sampleRate, true);
    }
    if (!fallbackBlob) return;
    blobLaunched = true;
    const playStart = performance.now();
    void playBlob(fallbackBlob, undefined, () => {
      if (audible) return;
      audible = true;
      observeVoice(ctx?.onVoiceObservation, "audio_scheduled");
      resolveStarted();
    }, controller.signal).then((result) => {
      if (settled || cancelled) return;
      settled = true;
      if (result.status === "played") {
        resolveFinished({ playbackTotalMs: result.playbackTotalMs ?? Math.round(performance.now() - playStart) });
        return;
      }
      const error = result.error || new Error("Audio playback failed");
      (error as Error & { playbackErrorType?: string }).playbackErrorType = result.errorInfo?.type;
      rejectStarted(error);
      rejectFinished(error);
    });
  }

  /** Nothing was scheduled: the line is generated again as one REST blob. */
  async function fallbackToRest(reason: unknown) {
    console.warn(`[TTS-EL] PCM stream unavailable (${reason instanceof Error ? reason.message.slice(0, 120) : String(reason)}); retrying over REST`);
    mode = "blob";
    pending.length = 0;
    received.length = 0;
    receivedSamples = 0;
    try {
      const result = await deps.generateBlob();
      if (cancelled) return;
      fallbackBlob = result.blob;
      statusCode = result.meta.statusCode;
      firstByteMs ??= Math.round(performance.now() - t0);
      streamDone = true;
      resolveGeneration(stats("rest_fallback"));
      launchBlobPlayback();
    } catch (err) {
      failAll(cancelled ? abortError(err) : err);
    }
  }

  async function generate() {
    let stream: AsyncIterable<Uint8Array> | null;
    try {
      stream = await deps.openStream(controller.signal);
    } catch (err) {
      if (cancelled || isAbort(err) || ctx?.signal?.aborted) { failAll(abortError(err)); return; }
      if (!canRetryOverRest(err)) { failAll(err); return; }
      await fallbackToRest(err);
      return;
    }
    if (cancelled) return;
    if (!stream) { await fallbackToRest(new Error("no readable PCM body")); return; }
    try {
      for await (const bytes of stream) {
        if (cancelled) return;
        if (!bytes?.byteLength) continue;
        firstByteMs ??= Math.round(performance.now() - t0);
        for (const chunk of chunker.push(bytes)) addSamples(chunk);
        schedule();
      }
    } catch (err) {
      if (cancelled || isAbort(err) || ctx?.signal?.aborted) { failAll(abortError(err)); return; }
      // Speech already heard cannot be replayed: surface the cut.
      if (audible && mode === "pcm") { failAll(err); return; }
      await fallbackToRest(err);
      return;
    }
    if (cancelled) return;
    addSamples(chunker.flush());
    if (receivedSamples === 0) { await fallbackToRest(new Error("empty PCM stream")); return; }
    streamDone = true;
    resolveGeneration(stats("http_stream_pcm"));
    if (mode === "pcm") schedule();
    else launchBlobPlayback();
  }

  /** The context cannot play (closed, resume refused): keep the stream, play it as one WAV. */
  function contextUnusable(err: unknown) {
    if (settled || cancelled) return;
    if (audible) { failAll(err); return; }
    console.warn(`[TTS-EL] Web Audio unavailable for the PCM stream (${err instanceof Error ? err.message.slice(0, 120) : String(err)}); playing it as one blob`);
    mode = "blob";
    pending.length = 0;
    launchBlobPlayback();
  }

  const onParentAbort = () => handle.cancel(ctx?.signal?.reason);
  if (ctx?.signal?.aborted) queueMicrotask(onParentAbort);
  else ctx?.signal?.addEventListener("abort", onParentAbort, { once: true });
  finishedP.finally(() => ctx?.signal?.removeEventListener("abort", onParentAbort)).catch(() => {});

  void generate();

  const handle: TTSStreamPlaybackHandle = {
    open() {
      if (openRequested || cancelled) return;
      openRequested = true;
      openedAt = performance.now();
      if (mode === "blob") { launchBlobPlayback(); return; }
      const audio = audioContext();
      if (!audio || audio.state === "closed") { contextUnusable(new Error("AudioContext unavailable")); return; }
      // "interrupted" (iOS, after the microphone starts) is as silent as "suspended".
      if (audio.state !== "running") {
        audio.resume().then(
          () => {
            if (audio.state !== "running") contextUnusable(new DOMException("AudioContext suspended (autoplay policy)", "NotAllowedError"));
            else { contextReady = true; schedule(); }
          },
          (err) => contextUnusable(err),
        );
        return;
      }
      contextReady = true;
      schedule();
    },
    started: startedP,
    finished: finishedP,
    generationDone: generationP,
    cancel(reason?: unknown) {
      if (cancelled) return;
      cancelled = true;
      controller.abort(reason);
      const err = abortError(reason);
      stopSources();
      rejectGeneration(err);
      if (!settled) {
        settled = true;
        rejectStarted(err);
        rejectFinished(err);
      }
    },
  };
  return handle;
}
