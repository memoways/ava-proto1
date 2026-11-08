import { AUDIO_PLAYBACK_STALL_DEADLINE_MS } from "@/config/experienceRuntime";

export type PlaybackErrorType = "not_allowed" | "not_supported" | "aborted" | "network" | "stalled" | "unknown";

export interface PlaybackErrorInfo {
  type: PlaybackErrorType;
  name: string;
  message: string;
}

export interface PlaybackResult {
  status: "played" | "failed";
  playbackStartMs?: number;
  playbackTotalMs?: number;
  error?: Error;
  errorInfo?: PlaybackErrorInfo;
}

let audioContext: AudioContext | null = null;
let unlocked = false;
// Set once an <audio> element is refused outside a gesture (iOS Safari in
// hands-free mode): later turns go straight to Web Audio.
let mediaElementAutoplayBlocked = false;

/** True once the browser refused to start an <audio> element without a gesture. */
export function isMediaElementAutoplayBlocked(): boolean {
  return mediaElementAutoplayBlocked;
}

/** Records an autoplay refusal of an <audio> element (see isMediaElementAutoplayBlocked). */
export function noteMediaElementAutoplayBlocked(): void {
  // Only the experience (shared context unlocked by a tap) switches to Web Audio.
  if (unlocked && audioContext) mediaElementAutoplayBlocked = true;
}

function getAudioContext(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) {
    const ctx = new AudioCtx();
    audioContext = ctx;
    // iOS Safari moves the context to "interrupted" when the microphone starts
    // (or after a phone call / Siri); try to bring it back as soon as it happens.
    ctx.addEventListener?.("statechange", () => {
      if ((ctx.state as string) === "interrupted") void ctx.resume().catch(() => { /* next gesture retries */ });
    });
  }
  return audioContext;
}

/** Current state of the shared context (`null` before it exists): "running", "suspended", "interrupted" (iOS) or "closed". */
export function getAudioContextState(): string | null {
  return audioContext?.state ?? null;
}

/** A context that is neither running nor closed produces no sound until it is resumed. */
export function audioContextNeedsResume(ctx: Pick<AudioContext, "state"> | null): boolean {
  return Boolean(ctx) && ctx!.state !== "running" && ctx!.state !== "closed";
}

/** Shared AudioContext (the one unlockAudioPlayback unlocks) for streaming playback. */
export function getSharedAudioContext(): AudioContext | null {
  return getAudioContext();
}

export function classifyPlaybackError(err: unknown): PlaybackErrorInfo {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "UnknownError";
  const message = err instanceof DOMException || err instanceof Error ? err.message : String(err);
  if (name === "NotAllowedError") return { type: "not_allowed", name, message };
  if (name === "NotSupportedError") return { type: "not_supported", name, message };
  if (name === "AbortError") return { type: "aborted", name, message };
  if (name === "TimeoutError" || /stalled/i.test(message)) return { type: "stalled", name, message };
  if (/network/i.test(message)) return { type: "network", name, message };
  return { type: "unknown", name, message };
}

export async function unlockAudioPlayback(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  // Everything below runs synchronously inside the user gesture: iOS only
  // unlocks Web Audio when resume() and a first buffer start within it.
  const resumed = audioContextNeedsResume(ctx) ? ctx.resume() : null;
  const buffer = ctx.createBuffer(1, 1, Math.max(8000, ctx.sampleRate));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  unlocked = true;
  if (resumed) await resumed;
  return true;
}

/**
 * Re-unlocks the shared context on every user gesture while it is not running
 * (mic tap, answer, hang up…). Needed on iOS, where the context stops after
 * the microphone starts and can only be resumed from a gesture. No effect while
 * the context runs (desktop). Returns the uninstall function.
 */
export function installAudioGestureUnlock(target: Pick<Document, "addEventListener" | "removeEventListener"> = document): () => void {
  const onGesture = () => {
    if (audioContext && !audioContextNeedsResume(audioContext)) return;
    void unlockAudioPlayback().catch(() => { /* the next gesture retries */ });
  };
  const events = ["pointerdown", "touchend", "click", "keydown"] as const;
  for (const name of events) target.addEventListener(name, onGesture, { capture: true, passive: true });
  return () => {
    for (const name of events) target.removeEventListener(name, onGesture, { capture: true });
  };
}

export function isAudioPlaybackUnlocked(): boolean {
  return unlocked || audioContext?.state === "running";
}

function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed"));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Plays a blob through the shared AudioContext (decode + buffer source). iOS
 * Safari refuses `<audio>.play()` outside a user gesture (hands-free turns)
 * but lets an unlocked, running context start sources at any time.
 */
