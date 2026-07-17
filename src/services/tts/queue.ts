/**
 * TTS Audio Queue — provider-agnostic sentence queue.
 *
 * Generates and plays sentences sequentially, allowing new sentences to be enqueued
 * while earlier ones play. Maintains stitching context (previous/next) for providers
 * that support it (currently ElevenLabs only — others ignore it).
 */

import { generateSpeech, playAudioBlob, tryCreateStreamingPlayback, type TTSOptions } from "@/services/tts";
import type { TTSStreamPlaybackHandle } from "@/services/tts/types";
import { prepareTextForTTS } from "@/services/tts/textPrep";

/** What a generation resolves to: a full audio Blob, or a gated streaming handle. */
type Playable =
  | { kind: "blob"; blob: Blob }
  | { kind: "stream"; handle: TTSStreamPlaybackHandle };

interface PendingEntry {
  text: string;
  options?: TTSOptions;
  resolvePlayable: (p: Playable) => void;
  rejectPlayable: (e: unknown) => void;
}

interface TTSQueueOptions {
  onError?: (err: Error) => void;
  onFirstPlaybackStart?: (latencyMs: number) => void;
  maxConcurrentGenerations?: number;
}

export class TTSQueue {
  private queue: Promise<void> = Promise.resolve();
  private _cancelled = false;
  private generationCount = 0;
  private playbackCount = 0;
  private failedCount = 0;
  private playbackStartMsTotal = 0;
  private playbackTotalMs = 0;
  private firstEnqueuedAt: number | null = null;
  private firstPlaybackStartMs: number | null = null;
  private generationWallMs = 0;
  private lastSentText = "";
  private pending: PendingEntry[] = [];
  private flushScheduled = false;
  private onError?: (err: Error) => void;
  private onFirstPlaybackStart?: (latencyMs: number) => void;
  private errorReported = false;
  private lastError?: Error;
  private activeGenerations = 0;
  private readonly maxConcurrentGenerations: number;
  private readonly abortController = new AbortController();

  constructor(opts?: TTSQueueOptions) {
    this.onError = opts?.onError;
    this.onFirstPlaybackStart = opts?.onFirstPlaybackStart;
    this.maxConcurrentGenerations = Math.max(1, Math.floor(opts?.maxConcurrentGenerations ?? 2));
  }

  private reportError(err: unknown) {
    if (this.errorReported) return;
    this.errorReported = true;
    const e = err instanceof Error ? err : new Error(String(err));
    try { this.onError?.(e); } catch { /* ignore */ }
  }

  private markFirstPlayback(): void {
    if (this.firstPlaybackStartMs !== null || this.firstEnqueuedAt === null) return;
    this.firstPlaybackStartMs = Math.max(0, Math.round(performance.now() - this.firstEnqueuedAt));
    this.onFirstPlaybackStart?.(this.firstPlaybackStartMs);
  }

