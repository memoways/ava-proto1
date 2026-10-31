/**
 * Progressive ElevenLabs playback (lot L1.1).
 *
 * `proxy-tts` already relays the ElevenLabs `/stream` MP3 body chunked; this
 * handle feeds those chunks into a MediaSource attached to an <audio> element,
 * so speech starts on the first bytes instead of after the whole MP3.
 *
 * Contract (same as Gradium's handle, see TTSStreamPlaybackHandle):
 *  - generation starts on creation, playback waits for `open()`;
 *  - any failure before audio is audible falls back to the blob path
 *    (the bytes already received, or one REST request if none arrived);
 *  - after audio is audible, failures are surfaced, never replayed;
 *  - `cancel()` stops the request and the audio at once (barge-in).
 */

import { AUDIO_PLAYBACK_STALL_DEADLINE_MS } from "@/config/experienceRuntime";
import { playAudioBlobRobust } from "@/services/audioPlayback";
import { debugLogger } from "@/services/debugLogger";
import { observeVoice } from "@/services/voiceTurnTelemetryV2";
import type {
  TTSGenerateContext,
  TTSGenerateResult,
  TTSStreamGenerationStats,
  TTSStreamPlaybackHandle,
} from "./types";

const MP3_MIME = "audio/mpeg";

type MediaSourceCtor = typeof MediaSource;

/** ManagedMediaSource (iOS 17.1+) first, then MediaSource; null when MP3 cannot be streamed. */
export function resolveMp3MediaSource(): MediaSourceCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ManagedMediaSource?: MediaSourceCtor; MediaSource?: MediaSourceCtor };
  for (const ctor of [w.ManagedMediaSource, w.MediaSource]) {
    try {
      if (ctor && typeof ctor.isTypeSupported === "function" && ctor.isTypeSupported(MP3_MIME)) return ctor;
    } catch { /* try the next one */ }
  }
  return null;
}

export interface ElevenLabsStreamDeps {
  /** Opens the HTTP stream; rejects on HTTP error or header timeout. */
  request: (signal: AbortSignal, debugId: string, startTime: number) => Promise<Response>;
  /** Full REST generation, used only when no byte arrived before a failure. */
  generateBlob: () => Promise<TTSGenerateResult>;
  model: string;
  label: string;
  mediaSource?: MediaSourceCtor | null;
  createAudio?: () => HTMLAudioElement;
  playBlob?: typeof playAudioBlobRobust;
  stallTimeoutMs?: number;
}

