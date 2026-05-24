import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { selectMediaRecorderMimeType } from "@/services/browserCapabilities";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-whisper`;

/**
 * OpenAI Whisper STT (batch mode).
 * Records mic audio via MediaRecorder, then sends the blob to /proxy-stt-whisper
 * on stop() or flush(). No partial transcripts — only one final per utterance.
 */
export class OpenAIWhisperSTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private _active = false;
  private _paused = false;
  private startedAt = 0;
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
  }

  get isActive() {
    return this._active;
  }
  getStream() {
    return this.stream;
  }
  getLastFinalTelemetry() {
    return this.lastFinalTelemetry;
  }
  setManualMode(_manual: boolean) {
    /* always manual: flush triggers final */
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = selectMediaRecorderMimeType();
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
    this.startedAt = performance.now();
    this._active = true;
    this._paused = false;
    debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Whisper STT recording" });
  }

  pause() {
    this._paused = true;
    try { this.recorder?.pause(); } catch { /* not supported on some browsers */ }
  }

  resume() {
    this._paused = false;
    try { this.recorder?.resume(); } catch { /* ignore */ }
  }

  flush() {
    void this.finalize("ptt_flush");
  }

  async stop() {
    this._active = false;
    await this.finalize("stop");
    try { this.recorder?.stop(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
  }

  private async finalize(trigger: "ptt_flush" | "stop") {
    if (!this.recorder) return;
    try {
      // Force a final dataavailable
      if (this.recorder.state === "recording") {
        await new Promise<void>((resolve) => {
          const handler = () => resolve();
          this.recorder?.addEventListener("dataavailable", handler, { once: true });
          try { this.recorder?.requestData(); } catch { resolve(); }
          setTimeout(resolve, 300);
        });
      }
      const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
      this.chunks = [];
      if (blob.size < 1000) return; // ignore empty
      const text = await this.transcribe(blob);
      if (text) {
        const context = this.getTelemetryContext?.() ?? {};
        const t_stt_ms = Math.max(0, Math.round(performance.now() - this.startedAt));
        this.lastFinalTelemetry = {
          t_stt_ms,
          stt_text_len: text.length,
          trigger,
          provider: "OpenAI Whisper",
          model: "whisper-1",
          language: "fr",
        };
        recordAudioLatency({
          session_id: context.session_id ?? undefined,
          turn_index: context.turn_index ?? undefined,
          direction: "in",
          t_stt_ms,
          stt_text_len: text.length,
          metadata: {
            turn_id: context.turn_id ?? null,
            provider: "OpenAI Whisper",
            model: "whisper-1",
            mode: "batch",
            language: "fr",
            trigger,
          },
        });
        this.onTranscript(text, true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      debugLogger.log({ service: "stt", level: "error", direction: "in", label: "Whisper finalize failed", detail: error.message });
      this.onError?.(error, { provider: "openai_whisper" });
    }
  }

  private async transcribe(blob: Blob): Promise<string> {
    const form = new FormData();
    const ext = (this.mimeType.includes("mp4") ? "mp4" : "webm");
    form.append("file", blob, `audio.${ext}`);
    form.append("language", "fr");
    form.append("model", "whisper-1");
    const res = await fetch(ENDPOINT, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Whisper proxy ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.text || "").trim();
  }
}