  enqueue(text: string, options?: TTSOptions): void {
    if (this._cancelled || !text.trim()) return;
    this.firstEnqueuedAt ??= performance.now();

    let resolvePlayable!: (p: Playable) => void;
    let rejectPlayable!: (e: unknown) => void;
    const playablePromise = new Promise<Playable>((resolve, reject) => {
      resolvePlayable = resolve;
      rejectPlayable = reject;
    });

    this.pending.push({ text: prepareTextForTTS(text), options, resolvePlayable, rejectPlayable });
    this.scheduleFlush();

    this.queue = this.queue.then(async () => {
      if (this._cancelled) return;
      try {
        const playable = await playablePromise;
        if (this._cancelled) {
          if (playable.kind === "stream") playable.handle.cancel();
          return;
        }
        const playStart = performance.now();
        if (playable.kind === "blob") {
          const result = await playAudioBlob(playable.blob, () => this.markFirstPlayback(), this.abortController.signal);
          this.playbackStartMsTotal += result?.playbackStartMs ?? 0;
          this.playbackTotalMs += result?.playbackTotalMs ?? Math.round(performance.now() - playStart);
          this.playbackCount++;
          console.log(`[TTS-Queue] Played sentence #${this.playbackCount} in ${(performance.now() - playStart).toFixed(0)}ms`);
        } else {
          playable.handle.open();
          await playable.handle.started;
          this.markFirstPlayback();
          this.playbackStartMsTotal += Math.round(performance.now() - playStart);
          const result = await playable.handle.finished;
          this.playbackTotalMs += result.playbackTotalMs;
          this.playbackCount++;
          console.log(`[TTS-Queue] Played sentence #${this.playbackCount} (streamed) in ${(performance.now() - playStart).toFixed(0)}ms`);
        }
      } catch (err) {
        if (this._cancelled) return;
        console.error("[TTS-Queue] Error:", err);
        this.failedCount++;
        this.lastError = err instanceof Error ? err : new Error(String(err));
        this.reportError(err);
      }
    });
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flushPending();
    });
  }

  private flushPending(): void {
    while (this.pending.length > 0 && this.activeGenerations < this.maxConcurrentGenerations) {
      const head = this.pending[0];
      const next = this.pending[1];
      const nextText = next?.text;
      this.pending.shift();
      this.activeGenerations++;
      this.startGeneration(head, nextText);
    }
  }

  private startGeneration(entry: PendingEntry, nextText?: string): void {
    if (this._cancelled) {
      entry.rejectPlayable(new Error("TTS queue cancelled"));
      this.activeGenerations--;
      return;
    }
    const previousText = this.lastSentText || undefined;
    this.lastSentText = entry.text;

    const genStart = performance.now();
    const genOptions: TTSOptions = {
      ...entry.options,
      previousText,
      nextText,
      signal: this.abortController.signal,
    };

    // Streaming-capable provider (currently Gradium): generation starts now and
    // buffers behind the handle's closed gate; the chain link opens it in turn.
    const handle = tryCreateStreamingPlayback(entry.text, genOptions);
    if (handle) {
      entry.resolvePlayable({ kind: "stream", handle });
      handle.generationDone
        .then((stats) => {
          this.generationWallMs = Math.max(this.generationWallMs, Math.round(performance.now() - (this.firstEnqueuedAt ?? genStart)));
          this.generationCount++;
          console.log(`[TTS-Queue] Generated #${this.generationCount} in ${(performance.now() - genStart).toFixed(0)}ms transport=${stats.transport} (${entry.text.slice(0, 40)}...)`);
        })
        .catch(() => { /* surfaced by the chain link via started/finished */ })
        .finally(() => {
          this.activeGenerations--;
          if (!this._cancelled) this.scheduleFlush();
        });
      return;
    }

    generateSpeech(entry.text, genOptions)
      .then((blob) => {
        const genTime = performance.now() - genStart;
        this.generationWallMs = Math.max(this.generationWallMs, Math.round(performance.now() - (this.firstEnqueuedAt ?? genStart)));
        this.generationCount++;
        const stitchTag = `${previousText ? "P" : "-"}${nextText ? "N" : "-"}`;
        console.log(`[TTS-Queue] Generated #${this.generationCount} in ${genTime.toFixed(0)}ms stitch=${stitchTag} (${entry.text.slice(0, 40)}...)`);
        entry.resolvePlayable({ kind: "blob", blob });
      })
      .catch(entry.rejectPlayable)
      .finally(() => {
        this.activeGenerations--;
        if (!this._cancelled) this.scheduleFlush();
      });
  }

  async drain(): Promise<{
    status: "played" | "failed" | "cancelled" | "skipped";
    playedSegments: number;
    failedSegments: number;
    generatedSegments: number;
    playbackStartMs: number;
    playbackTotalMs: number;
    firstPlaybackStartMs: number;
    generationWallMs: number;
    error?: Error;
  }> {
    await this.queue;
    const firstPlaybackStartMs = this.firstPlaybackStartMs ?? 0;
    if (this._cancelled) {
      return { status: "cancelled", playedSegments: this.playbackCount, failedSegments: this.failedCount, generatedSegments: this.generationCount, playbackStartMs: this.playbackStartMsTotal, playbackTotalMs: this.playbackTotalMs, firstPlaybackStartMs, generationWallMs: this.generationWallMs, error: this.lastError };
    }
    if (this.failedCount > 0) {
      return { status: "failed", playedSegments: this.playbackCount, failedSegments: this.failedCount, generatedSegments: this.generationCount, playbackStartMs: this.playbackStartMsTotal, playbackTotalMs: this.playbackTotalMs, firstPlaybackStartMs, generationWallMs: this.generationWallMs, error: this.lastError };
    }
    if (this.playbackCount === 0) {
      return { status: "skipped", playedSegments: 0, failedSegments: 0, generatedSegments: this.generationCount, playbackStartMs: 0, playbackTotalMs: 0, firstPlaybackStartMs, generationWallMs: this.generationWallMs };
    }
    return { status: "played", playedSegments: this.playbackCount, failedSegments: 0, generatedSegments: this.generationCount, playbackStartMs: this.playbackStartMsTotal, playbackTotalMs: this.playbackTotalMs, firstPlaybackStartMs, generationWallMs: this.generationWallMs };
  }

  cancel(): void {
    this._cancelled = true;
    this.abortController.abort("tts-queue-cancelled");
    const error = new Error("TTS queue cancelled");
    this.lastError = error;
    while (this.pending.length > 0) {
      const entry = this.pending.shift();
      entry?.rejectPlayable(error);
    }
  }

  get cancelled(): boolean {
    return this._cancelled;
  }
}
