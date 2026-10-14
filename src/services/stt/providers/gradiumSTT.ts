import { observeVoice } from "../../voiceTurnTelemetryV2";
import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { waitForCondition } from "../finalization";
import { getSTTProviderSettings } from "../providerSettings";
import { createPcmCapture, pcmBase64 } from "../pcmCapture";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-gradium`;
const GRADIUM_WS_URL = "wss://api.gradium.ai/api/speech/asr";
const TARGET_SAMPLE_RATE = 24_000;
const GRADIUM_DELAY_IN_FRAMES = 10;
const FLUSH_TIMEOUT_MS = 2500;


/**
 * Gradium STT realtime WebSocket. The browser gets a single-use Gradium token
 * from our Edge Function, then streams 16-bit mono PCM chunks directly to
 * Gradium so text messages can be rendered while the user is still speaking.
 */
export class GradiumSTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onVoiceObservation?: STTCreateOptions["onVoiceObservation"];
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];
  private stream: MediaStream | null = null;
  private ws: WebSocket | null = null;
  private capture: Awaited<ReturnType<typeof createPcmCapture>> | null = null;
  private _active = false;
  private _paused = false;
  private capturePaused = false;
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastMessageAt = 0;
  private flushAckAt = 0;
  private flushId = 0;
  private acknowledgedFlushId = 0;
  private awaitingReady: (() => void) | null = null;
  private ready = false;
  private generation = 0;
  private sentSamples = 0;
  private retiredThrough = 0;
  private flushThrough = 0;
  private flushAudio: Float32Array[] = [];
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;
  private flushPromise: Promise<void> | null = null;
  private initialStream?: MediaStream | Promise<MediaStream>;
  private textParts: string[] = [];

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onVoiceObservation = opts?.onVoiceObservation;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
    this.initialStream = opts?.initialStream;
  }

  get isActive() { return this._active; }
  getStream() { return this.stream; }
  getLastFinalTelemetry() { return this.lastFinalTelemetry; }
  setManualMode(_manual: boolean) { /* Gradium turn finalization is controlled by flush(). */ }

  async start() {
    const startingGeneration = this.generation;
    const tokenRes = await authenticatedFunctionFetch(ENDPOINT, { method: "GET" });
    if (!tokenRes.ok) throw new Error(`Gradium token ${tokenRes.status}: ${await tokenRes.text()}`);
    const { token } = await tokenRes.json();
    if (!token) throw new Error("Gradium token missing");
    if (startingGeneration !== this.generation) throw new DOMException("Capture replaced", "AbortError");

    this.stream = await Promise.resolve(
      this.initialStream ?? navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
    );
    this.initialStream = undefined;
    if (startingGeneration !== this.generation) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; throw new DOMException("Capture replaced", "AbortError"); }

    const wsUrl = new URL(GRADIUM_WS_URL);
    wsUrl.searchParams.set("token", token);
    this.ws = new WebSocket(wsUrl);
    const socket = this.ws;
    const generation = this.generation;
    socket.onmessage = event => { if (this.ws === socket && this.generation === generation) this.handleMessage(event); };

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Gradium WS open timeout")), 8000);
      this.ws!.onopen = () => {
        window.clearTimeout(timeout);
        const g = getSTTProviderSettings("gradium");
        const jsonConfig: Record<string, unknown> = { delay_in_frames: GRADIUM_DELAY_IN_FRAMES };
        if (g.language && g.language !== "auto") jsonConfig.language = g.language;
        this.ws!.send(JSON.stringify({
          type: "setup",
          model_name: "default",
          input_format: "pcm",
          json_config: jsonConfig,
        }));
        resolve();
      };
      this.ws!.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Gradium WS error"));
      };
    });

    if (!this.ready) await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { this.awaitingReady = null; reject(new Error("Gradium ready timeout")); }, 8000);
      this.awaitingReady = () => { clearTimeout(timeout); this.awaitingReady = null; resolve(); };
    });
    if (this.generation !== generation) throw new DOMException("Capture replaced", "AbortError");
    this.ws.onerror = () => this.onError?.(new Error("Gradium WS error"), { provider: "gradium" });
    this.ws.onclose = () => {
      if (this._active) this.onError?.(new Error("Gradium STT disconnected"), { provider: "gradium" });
    };

    const capture = await createPcmCapture(this.stream, TARGET_SAMPLE_RATE, 1920, samples => {
      if (this._paused || this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.capturePaused) {
        if (this.flushAudio.length >= 40) { this.onError?.(new Error("Gradium pending capture exceeded 3.2 seconds")); return; }
        this.flushAudio.push(samples); return;
      }
      this.ws.send(JSON.stringify({ type: "audio", audio: pcmBase64(samples) }));
      this.sentSamples += samples.length;
      observeVoice(this.onVoiceObservation, "last_audio_sent");
    }, error => { if (this.generation === generation) this.onError?.(error, { provider: "gradium" }); });
    if (this.generation !== generation || this.ws !== socket) { capture.stop(); throw new DOMException("Capture replaced", "AbortError"); }
    this.capture = capture;
    observeVoice(this.onVoiceObservation, "capture_started");
    observeVoice(this.onVoiceObservation, "capture_ready");

    this.startedAt = performance.now();
    this._active = true;
    this._paused = false;
    this.capturePaused = false;
    debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Gradium STT realtime connected" });
  }

  pause() { this._paused = true; this.capturePaused = true; this.retiredThrough = this.sentSamples / TARGET_SAMPLE_RATE; this.flushAudio = []; this.capture?.enabled(false); }
  resume() {
    if (!this._paused && !this.capturePaused) return; // Output completion must not erase a live utterance.
    this._paused = false;
    this.capturePaused = false;
    this.resetTranscriptBuffers();
    this.retiredThrough = Math.max(this.retiredThrough, this.flushThrough);
    this.capture?.enabled(true);
    for (const samples of this.flushAudio.splice(0)) {
      if (this.ws?.readyState !== WebSocket.OPEN) break;
      this.ws.send(JSON.stringify({ type: "audio", audio: pcmBase64(samples) })); this.sentSamples += samples.length;
      observeVoice(this.onVoiceObservation, "last_audio_sent");
    }
  }
  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.finalizeCurrentTurn("ptt_flush").finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  async stop() {
    this.generation++;
    this._active = false;
    this._paused = true;
    this.capturePaused = true;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "end_of_stream" }));
    } catch { /* ignore */ }
    this.capture?.stop();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.capture = null;
    this.flushAudio = [];
    this.ws = null;
    this.resetTranscriptBuffers();
  }

  private async finalizeCurrentTurn(trigger: "ptt_flush") {
    const generation = this.generation;
    await this.capture?.flush();
    if (this.generation !== generation) return;
    this.capturePaused = true;
    this.flushThrough = this.sentSamples / TARGET_SAMPLE_RATE;
    const id = ++this.flushId;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "flush", flush_id: id }));
        observeVoice(this.onVoiceObservation, "flush_sent");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      debugLogger.log({ service: "stt", level: "warn", direction: "in", label: "Gradium flush send failed", detail: error.message });
    }

    await waitForCondition(() => {
      return this.acknowledgedFlushId === id || this.generation !== generation;
    }, FLUSH_TIMEOUT_MS);

    if (this.generation !== generation) return;
    const text = this.getCompleteTranscript();
    if (text) this.emitFinal(text, trigger);
    this.resetTranscriptBuffers();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === "ready") { this.ready = true; this.awaitingReady?.(); }
      else if (msg?.type === "text" && typeof msg.text === "string") {
        if (this._paused || (typeof msg.flush_id === "number" && msg.flush_id < this.flushId)
          || (typeof msg.start_s === "number" && msg.start_s < this.retiredThrough)) return;
        this.lastMessageAt = performance.now();
        if (!this.firstPartialAt) this.firstPartialAt = this.lastMessageAt;
        const text = msg.text.trim();
        if (!text) return;
        // Gradium `text` messages are cumulative segments — each one is a new
        // piece of the transcript, to be concatenated with spaces. Do NOT
        // deduplicate: repeated words like "oui oui" are legitimate.
        this.textParts.push(text);
        this.onTranscript(this.getCompleteTranscript(), false);
      } else if (msg?.type === "flushed") {
        if (msg.flush_id !== this.flushId) return;
        this.acknowledgedFlushId = msg.flush_id;
        this.flushAckAt = performance.now();
        if (msg.flush_id === this.flushId) observeVoice(this.onVoiceObservation, "flush_acknowledged");
      } else if (msg?.type === "step" || msg?.type === "end_text") {
        // Diagnostic/provider completion only; application timing remains authoritative.
        this.lastMessageAt = performance.now();
      } else if (msg?.type === "error") {
        const error = new Error(String(msg.message || "Gradium STT error"));
        this.onError?.(error, { provider: "gradium", code: msg.code });
      }
    } catch {
      /* ignore non-JSON websocket frames */
    }
  }

  private getCompleteTranscript(): string {
    return this.textParts.join(" ").replace(/\s+/g, " ").trim();
  }

  private resetTranscriptBuffers() {
    this.textParts = [];
    this.firstPartialAt = 0;
    this.lastMessageAt = 0;
    this.flushAckAt = 0;
  }

  private emitFinal(text: string, trigger: "ptt_flush") {
    const context = this.getTelemetryContext?.() ?? {};
    const now = performance.now();
    const t_stt_ms = Math.max(0, Math.round(now - (this.firstPartialAt || this.startedAt || now)));
    const g = getSTTProviderSettings("gradium");
    this.lastFinalTelemetry = {
      t_stt_ms,
      stt_text_len: text.length,
      trigger,
      provider: "Gradium",
      model: "gradium-asr-realtime",
      language: g.language && g.language !== "auto" ? g.language : "auto",
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
        model: "gradium-asr-realtime",
        mode: "realtime",
        language: g.language && g.language !== "auto" ? g.language : "auto",
        trigger,
      },
    });
    this.onTranscript(text, true);
  }
}

