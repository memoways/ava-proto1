import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { selectMediaRecorderMimeType } from "@/services/browserCapabilities";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { requestLatestRecorderData } from "../finalization";
import { getSTTProviderSettings } from "../providerSettings";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-gradium`;


/**
 * Gradium STT (batch REST). Records mic audio via MediaRecorder and sends the
 * blob to /proxy-stt-gradium on flush()/stop(). One final transcript per utterance.
 */
export class GradiumSTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private _active = false;
  private startedAt = 0;
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;
  private finalizePromise: Promise<void> | null = null;
  private initialStream?: MediaStream | Promise<MediaStream>;

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
    this.initialStream = opts?.initialStream;
  }

  get isActive() { return this._active; }
  getStream() { return this.stream; }
  getLastFinalTelemetry() { return this.lastFinalTelemetry; }
  setManualMode(_manual: boolean) { /* always manual */ }

  async start() {
    this.stream = await Promise.resolve(
      this.initialStream ?? navigator.mediaDevices.getUserMedia({ audio: true }),
    );
    this.initialStream = undefined;
    this.mimeType = selectMediaRecorderMimeType();
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start(250);
    this.startedAt = performance.now();
    this._active = true;
    debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Gradium STT recording" });
  }

  pause() { try { this.recorder?.pause(); } catch { /* ignore */ } }
  resume() { try { this.recorder?.resume(); } catch { /* ignore */ } }
  flush(): Promise<void> { return this.finalize("ptt_flush"); }

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
    if (this.finalizePromise) return this.finalizePromise;
    this.finalizePromise = this.finalizeOnce(trigger).finally(() => {
      this.finalizePromise = null;
    });
    return this.finalizePromise;
  }

  private async finalizeOnce(trigger: "ptt_flush" | "stop") {
    if (!this.recorder) return;
    try {
      await requestLatestRecorderData(this.recorder);
      try { this.recorder.pause(); } catch { /* unsupported; captured tail is already snapshotted */ }
      const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
      this.chunks = [];
      if (blob.size < 1000) return;
      const text = await this.transcribe(blob);
      if (text) {
        const context = this.getTelemetryContext?.() ?? {};
        const t_stt_ms = Math.max(0, Math.round(performance.now() - this.startedAt));
        this.lastFinalTelemetry = {
          t_stt_ms,
          stt_text_len: text.length,
          trigger,
          provider: "Gradium",
          model: "gradium-asr",
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
            provider: "Gradium",
            model: "gradium-asr",
            mode: "batch",
            language: "fr",
            trigger,
          },
        });
        this.onTranscript(text, true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      debugLogger.log({ service: "stt", level: "error", direction: "in", label: "Gradium finalize failed", detail: error.message });
      this.onError?.(error, { provider: "gradium" });
    }
  }

  private async transcribe(blob: Blob): Promise<string> {
    const contentType = blob.type || "audio/webm";
    const g = getSTTProviderSettings("gradium");
    const url = g.language && g.language !== "auto"
      ? `${ENDPOINT}?language=${encodeURIComponent(g.language)}`
      : ENDPOINT;
    const res = await authenticatedFunctionFetch(url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    if (!res.ok) throw new Error(`Gradium proxy ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.text || "").trim();
  }
}
