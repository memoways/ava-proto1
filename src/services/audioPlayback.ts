import { withTimeout } from "@/services/asyncUtils";

export type PlaybackErrorType = "not_allowed" | "not_supported" | "aborted" | "network" | "unknown";

export interface PlaybackErrorInfo {
  type: PlaybackErrorType;
  name: string;
  message: string;
}

export interface PlaybackResult {
  status: "played" | "failed";
  error?: Error;
  errorInfo?: PlaybackErrorInfo;
}

let audioContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  return audioContext;
}

export function classifyPlaybackError(err: unknown): PlaybackErrorInfo {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "UnknownError";
  const message = err instanceof DOMException || err instanceof Error ? err.message : String(err);
  if (name === "NotAllowedError") return { type: "not_allowed", name, message };
  if (name === "NotSupportedError") return { type: "not_supported", name, message };
  if (name === "AbortError") return { type: "aborted", name, message };
  if (/network/i.test(message)) return { type: "network", name, message };
  return { type: "unknown", name, message };
}

export async function unlockAudioPlayback(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume();

  const buffer = ctx.createBuffer(1, 1, Math.max(8000, ctx.sampleRate));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  unlocked = true;
  return true;
}

export function isAudioPlaybackUnlocked(): boolean {
  return unlocked || audioContext?.state === "running";
}

export async function playAudioBlobRobust(blob: Blob, timeoutMs = 20000): Promise<PlaybackResult> {
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);

  try {
    await withTimeout("audio_playback", new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.play().catch(reject);
    }), timeoutMs, () => {
      try { audio.pause(); } catch { /* ignore */ }
    });
    return { status: "played" };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { status: "failed", error, errorInfo: classifyPlaybackError(err) };
  } finally {
    URL.revokeObjectURL(audioUrl);
  }
}
