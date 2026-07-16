import { debugLogger } from "./debugLogger";
import { recordAudioLatency } from "./latencyTelemetry";
import { createTimeoutSignal, withTimeout } from "./asyncUtils";
import { getBrowserDiagnostics, selectMediaRecorderMimeType } from "./browserCapabilities";
import { authenticatedFunctionFetch } from "./gameAuth";
import { combineTranscriptParts, requestLatestRecorderData, waitForCondition } from "./stt/finalization";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface DeepgramConfig {
  key: string;
  model: string;
  language: string;
}

/** Temporary tokens returned by /v1/auth/grant are JWTs and use Bearer auth. */
export function getDeepgramWebSocketProtocols(accessToken: string): ["bearer", string] {
  return ["bearer", accessToken];
}

export async function getDeepgramToken(): Promise<DeepgramConfig> {
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("stt", "Get Deepgram token", `proxy-stt`);
  const timeout = createTimeoutSignal(5000);
  const res = await authenticatedFunctionFetch(
    `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeout.signal,
    }
  ).finally(timeout.cancel);
  if (!res.ok) {
    debugLogger.logResponse(debugId, "stt", "Deepgram token", res.status, startTime);
    const payload = await res.json().catch(() => null) as { code?: string; error?: string } | null;
    if (payload?.code === "DEEPGRAM_GRANT_PERMISSION") {
      throw new Error("Deepgram indisponible : la clé doit avoir la permission Member.");
    }
    throw new Error(payload?.error || `Failed to get Deepgram token: ${res.status}`);
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
  private latestInterimTranscript = "";
  private lastResultAt = 0;
  private finalizeAcknowledgedAt = 0;
  private flushPromise: Promise<void> | null = null;
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
  private initialStream?: MediaStream | Promise<MediaStream>;

  /** Disable automatic silence-based finalization. Caller must invoke `flush()` to end an utterance. */
  setManualMode(manual: boolean) {
    this.manualMode = manual;
    if (manual && this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }


  constructor(onTranscript: TranscriptCallback, opts?: { onError?: STTErrorCallback; getTelemetryContext?: () => STTTelemetryContext; initialStream?: MediaStream | Promise<MediaStream> }) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
    this.initialStream = opts?.initialStream;
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
    this.latestInterimTranscript = "";
    if (this.mediaRecorder?.state === "paused") {
      try { this.mediaRecorder.resume(); } catch { /* noop */ }
    }
  }

  /** Force-finalize current transcript (used by push-to-talk on release) */
  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.finalizeCurrentTurn().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async finalizeCurrentTurn(): Promise<void> {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    await requestLatestRecorderData(this.mediaRecorder);
    try { this.mediaRecorder?.pause(); } catch { /* unsupported; finalization still bounded */ }

    const finalizeSentAt = performance.now();
    if (this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ type: "Finalize" })); } catch { /* fallback below */ }
    }

    // Deepgram may omit `from_finalize` when little audio remains, so also
    // accept a short quiet period after the last revised result.
    await waitForCondition(() => {
      if (this.finalizeAcknowledgedAt >= finalizeSentAt) return true;
      const elapsed = performance.now() - finalizeSentAt;
      return elapsed >= 450 && this.lastResultAt > 0 && performance.now() - this.lastResultAt >= 250;
    }, 1500);

    const finalText = combineTranscriptParts(this.fullTranscript, this.latestInterimTranscript);
    this.fullTranscript = "";
    this.latestInterimTranscript = "";
    if (!finalText) return;
    debugLogger.log({ service: "stt", level: "info", direction: "in", label: `STT flush (PTT): "${finalText.slice(0, 100)}"` });
    this.recordFinalTelemetry(finalText, "ptt_flush");
    this.onTranscript(finalText, true);
  }

  async start() {
    // Get microphone first: browsers are stricter when media permission is
    // requested after an awaited network call instead of directly from a user gesture.
    // High-quality mono capture with browser DSP for better STT accuracy.
    const streamPromise = this.initialStream
      ? Promise.resolve(this.initialStream)
      : navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
    this.initialStream = undefined;
    this.stream = await withTimeout(
      "microphone_permission",
      streamPromise,
      10000,
    );

    let config: DeepgramConfig;
    try {
      config = await getDeepgramToken();
      this.config = config;
    } catch (err) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      throw err;
    }

    // Connect to Deepgram WebSocket
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=${config.model}&language=${config.language}&smart_format=true&punctuate=true&filler_words=false&numerals=true&interim_results=true&vad_events=true&endpointing=false`;

    this.ws = new WebSocket(wsUrl, getDeepgramWebSocketProtocols(config.key));
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
        if (data.from_finalize) this.finalizeAcknowledgedAt = performance.now();
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
          this.lastResultAt = performance.now();
          const isFinal = data.is_final;
          if (isFinal) {
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcript;
            this.latestInterimTranscript = "";
          } else {
            this.latestInterimTranscript = transcript;
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
      const finalText = combineTranscriptParts(this.fullTranscript, this.latestInterimTranscript);
      if (finalText) {
        console.log('[Deepgram] 2s silence detected, finalizing');
        debugLogger.log({ service: "stt", level: "info", direction: "in", label: `STT final: "${finalText.slice(0, 100)}"` });
        this.recordFinalTelemetry(finalText, "silence");
        this.fullTranscript = ""; // Reset for next utterance
        this.latestInterimTranscript = "";
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
      model: this.config?.model || "nova-3",
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
        model: this.config?.model || "nova-3",
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
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: 128000,
    };
    if (this.selectedMimeType) options.mimeType = this.selectedMimeType;
    debugLogger.log({
      service: "stt",
      level: "info",
      direction: "in",
      label: `MediaRecorder selected ${this.selectedMimeType || "browser-default"} @128kbps`,
      payload: JSON.stringify(getBrowserDiagnostics(this.selectedMimeType)),
    });

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };

    // Smaller timeslice = lower latency for the interim results loop.
    this.mediaRecorder.start(150);
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
    this.latestInterimTranscript = "";
    this._paused = false;
  }
}
