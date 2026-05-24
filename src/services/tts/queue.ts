/**
 * TTS Audio Queue — provider-agnostic sentence queue.
 *
 * Generates and plays sentences sequentially, allowing new sentences to be enqueued
 * while earlier ones play. Maintains stitching context (previous/next) for providers
 * that support it (currently ElevenLabs only — others ignore it).
 */

import { generateSpeech, playAudioBlob, type TTSOptions } from "@/services/tts";
import { prepareTextForTTS } from "@/services/tts/textPrep";

interface PendingEntry {
  text: string;
  options?: TTSOptions;
  resolveBlob: (b: Blob) => void;
  rejectBlob: (e: unknown) => void;
}

interface TTSQueueOptions {
  onError?: (err: Error) => void;
  onFirstPlaybackStart?: (latencyMs: number) => void;
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

  constructor(opts?: TTSQueueOptions) {
    this.onError = opts?.onError;
    this.onFirstPlaybackStart = opts?.onFirstPlaybackStart;
  }

  private reportError(err: unknown) {
    if (this.errorReported) return;
    this.errorReported = true;
    const e = err instanceof Error ? err : new Error(String(err));
    try { this.onError?.(e); } catch { /* ignore */ }
  }

  enqueue(text: string, options?: TTSOptions): void {
    if (this._cancelled || !text.trim()) return;
    this.firstEnqueuedAt ??= performance.now();

    let resolveBlob!: (b: Blob) => void;
    let rejectBlob!: (e: unknown) => void;
    const blobPromise = new Promise<Blob>((resolve, reject) => {
      resolveBlob = resolve;
      rejectBlob = reject;
    });

    this.pending.push({ text: prepareTextForTTS(text), options, resolveBlob, rejectBlob });
    this.scheduleFlush();

    this.queue = this.queue.then(async () => {
      if (this._cancelled) return;
      try {
        const blob = await blobPromise;
        if (this._cancelled) return;
        const playStart = performance.now();
        const result = await playAudioBlob(blob, () => {
          if (this.firstPlaybackStartMs !== null || this.firstEnqueuedAt === null) return;
          this.firstPlaybackStartMs = Math.max(0, Math.round(performance.now() - this.firstEnqueuedAt));
          this.onFirstPlaybackStart?.(this.firstPlaybackStartMs);
        });
        this.playbackStartMsTotal += result?.playbackStartMs ?? 0;
        this.playbackTotalMs += result?.playbackTotalMs ?? Math.round(performance.now() - playStart);
        this.playbackCount++;
        console.log(`[TTS-Queue] Played sentence #${this.playbackCount} in ${(performance.now() - playStart).toFixed(0)}ms`);
      } catch (err) {
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
    while (this.pending.length > 0) {
      const head = this.pending[0];
      const next = this.pending[1];
      const nextText = next?.text;
      this.pending.shift();
      this.startGeneration(head, nextText);
    }
  }

  private startGeneration(entry: PendingEntry, nextText?: string): void {
    if (this._cancelled) {
      entry.rejectBlob(new Error("TTS queue cancelled"));
      return;
    }
    const previousText = this.lastSentText || undefined;
    this.lastSentText = entry.text;

    const genStart = performance.now();
    generateSpeech(entry.text, {
      ...entry.options,
      previousText,
      nextText,
    })
      .then((blob) => {
        const genTime = performance.now() - genStart;
        this.generationWallMs = Math.max(this.generationWallMs, Math.round(performance.now() - (this.firstEnqueuedAt ?? genStart)));
        this.generationCount++;
        const stitchTag = `${previousText ? "P" : "-"}${nextText ? "N" : "-"}`;
        console.log(`[TTS-Queue] Generated #${this.generationCount} in ${genTime.toFixed(0)}ms stitch=${stitchTag} (${entry.text.slice(0, 40)}...)`);
        entry.resolveBlob(blob);
      })
      .catch(entry.rejectBlob);
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
    const error = new Error("TTS queue cancelled");
    this.lastError = error;
    while (this.pending.length > 0) {
      const entry = this.pending.shift();
      entry?.rejectBlob(error);
    }
  }

  get cancelled(): boolean {
    return this._cancelled;
  }
}
