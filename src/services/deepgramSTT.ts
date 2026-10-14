import { observeVoice, type VoiceObserver } from "./voiceTurnTelemetryV2";
import { debugLogger } from "./debugLogger";
import { recordAudioLatency } from "./latencyTelemetry";
import { createTimeoutSignal, withTimeout } from "./asyncUtils";
import { getBrowserDiagnostics, selectMediaRecorderMimeType } from "./browserCapabilities";
import { authenticatedFunctionFetch } from "./gameAuth";
import { combineTranscriptParts, requestLatestRecorderData, waitForCondition } from "./stt/finalization";
import { DEEPGRAM_DEFAULT_LANGUAGE, DEEPGRAM_DEFAULT_MODEL } from "../../supabase/functions/_shared/deepgramDefaults";
import { getDictionaryTerms } from "./stt/dictionary";
import { getSTTProviderSettings } from "./stt/providerSettings";



const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export interface DeepgramConfig {
  key: string;
  model: string;
  language: string;
}

export function normalizeDeepgramConfig(payload: Partial<DeepgramConfig>): DeepgramConfig {
  if (typeof payload.key !== "string" || !payload.key.trim()) {
    throw new Error("Deepgram token response is missing its temporary access token");
  }
  return {
    key: payload.key,
    model: typeof payload.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : DEEPGRAM_DEFAULT_MODEL,
    language: typeof payload.language === "string" && payload.language.trim()
      ? payload.language.trim()
      : DEEPGRAM_DEFAULT_LANGUAGE,
  };
}

export interface DeepgramUrlOverrides {
  keyterms?: string[];
  smartFormat?: boolean;
  punctuate?: boolean;
  interimResults?: boolean;
  vadEvents?: boolean;
  fillerWords?: boolean;
  numerals?: boolean;
  /** Milliseconds. 0 → send "false" (disabled). */
  endpointing?: number;
  /** Milliseconds. 0 → skip. */
  utteranceEndMs?: number;
  /** Overrides the token-provided model. */
  model?: string;
  /** Overrides the token-provided language. */
  language?: string;
}