export async function playAudioBlobWebAudio(
  blob: Blob,
  onPlaybackStart?: (playbackStartMs: number) => void,
  signal?: AbortSignal,
): Promise<PlaybackResult> {
  const t0 = performance.now();
  const ctx = getAudioContext();
  if (!ctx) {
    const error = new DOMException("Web Audio unavailable", "NotSupportedError");
    return { status: "failed", playbackTotalMs: 0, error, errorInfo: classifyPlaybackError(error) };
  }
  let source: AudioBufferSourceNode | null = null;
  let abortListener: (() => void) | null = null;
  let playbackStartMs: number | undefined;
  try {
    if (signal?.aborted) throw new DOMException("Audio playback aborted", "AbortError");
    if (audioContextNeedsResume(ctx)) await ctx.resume().catch(() => undefined);
    const bytes = await readBlobBytes(blob);
    const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // Callback form: older WebKit has no promise-returning decodeAudioData.
      const maybe = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
      maybe?.then?.(resolve, reject);
    });
    if (signal?.aborted) throw new DOMException("Audio playback aborted", "AbortError");
    await new Promise<void>((resolve, reject) => {
      const node = ctx.createBufferSource();
      source = node;
      node.buffer = buffer;
      node.connect(ctx.destination);
      node.onended = () => resolve();
      abortListener = () => {
        try { node.stop(); } catch { /* already stopped */ }
        reject(new DOMException("Audio playback aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abortListener, { once: true });
      node.start(0);
      playbackStartMs = Math.round(performance.now() - t0);
      onPlaybackStart?.(playbackStartMs);
    });
    return { status: "played", playbackStartMs, playbackTotalMs: Math.round(performance.now() - t0) };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { status: "failed", playbackStartMs, playbackTotalMs: Math.round(performance.now() - t0), error, errorInfo: classifyPlaybackError(err) };
  } finally {
    if (abortListener) signal?.removeEventListener("abort", abortListener);
    if (source) (source as AudioBufferSourceNode).onended = null;
  }
}

export async function playAudioBlobRobust(
  blob: Blob,
  stallTimeoutMs = AUDIO_PLAYBACK_STALL_DEADLINE_MS,
  onPlaybackStart?: (playbackStartMs: number) => void,
  signal?: AbortSignal,
): Promise<PlaybackResult> {
  if (mediaElementAutoplayBlocked) return playAudioBlobWebAudio(blob, onPlaybackStart, signal);
  const result = await playAudioBlobElement(blob, stallTimeoutMs, onPlaybackStart, signal);
  // Refused before any sound, while the experience has unlocked the shared
  // context (call started by a tap): same speech through Web Audio. Elsewhere
  // (admin speech bench) the refusal stays visible.
  if (result.status === "failed" && result.errorInfo?.type === "not_allowed" && result.playbackStartMs === undefined && unlocked && audioContext) {
    mediaElementAutoplayBlocked = true;
    return playAudioBlobWebAudio(blob, onPlaybackStart, signal);
  }
  return result;
}

async function playAudioBlobElement(
  blob: Blob,
  stallTimeoutMs: number,
  onPlaybackStart?: (playbackStartMs: number) => void,
  signal?: AbortSignal,
): Promise<PlaybackResult> {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  const t0 = performance.now();
  let playbackStartMs: number | undefined;
  let abortListener: (() => void) | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  const abortPlayback = () => {
    try { audio.pause(); } catch { /* ignore */ }
  };

  try {
    if (signal?.aborted) {
      throw new DOMException("Audio playback aborted", "AbortError");
    }
    await new Promise<void>((resolve, reject) => {
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = null;
        callback();
      };
      const armStallTimer = () => {
        if (settled) return;
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          const error = new Error(`Audio playback stalled for ${stallTimeoutMs}ms`);
          error.name = "TimeoutError";
          abortPlayback();
          finish(() => reject(error));
        }, stallTimeoutMs);
      };

      audio.onended = () => finish(resolve);
      audio.onerror = () => finish(() => reject(new Error("Audio playback failed")));
      audio.onplaying = armStallTimer;
      audio.ontimeupdate = armStallTimer;
      abortListener = () => {
        abortPlayback();
        finish(() => reject(new DOMException("Audio playback aborted", "AbortError")));
      };
      signal?.addEventListener("abort", abortListener, { once: true });
      armStallTimer();
      audio.play()
        .then(() => {
          if (settled) return;
          playbackStartMs = Math.round(performance.now() - t0);
          onPlaybackStart?.(playbackStartMs);
          armStallTimer();
        })
        .catch((error) => finish(() => reject(error)));
    });
    return { status: "played", playbackStartMs, playbackTotalMs: Math.round(performance.now() - t0) };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { status: "failed", playbackStartMs, playbackTotalMs: Math.round(performance.now() - t0), error, errorInfo: classifyPlaybackError(err) };
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
    if (abortListener) signal?.removeEventListener("abort", abortListener);
    URL.revokeObjectURL(audioUrl);
  }
}