function abortError(reason?: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException(typeof reason === "string" ? reason : "ElevenLabs stream cancelled", "AbortError");
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** A client error other than rate limiting will fail the same way over REST. */
function canRetryOverRest(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode;
  return !(status && status >= 400 && status < 500 && status !== 429);
}

export function createElevenLabsStreamingPlayback(
  ctx: TTSGenerateContext | undefined,
  deps: ElevenLabsStreamDeps,
): TTSStreamPlaybackHandle {
  const t0 = performance.now();
  const startTime = Date.now();
  const controller = new AbortController();
  const playBlob = deps.playBlob ?? playAudioBlobRobust;
  const stallTimeoutMs = deps.stallTimeoutMs ?? AUDIO_PLAYBACK_STALL_DEADLINE_MS;
  const MS = deps.mediaSource === undefined ? resolveMp3MediaSource() : deps.mediaSource;

  let mode: "mse" | "fallback" = MS ? "mse" : "fallback";
  let openRequested = false;
  let openedAt = 0;
  let cancelled = false;
  let audible = false;
  let settled = false;
  let streamDone = false;
  let streamFailed: unknown = null;
  let statusCode: number | undefined;
  let firstByteMs: number | undefined;
  const chunks: Uint8Array[] = [];

  let resolveStarted!: () => void, rejectStarted!: (e: unknown) => void;
  let resolveFinished!: (v: { playbackTotalMs: number }) => void, rejectFinished!: (e: unknown) => void;
  let resolveGeneration!: (v: TTSStreamGenerationStats) => void, rejectGeneration!: (e: unknown) => void;
  const startedP = new Promise<void>((res, rej) => { resolveStarted = res; rejectStarted = rej; });
  const finishedP = new Promise<{ playbackTotalMs: number }>((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  const generationP = new Promise<TTSStreamGenerationStats>((res, rej) => { resolveGeneration = res; rejectGeneration = rej; });
  startedP.catch(() => {});
  finishedP.catch(() => {});
  generationP.catch(() => {});

  const failAll = (err: unknown) => {
    if (settled) return;
    settled = true;
    rejectStarted(err);
    rejectGeneration(err);
    rejectFinished(err);
    teardownMse();
  };

  // ---- MediaSource playback -------------------------------------------------
  let audio: HTMLAudioElement | null = null;
  let mediaSource: MediaSource | null = null;
  let sourceBuffer: SourceBuffer | null = null;
  let objectUrl: string | null = null;
  let appended = 0;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  function clearStall() {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
  }

  function armStall() {
    if (settled || cancelled || mode !== "mse" || !openRequested) return;
    clearStall();
    stallTimer = setTimeout(() => {
      const error = new Error(`ElevenLabs stream playback stalled for ${stallTimeoutMs}ms`);
      error.name = "TimeoutError";
      mseFailed(error);
    }, stallTimeoutMs);
  }

  /** `stop` is false after a natural end: nothing is playing, only resources are released. */
  function teardownMse(stop = true) {
    clearStall();
    if (audio) {
      audio.onplaying = audio.ontimeupdate = audio.onended = audio.onerror = null;
      if (stop) {
        try { audio.pause(); } catch { /* ignore */ }
        try { audio.removeAttribute("src"); audio.load(); } catch { /* ignore */ }
      }
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    audio = null;
    mediaSource = null;
    sourceBuffer = null;
  }

  function pump() {
    if (mode !== "mse" || !sourceBuffer || sourceBuffer.updating || !mediaSource) return;
    try {
      if (appended < chunks.length) {
        sourceBuffer.appendBuffer(chunks[appended++]);
      } else if (streamDone && mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }
    } catch (err) {
      mseFailed(err);
    }
  }

  function setupMse() {
    if (!MS) return;
    try {
      audio = deps.createAudio ? deps.createAudio() : new Audio();
      // Required by ManagedMediaSource; harmless for MediaSource.
      (audio as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
      audio.preload = "auto";
      mediaSource = new MS();
      objectUrl = URL.createObjectURL(mediaSource);
      mediaSource.addEventListener("sourceopen", () => {
        if (mode !== "mse" || !mediaSource) return;
        try {
          sourceBuffer = mediaSource.addSourceBuffer(MP3_MIME);
          sourceBuffer.addEventListener("updateend", pump);
          sourceBuffer.addEventListener("error", () => mseFailed(new Error("ElevenLabs SourceBuffer error")));
          pump();
        } catch (err) {
          mseFailed(err);
        }
      }, { once: true });
      audio.onplaying = () => {
        if (settled || mode !== "mse") return;
        armStall();
        if (audible) return;
        audible = true;
        observeVoice(ctx?.onVoiceObservation, "audio_scheduled");
        resolveStarted();
      };
      audio.ontimeupdate = armStall;
      audio.onended = () => {
        if (settled || mode !== "mse") return;
        settled = true;
        const playbackTotalMs = Math.round(performance.now() - openedAt);
        teardownMse(false);
        // Playback cannot be complete before every byte arrived: callers compare
        // played and generated segments once `finished` settles.
        generationP.then(() => resolveFinished({ playbackTotalMs }), rejectFinished);
      };
      audio.onerror = () => mseFailed(new Error("ElevenLabs stream playback failed"));
      audio.src = objectUrl;
    } catch (err) {
      mseFailed(err);
    }
  }

  /** MediaSource failure: before audio, switch to the blob; after, surface it. */
  function mseFailed(err: unknown) {
    if (mode !== "mse" || settled || cancelled) return;
    if (audible) {
      settled = true;
      rejectFinished(err);
      teardownMse();
      return;
    }
    console.warn(`[TTS-EL] Progressive playback unavailable (${err instanceof Error ? err.message.slice(0, 120) : String(err)}); playing the full MP3`);
    mode = "fallback";
    teardownMse();
    if (streamDone && openRequested) launchBlobPlayback();
  }

  // ---- Blob fallback --------------------------------------------------------
  let fallbackBlob: Blob | null = null;
  let blobLaunched = false;

  function launchBlobPlayback() {
    if (blobLaunched || cancelled || settled) return;
    if (!fallbackBlob && streamDone && !streamFailed) fallbackBlob = new Blob(chunks, { type: MP3_MIME });
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
      if (result.status === "played") {
        settled = true;
        resolveFinished({ playbackTotalMs: result.playbackTotalMs ?? Math.round(performance.now() - playStart) });
        return;
      }
      const error = result.error || new Error("Audio playback failed");
      (error as Error & { playbackErrorType?: string }).playbackErrorType = result.errorInfo?.type;
      settled = true;
      rejectStarted(error);
      rejectFinished(error);
    });
  }

  // ---- Generation -----------------------------------------------------------
  const stats = (transport: TTSStreamGenerationStats["transport"]): TTSStreamGenerationStats => ({
    provider: "elevenlabs", model: deps.model, transport, statusCode: statusCode ?? 200,
    firstByteMs, totalMs: Math.round(performance.now() - t0),
  });

  async function generate() {
    const debugId = debugLogger.logFetch("tts", deps.label, "proxy-tts (stream)");
    let response: Response;
    try {
      response = await deps.request(controller.signal, debugId, startTime);
    } catch (err) {
      if (cancelled || isAbort(err) || ctx?.signal?.aborted) { failAll(abortError(err)); return; }
      if (!canRetryOverRest(err)) { failAll(err); return; }
      console.warn(`[TTS-EL] Stream request failed (${err instanceof Error ? err.message.slice(0, 120) : String(err)}); retrying over REST`);
      mode = "fallback";
      teardownMse();
      try {
        const result = await deps.generateBlob();
        if (cancelled) return;
        fallbackBlob = result.blob;
        statusCode = result.meta.statusCode;
        firstByteMs = Math.round(performance.now() - t0);
        streamDone = true;
        resolveGeneration(stats("rest_fallback"));
        if (openRequested) launchBlobPlayback();
      } catch (restErr) {
        failAll(restErr);
      }
      return;
    }
    statusCode = response.status;
    if (!response.body) {
      // No readable stream (old engine): the whole body is the blob path.
      mode = "fallback";
      teardownMse();
      try {
        fallbackBlob = await response.blob();
      } catch (err) {
        failAll(cancelled ? abortError(err) : err);
        return;
      }
      firstByteMs = Math.round(performance.now() - t0);
      streamDone = true;
      resolveGeneration(stats("rest_fallback"));
      if (openRequested) launchBlobPlayback();
      return;
    }
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled) return;
        if (!value?.byteLength) continue;
        if (firstByteMs === undefined) {
          firstByteMs = Math.round(performance.now() - t0);
          observeVoice(ctx?.onVoiceObservation, "first_audio_chunk");
        }
        chunks.push(value);
        pump();
      }
    } catch (err) {
      streamFailed = err;
      if (cancelled || isAbort(err) || ctx?.signal?.aborted) { failAll(abortError(err)); return; }
      // Bytes already played cannot be replayed: surface the cut.
      if (audible) {
        settled = true;
        rejectGeneration(err);
        rejectFinished(err);
        teardownMse();
        return;
      }
      failAll(err);
      return;
    } finally {
      reader.releaseLock?.();
    }
    if (cancelled) return;
    streamDone = true;
    debugLogger.logResponse(debugId, "tts", `TTS-EL stream (${(chunks.reduce((n, c) => n + c.byteLength, 0) / 1024).toFixed(0)}KB)`, statusCode ?? 200, startTime);
    observeVoice(ctx?.onVoiceObservation, "audio_blob_ready");
    resolveGeneration(stats(mode === "mse" ? "http_stream" : "rest_fallback"));
    if (mode === "mse") pump();
    else if (openRequested) launchBlobPlayback();
  }

  const onParentAbort = () => handle.cancel(ctx?.signal?.reason);
  if (ctx?.signal?.aborted) queueMicrotask(onParentAbort);
  else ctx?.signal?.addEventListener("abort", onParentAbort, { once: true });
  finishedP.finally(() => ctx?.signal?.removeEventListener("abort", onParentAbort)).catch(() => {});

  setupMse();
  void generate();

  const handle: TTSStreamPlaybackHandle = {
    open() {
      if (openRequested || cancelled) return;
      openRequested = true;
      openedAt = performance.now();
      if (mode === "fallback") { launchBlobPlayback(); return; }
      armStall();
      audio?.play().catch((err) => {
        // Autoplay refusal would refuse the blob too; anything else gets the blob.
        if (err instanceof DOMException && err.name === "NotAllowedError") failAll(err);
        else if (!isAbort(err)) mseFailed(err);
      });
    },
    started: startedP,
    finished: finishedP,
    generationDone: generationP,
    cancel(reason?: unknown) {
      if (cancelled) return;
      cancelled = true;
      controller.abort(reason);
      const err = abortError(reason);
      teardownMse();
      if (!settled) {
        settled = true;
        rejectStarted(err);
        rejectGeneration(err);
        rejectFinished(err);
      }
    },
  };
  return handle;
}
