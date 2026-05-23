import { debugLogger } from "./debugLogger";
import { recordAudioLatency } from "./latencyTelemetry";
import { createTimeoutSignal, withTimeout } from "./asyncUtils";
import { getBrowserDiagnostics, selectMediaRecorderMimeType } from "./browserCapabilities";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface DeepgramConfig {
  key: string;
  model: string;
  language: string;
}

export async function getDeepgramToken(): Promise<DeepgramConfig> {
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("stt", "Get Deepgram token", `proxy-stt`);
  const timeout = createTimeoutSignal(5000);
  const res = await fetch(
    `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeout.signal,
    }
  ).finally(timeout.cancel);
  if (!res.ok) {
    debugLogger.logResponse(debugId, "stt", "Deepgram token", res.status, startTime);
    throw new Error(`Failed to get Deepgram token: ${res.status}`);
  }
  debugLogger.logResponse(debugId, "stt", "Deepgram token OK", res.status, startTime);
  return res.json();
}

type TranscriptCallback = (text: string, isFinal: boolean) => void;
type STTErrorCallback = (error: Error, context?: Record<string, unknown> | import("./browserCapabilities").BrowserDiagnostics) => void;
type STTTelemetryContext = { session_id?: string | null; turn_id?: string | null; turn_index?: number | null };

export interface STTFinalTelemetry {
  t_stt_ms: number;
  stt_text_len: number;
  trigger: "silence" | "ptt_flush";
  selectedMimeType: string;
  turn_id?: string | null;
  provider?: string;
  model?: string;
  language?: string;
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private onTranscript: TranscriptCallback;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private fullTranscript = "";
  /** Timestamp (performance.now()) du dernier mot reçu — sert à mesurer la latence STT après silence. */
  private lastSpeechAt = 0;
  private static SILENCE_DELAY_MS = 900;
  private _paused = false;
  private onError?: STTErrorCallback;
  private getTelemetryContext?: () => STTTelemetryContext;
  private selectedMimeType = "";
  private lastFinalTelemetry: STTFinalTelemetry | null = null;
  private manualMode = false;
  private config: DeepgramConfig | null = null;

  /** Disable automatic silence-based finalization. Caller must invoke `flush()` to end an utterance. */
  setManualMode(manual: boolean) {
    this.manualMode = manual;
    if (manual && this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }


  constructor(onTranscript: TranscriptCallback, opts?: { onError?: STTErrorCallback; getTelemetryContext?: () => STTTelemetryContext }) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
  }

  get isActive() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Expose the underlying microphone stream (for audio-level visualization) */
  getStream(): MediaStream | null {
    return this.stream;
  }

  getLastFinalTelemetry(): STTFinalTelemetry | null {
    return this.lastFinalTelemetry;
  }

  /** Pause listening (mute) — keeps connection alive */
  pause() {
    this._paused = true;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }

  /** Resume listening after pause */
  resume() {
    this._paused = false;
    this.fullTranscript = "";
  }

  /** Force-finalize current transcript (used by push-to-talk on release) */
  flush() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    const finalText = this.fullTranscript.trim();
    this.fullTranscript = "";
    if (finalText) {
      debugLogger.log({ service: "stt", level: "info", direction: "in", label: `STT flush (PTT): "${finalText.slice(0, 100)}"` });
      this.recordFinalTelemetry(finalText, "ptt_flush");
      this.onTranscript(finalText, true);
    }
  }

  async start() {
    const config = await getDeepgramToken();
    this.config = config;

    // Get microphone
    this.stream = await withTimeout(
      "microphone_permission",
      navigator.mediaDevices.getUserMedia({ audio: true }),
      10000,
    );

    // Connect to Deepgram WebSocket
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=${config.model}&language=${config.language}&smart_format=true&interim_results=true&vad_events=true&endpointing=false`;

    this.ws = new WebSocket(wsUrl, ['token', config.key]);
    const openTimeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        const error = new Error("Deepgram WebSocket open timeout");
        debugLogger.log({ service: "stt", level: "error", direction: "in", label: error.message });
        this.onError?.(error, getBrowserDiagnostics(this.selectedMimeType));
        try { this.ws?.close(); } catch { /* ignore */ }
      }
    }, 8000);

    this.ws.onopen = () => {
      clearTimeout(openTimeout);
      console.log('[Deepgram] WebSocket connected');
      debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Deepgram WebSocket connected" });
      try {
        this.startRecording();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        debugLogger.log({
          service: "stt",
          level: "error",
          direction: "in",
          label: "MediaRecorder start failed",
          detail: error.message,
          payload: JSON.stringify(getBrowserDiagnostics(this.selectedMimeType)),
        });
        this.onError?.(error, getBrowserDiagnostics(this.selectedMimeType));
        this.stop();
      }
    };

    this.ws.onmessage = (event) => {
      if (this._paused) return; // Ignore transcripts while paused

      const data = JSON.parse(event.data);
      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
          const isFinal = data.is_final;
          if (isFinal) {
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcript;
          }
          // Show interim text to user
          const displayText = isFinal ? this.fullTranscript : this.fullTranscript + (this.fullTranscript ? ' ' : '') + transcript;
          this.onTranscript(displayText, false);

          // Track last speech timestamp for STT latency telemetry
          this.lastSpeechAt = performance.now();

          // Reset silence timer on any speech
          this.resetSilenceTimer();
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Deepgram] WebSocket error:', err);
      this.onError?.(new Error("Deepgram WebSocket error"), getBrowserDiagnostics(this.selectedMimeType));
    };

    this.ws.onclose = () => {
      clearTimeout(openTimeout);
      console.log('[Deepgram] WebSocket closed');
    };
  }

  private resetSilenceTimer() {
    if (this.manualMode) return;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.fullTranscript.trim()) {
        console.log('[Deepgram] 2s silence detected, finalizing');
        debugLogger.log({ service: "stt", level: "info", direction: "in", label: `STT final: "${this.fullTranscript.slice(0, 100)}"` });
        const finalText = this.fullTranscript;
        this.recordFinalTelemetry(finalText, "silence");
        this.fullTranscript = ""; // Reset for next utterance
        this.onTranscript(finalText, true);
      }
    }, DeepgramSTT.SILENCE_DELAY_MS);
  }

  private recordFinalTelemetry(finalText: string, trigger: "silence" | "ptt_flush") {
    const context = this.getTelemetryContext?.() ?? {};
    const elapsedSinceSpeech = this.lastSpeechAt > 0 ? performance.now() - this.lastSpeechAt : 0;
    const t_stt_ms = trigger === "silence"
      ? Math.max(0, Math.round(elapsedSinceSpeech - DeepgramSTT.SILENCE_DELAY_MS))
      : Math.max(0, Math.round(elapsedSinceSpeech));
    this.lastFinalTelemetry = {
      t_stt_ms,
      stt_text_len: finalText.length,
      trigger,
      selectedMimeType: this.selectedMimeType,
      turn_id: context.turn_id,
      provider: "Deepgram",
      model: this.config?.model || "nova-2",
      language: this.config?.language || "fr",
    };
    recordAudioLatency({
      session_id: context.session_id ?? undefined,
      turn_index: context.turn_index ?? undefined,
      direction: "in",
      t_stt_ms,
      stt_text_len: finalText.length,
      metadata: {
        turn_id: context.turn_id ?? null,
        provider: "Deepgram",
        model: this.config?.model || "nova-2",
        mode: "realtime",
        language: this.config?.language || "fr",
        silence_window_ms: DeepgramSTT.SILENCE_DELAY_MS,
        trigger,
        selected_mime_type: this.selectedMimeType,
      },
    });
  }

  private startRecording() {
    if (!this.stream || !this.ws) return;

    this.selectedMimeType = selectMediaRecorderMimeType();
    const options = this.selectedMimeType ? { mimeType: this.selectedMimeType } : undefined;
    debugLogger.log({
      service: "stt",
      level: "info",
      direction: "in",
      label: `MediaRecorder selected ${this.selectedMimeType || "browser-default"}`,
      payload: JSON.stringify(getBrowserDiagnostics(this.selectedMimeType)),
    });

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };

    this.mediaRecorder.start(250);
  }

  stop() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stop();
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.fullTranscript = "";
    this._paused = false;
  }
}
