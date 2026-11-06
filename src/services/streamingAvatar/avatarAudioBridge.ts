import { getTTSSettings } from "@/services/settingsService";
import { generateSpeech } from "@/services/tts";
import { getActiveProviderId, resolveGradiumSettings } from "@/services/tts/providerSettings";
import { chunkTextForTTS } from "@/services/tts/textChunking";
import type { TTSProviderId } from "@/services/tts/types";
import { pcm16BytesToFloat, rawPcmRate, speechToLemonSliceChunks } from "./lemonSliceAudio";
import type { ResponseOutputTurnContext } from "./types";

/**
 * Shared bridge for avatars that animate Ava's own voice (LemonSlice, Tavus Echo audio): each
 * line is synthesized by Ava's TTS (character voice, active engine and settings), decoded to
 * mono PCM16 at the provider rate and handed over in fixed-size chunks, one line ahead.
 */

export interface AvatarAudioProgress {
  lines: number;
  sentChunks: number;
  /** `performance.now()` of the first chunk handed over; 0 before. */
  firstSentAt: number;
  /** Duration of the audio handed over, in milliseconds. */
  sentAudioMs: number;
}

export function createAvatarAudioProgress(): AvatarAudioProgress {
  return { lines: 0, sentChunks: 0, firstSentAt: 0, sentAudioMs: 0 };
}

export interface StreamAvatarSpeechOptions {
  text: string;
  context?: ResponseOutputTurnContext;
  sampleRate: number;
  chunkMs: number;
  /** Aborted by an interruption: the TTS request in flight is not awaited. */
  signal: AbortSignal;
  speechStartTimeoutMs: number;
  /** Provider name for error messages ("LemonSlice", "Tavus"). */
  label: string;
  /** Hands one chunk to the provider; `final` marks the last chunk of the turn. False = closed. */
  sendChunk: (pcm: Int16Array, final: boolean) => boolean;
  onFirstChunk?: () => void;
  isAlive?: () => boolean;
  progress: AvatarAudioProgress;
}

/**
 * Synthesizes and sends a whole turn. Throws on TTS failure, closed transport or abort;
 * `progress.sentChunks` tells the caller whether audio already reached the provider.
 */
export async function streamAvatarSpeech(options: StreamAvatarSpeechOptions): Promise<void> {
  const { context, signal, progress } = options;
  const providerId = context?.providerId ?? getActiveProviderId();
  const lines = planAvatarSpeechLines(options.text, providerId);
  progress.lines = lines.length;
  const assertAlive = () => {
    if (signal.aborted || options.isAlive?.() === false) {
      throw new DOMException("Avatar turn aborted", "AbortError");
    }
  };
  const send = (pcm: Int16Array, final: boolean) => {
    if (!options.sendChunk(pcm, final)) throw new Error(`${options.label} audio bridge is closed`);
    progress.sentChunks++;
    progress.sentAudioMs += (pcm.length / options.sampleRate) * 1000;
    if (progress.sentChunks === 1) {
      progress.firstSentAt = performance.now();
      options.onFirstChunk?.();
    }
  };
  // One line ahead: the next segment is synthesized while the current one is sent.
  let next = prefetchLine(lines, 0, providerId, options);
  for (let index = 0; index < lines.length; index++) {
    const chunks = await withDeadline(
      abortable(next, signal),
      avatarTtsDeadline(index, options.speechStartTimeoutMs),
      `Ava TTS did not answer for ${options.label}`,
    );
    if (index + 1 < lines.length) next = prefetchLine(lines, index + 1, providerId, options);
    assertAlive();
    const lastLine = index === lines.length - 1;
    for (let chunk = 0; chunk < chunks.length; chunk++) {
      send(chunks[chunk], lastLine && chunk === chunks.length - 1);
    }
    // A silent last line still closes the turn for providers that read `final`.
    if (lastLine && chunks.length === 0 && progress.sentChunks > 0) send(new Int16Array(0), true);
  }
}

/** Same segmentation as Ava's TTS queue; Gradium takes longer segments. */
export function planAvatarSpeechLines(text: string, providerId: TTSProviderId): string[] {
  return chunkTextForTTS(text, providerId === "gradium" ? { maxSingleChars: 320, targetChars: 320 } : undefined);
}

/** The first line gates the speech start (fallback deadline); later lines were prefetched. */
export function avatarTtsDeadline(index: number, speechStartTimeoutMs: number): number {
  return index === 0 ? Math.max(speechStartTimeoutMs, 8_000) : 30_000;
}

function prefetchLine(
  lines: string[],
  index: number,
  providerId: TTSProviderId,
  options: StreamAvatarSpeechOptions,
): Promise<Int16Array[]> {
  const pending = synthesizeLine(lines, index, providerId, options);
  void pending.catch(() => {}); // Observed by the loop, or dropped after an interruption.
  return pending;
}

async function synthesizeLine(
  lines: string[],
  index: number,
  providerId: TTSProviderId,
  { context, signal, sampleRate, chunkMs }: StreamAvatarSpeechOptions,
): Promise<Int16Array[]> {
  const blob = await generateSpeech(lines[index], {
    previousText: lines[index - 1],
    nextText: lines[index + 1],
    session_id: context?.sessionId,
    turn_id: context?.turnId,
    turn_index: context?.turnIndex,
    attempt_id: context?.attemptId,
    voiceId: context?.voiceId,
    providerId,
    characterOverride: context?.providerId != null,
    characterKey: context?.characterKey,
    performance: context?.performance,
    cacheOpening: context?.cacheOpening,
    onVoiceObservation: context?.onVoiceObservation,
    onServiceObserved: context?.onServiceObserved,
    signal,
  });
  return decodeSpeech(blob, speechFormat(providerId, context?.characterKey), sampleRate, chunkMs);
}

/** Raw `pcm_*` output of the active TTS settings, if any (containers are decoded instead). */
export function speechFormat(providerId: TTSProviderId, characterKey?: string): string | null {
  try {
    if (providerId === "elevenlabs") return getTTSSettings().outputFormat;
    if (providerId === "gradium") return resolveGradiumSettings(characterKey).outputFormat;
  } catch {
    // Settings unavailable: let the browser decode the container.
  }
  return null;
}

export async function decodeSpeech(
  blob: Blob,
  format: string | null,
  targetRate: number,
  chunkMs: number,
): Promise<Int16Array[]> {
  const bytes = await blob.arrayBuffer();
  const pcmRate = rawPcmRate(format);
  if (pcmRate) return speechToLemonSliceChunks([pcm16BytesToFloat(bytes)], pcmRate, targetRate, chunkMs);
  let context: OfflineAudioContext;
  try {
    // Decoding into a context at the session rate lets the browser resample.
    context = new OfflineAudioContext(1, 1, targetRate);
  } catch {
    context = new OfflineAudioContext(1, 1, 48_000);
  }
  const buffer = await context.decodeAudioData(bytes);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return speechToLemonSliceChunks(channels, buffer.sampleRate, targetRate, chunkMs);
}

/** An interruption must not wait for the TTS request in flight. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Avatar turn aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Avatar turn aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function withDeadline<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