export function buildDeepgramWebSocketUrl(
  config: Pick<DeepgramConfig, "model" | "language">,
  options?: DeepgramUrlOverrides,
): string {
  const model = options?.model?.trim() || config.model;
  const language = options?.language?.trim() || config.language;
  const params = new URLSearchParams({
    model,
    language,
    smart_format: (options?.smartFormat ?? true) ? "true" : "false",
    punctuate: (options?.punctuate ?? true) ? "true" : "false",
    filler_words: (options?.fillerWords ?? false) ? "true" : "false",
    numerals: (options?.numerals ?? true) ? "true" : "false",
    interim_results: (options?.interimResults ?? true) ? "true" : "false",
    vad_events: (options?.vadEvents ?? true) ? "true" : "false",
    endpointing: options?.endpointing && options.endpointing > 0 ? String(Math.round(options.endpointing)) : "false",
  });
  if (options?.utteranceEndMs && options.utteranceEndMs > 0) {
    params.set("utterance_end_ms", String(Math.round(options.utteranceEndMs)));
  }
  // Deepgram Nova-3 supports `keyterm` (prompting). The param may repeat; each
  // value is URL-encoded automatically by URLSearchParams. Cap at 100 (upstream
  // hard limit) and skip empties to avoid a 400.
  const keyterms = (options?.keyterms ?? [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .slice(0, 100);
  for (const term of keyterms) params.append("keyterm", term);
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
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
  const payload = await res.json() as Partial<DeepgramConfig>;
  return normalizeDeepgramConfig(payload);
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
  private onVoiceObservation?: VoiceObserver;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private fullTranscript = "";
  private latestInterimTranscript = "";
  private finalizeAcknowledgedAt = Number.NEGATIVE_INFINITY;
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
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private capturePaused = false;
  private flushAudio: Blob[] = [];
  private generation = 0;
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


  constructor(onTranscript: TranscriptCallback, opts?: { onError?: STTErrorCallback; getTelemetryContext?: () => STTTelemetryContext; onVoiceObservation?: VoiceObserver; initialStream?: MediaStream | Promise<MediaStream> }) {
    this.onTranscript = onTranscript;
    this.onVoiceObservation = opts?.onVoiceObservation;
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
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.pause();
    this.fullTranscript = ""; this.latestInterimTranscript = "";
    this.flushAudio = [];
  }

  /** Resume listening after pause */
  resume() {
    if (!this._paused && !this.capturePaused && this.mediaRecorder?.state !== "paused") return;
    this._paused = false;
    this.capturePaused = false;
    this.fullTranscript = "";
    this.latestInterimTranscript = "";
    if (this.mediaRecorder?.state === "paused") {
      try { this.mediaRecorder.resume(); } catch { /* noop */ }
    }
    for (const blob of this.flushAudio.splice(0)) {
      if (this.ws?.readyState !== WebSocket.OPEN) break;
      this.ws.send(blob); observeVoice(this.onVoiceObservation, "last_audio_sent");
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
    const generation = this.generation;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    await requestLatestRecorderData(this.mediaRecorder);
    if (generation !== this.generation) return;
    this.capturePaused = true;

    const finalizeSentAt = performance.now();
    this.finalizeAcknowledgedAt = Number.NEGATIVE_INFINITY;
    if (this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ type: "Finalize" })); observeVoice(this.onVoiceObservation, "flush_sent"); } catch { /* fallback below */ }
    }

    // Only from_finalize acknowledges the submitted audio tail. An interim,
    // even received after Finalize, may still omit its final words. If the
    // provider omits the acknowledgement, retain the full bounded grace period.
    await waitForCondition(() => this.finalizeAcknowledgedAt >= finalizeSentAt || generation !== this.generation, 1500);
    if (generation !== this.generation) return;

    const finalText = combineTranscriptParts(this.fullTranscript, this.latestInterimTranscript);
    this.fullTranscript = "";
    this.latestInterimTranscript = "";
    if (!finalText) return;
    debugLogger.log({ service: "stt", level: "info", direction: "in", label: `STT flush (PTT): "${finalText.slice(0, 100)}"` });
    this.recordFinalTelemetry(finalText, "ptt_flush");
    this.onTranscript(finalText, true);
  }

  async start() {
    const generation = this.generation;
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
    if (generation !== this.generation) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; throw new DOMException("Capture replaced", "AbortError"); }

    let config: DeepgramConfig;
    try {
      config = await getDeepgramToken();
      this.config = config;
    } catch (err) {
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      throw err;
    }
    if (generation !== this.generation) throw new DOMException("Capture replaced", "AbortError");

    // Connect to Deepgram WebSocket with project keyterm dictionary + admin overrides.
    const keyterms = getDictionaryTerms();
    const dg = getSTTProviderSettings("deepgram");
    const wsUrl = buildDeepgramWebSocketUrl(config, {
      keyterms,
      model: dg.model,
      language: dg.language,
      smartFormat: dg.smartFormat,
      punctuate: dg.punctuate,
      interimResults: dg.interimResults,
      vadEvents: dg.vadEvents,
      fillerWords: dg.fillerWords,
      numerals: dg.numerals,
      endpointing: dg.endpointing,
      utteranceEndMs: dg.utteranceEndMs,
    });
    console.info("[Deepgram] Connecting", { model: dg.model || config.model, language: dg.language || config.language, keyterms: keyterms.length });



    this.ws = new WebSocket(wsUrl, getDeepgramWebSocketProtocols(config.key));
    const socket = this.ws;
    const openTimeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        const error = new Error("Deepgram WebSocket open timeout");
        debugLogger.log({ service: "stt", level: "error", direction: "in", label: error.message });
        this.onError?.(error, getBrowserDiagnostics(this.selectedMimeType));
        try { this.ws?.close(); } catch { /* ignore */ }
      }
    }, 8000);

    this.ws.onopen = () => {
      if (this.ws !== socket || this.generation !== generation) return;
      this.keepAliveTimer = setInterval(() => {
        if ((this._paused || this.mediaRecorder?.state === "paused") && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, 3000);
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
      if (this.ws !== socket || this.generation !== generation) return;
      if (this._paused) return; // Ignore transcripts while paused

      const data = JSON.parse(event.data);
      if (data.type === 'Results') {
        if (data.from_finalize && !this.flushPromise) return;
        if (data.from_finalize) {
          this.finalizeAcknowledgedAt = performance.now();
          observeVoice(this.onVoiceObservation, "flush_acknowledged");
        }
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
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
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
      clearTimeout(openTimeout);
      console.log('[Deepgram] WebSocket closed');
      if (this.stream) this.onError?.(new Error("Deepgram STT disconnected"), getBrowserDiagnostics(this.selectedMimeType));
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
      model: this.config?.model || DEEPGRAM_DEFAULT_MODEL,
      language: this.config?.language || DEEPGRAM_DEFAULT_LANGUAGE,
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
        model: this.config?.model || DEEPGRAM_DEFAULT_MODEL,
        mode: "realtime",
        language: this.config?.language || DEEPGRAM_DEFAULT_LANGUAGE,
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
      if (this._paused) return;
      if (this.capturePaused) {
        if (this.flushAudio.length >= 20) { this.onError?.(new Error("Deepgram pending capture exceeded 3 seconds")); return; }
        this.flushAudio.push(event.data); return;
      }
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
        observeVoice(this.onVoiceObservation, "last_audio_sent");
      }
    };

    // Smaller timeslice = lower latency for the interim results loop.
    this.mediaRecorder.start(150);
    observeVoice(this.onVoiceObservation, "capture_started");
    observeVoice(this.onVoiceObservation, "capture_ready");
  }

  stop() {
    this.generation++; this.flushAudio = []; this.capturePaused = false;
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
    if (this.mediaRecorder) this.mediaRecorder.ondataavailable = null;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder?.stop();
    }
    if (this.ws) this.ws.onclose = null;
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
