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

export class TTSQueue {
  private queue: Promise<void> = Promise.resolve();
  private _cancelled = false;
  private generationCount = 0;
  private playbackCount = 0;
  private lastSentText = "";
  private pending: PendingEntry[] = [];
  private flushScheduled = false;
  private onError?: (err: Error) => void;
  private errorReported = false;

  constructor(opts?: { onError?: (err: Error) => void }) {
    this.onError = opts?.onError;
  }

  private reportError(err: unknown) {
    if (this.errorReported) return;
    this.errorReported = true;
    const e = err instanceof Error ? err : new Error(String(err));
    try { this.onError?.(e); } catch { /* ignore */ }
  }

  enqueue(text: string, options?: TTSOptions): void {
    if (this._cancelled || !text.trim()) return;

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
        await playAudioBlob(blob);
        this.playbackCount++;
        console.log(`[TTS-Queue] Played sentence #${this.playbackCount} in ${(performance.now() - playStart).toFixed(0)}ms`);
      } catch (err) {
        console.error("[TTS-Queue] Error:", err);
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
        this.generationCount++;
        const stitchTag = `${previousText ? "P" : "-"}${nextText ? "N" : "-"}`;
        console.log(`[TTS-Queue] Generated #${this.generationCount} in ${genTime.toFixed(0)}ms stitch=${stitchTag} (${entry.text.slice(0, 40)}...)`);
        entry.resolveBlob(blob);
      })
      .catch(entry.rejectBlob);
  }

  async drain(): Promise<void> {
    await this.queue;
  }

  cancel(): void {
    this._cancelled = true;
  }

  get cancelled(): boolean {
    return this._cancelled;
  }
}
