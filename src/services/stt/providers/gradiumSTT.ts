import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { waitForCondition } from "../finalization";
import { getSTTProviderSettings } from "../providerSettings";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-gradium`;
const GRADIUM_WS_URL = "wss://api.gradium.ai/api/speech/asr";
const TARGET_SAMPLE_RATE = 24_000;
const PROCESSOR_BUFFER_SIZE = 2048;
const FLUSH_TIMEOUT_MS = 2500;


/**
 * Gradium STT realtime WebSocket. The browser gets a single-use Gradium token
 * from our Edge Function, then streams 16-bit mono PCM chunks directly to
 * Gradium so text messages can be rendered while the user is still speaking.
 */
export class GradiumSTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];
  private stream: MediaStream | null = null;
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private _active = false;
  private _paused = false;
  private capturePaused = false;
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastMessageAt = 0;
  private flushAckAt = 0;
  private flushId = 0;
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;
  private flushPromise: Promise<void> | null = null;
  private initialStream?: MediaStream | Promise<MediaStream>;
  private segmentOrder: Array<string | number> = [];
  private segments = new Map<string | number, string>();
  private looseSegments: string[] = [];

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
    this.initialStream = opts?.initialStream;
  }

  get isActive() { return this._active; }
  getStream() { return this.stream; }
  getLastFinalTelemetry() { return this.lastFinalTelemetry; }
  setManualMode(_manual: boolean) { /* Gradium turn finalization is controlled by flush(). */ }

  async start() {
    const tokenRes = await authenticatedFunctionFetch(ENDPOINT, { method: "GET" });
    if (!tokenRes.ok) throw new Error(`Gradium token ${tokenRes.status}: ${await tokenRes.text()}`);
    const { token } = await tokenRes.json();
    if (!token) throw new Error("Gradium token missing");

    this.stream = await Promise.resolve(
      this.initialStream ?? navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }),
    );
    this.initialStream = undefined;

    const AudioCtx = window.AudioContext || (window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio API unavailable");
    this.audioCtx = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
    const sampleRate = Math.round(this.audioCtx.sampleRate || TARGET_SAMPLE_RATE);

    const wsUrl = new URL(GRADIUM_WS_URL);
    wsUrl.searchParams.set("token", token);
    this.ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Gradium WS open timeout")), 8000);
      this.ws!.onopen = () => {
        window.clearTimeout(timeout);
        const g = getSTTProviderSettings("gradium");
        const jsonConfig: Record<string, unknown> = { delay_in_frames: 8 };
        if (g.language && g.language !== "auto") jsonConfig.language = g.language;
        this.ws!.send(JSON.stringify({
          type: "setup",
          model_name: "default",
          input_format: sampleRate === TARGET_SAMPLE_RATE ? "pcm" : `pcm_${sampleRate}`,
          json_config: jsonConfig,
        }));
        resolve();
      };
      this.ws!.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Gradium WS error"));
      };
    });

    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = () => this.onError?.(new Error("Gradium WS error"), { provider: "gradium" });
    this.ws.onclose = () => debugLogger.log({ service: "stt", level: "info", direction: "in", label: "Gradium WS closed" });

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.processor = this.audioCtx.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
    this.processor.onaudioprocess = (event) => {
      if (this._paused || this.capturePaused || this.ws?.readyState !== WebSocket.OPEN) return;
      const samples = event.inputBuffer.getChannelData(0);
      this.ws.send(JSON.stringify({ type: "audio", audio: pcm16Base64(samples) }));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    this.startedAt = performance.now();
    this._active = true;
    this._paused = false;
    this.capturePaused = false;
    debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Gradium STT realtime connected" });
  }

  pause() { this._paused = true; this.capturePaused = true; }
  resume() {
    this._paused = false;
    this.capturePaused = false;
    this.resetTranscriptBuffers();
  }
  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.finalizeCurrentTurn("ptt_flush").finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  async stop() {
    this._active = false;
    this._paused = true;
    this.capturePaused = true;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "end_of_stream" }));
    } catch { /* ignore */ }
    try { this.processor?.disconnect(); } catch { /* ignore */ }
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { await this.audioCtx?.close(); } catch { /* ignore */ }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx = null;
    this.source = null;
    this.processor = null;
    this.ws = null;
    this.resetTranscriptBuffers();
  }

  private async finalizeCurrentTurn(trigger: "ptt_flush") {
    this.capturePaused = true;
    const flushRequestedAt = performance.now();
    const id = ++this.flushId;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "flush", flush_id: id }));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      debugLogger.log({ service: "stt", level: "warn", direction: "in", label: "Gradium flush send failed", detail: error.message });
    }

    await waitForCondition(() => {
      if (this.flushAckAt >= flushRequestedAt) return true;
      return this.lastMessageAt >= flushRequestedAt && performance.now() - this.lastMessageAt >= 220;
    }, FLUSH_TIMEOUT_MS);

    const text = this.getCompleteTranscript();
    this.resetTranscriptBuffers();
    if (text) this.emitFinal(text, trigger);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === "text" && typeof msg.text === "string") {
        this.lastMessageAt = performance.now();
        if (!this.firstPartialAt) this.firstPartialAt = this.lastMessageAt;
        const text = msg.text.trim();
        if (!text) return;
        const streamId = typeof msg.stream_id === "number" || typeof msg.stream_id === "string" ? msg.stream_id : null;
        if (streamId !== null) {
          if (!this.segments.has(streamId)) this.segmentOrder.push(streamId);
          this.segments.set(streamId, text);
        } else if (this.looseSegments[this.looseSegments.length - 1] !== text) {
          this.looseSegments.push(text);
        }
        this.onTranscript(this.getCompleteTranscript(), false);
      } else if (msg?.type === "flushed") {
        this.flushAckAt = performance.now();
      } else if (msg?.type === "error") {
        const error = new Error(String(msg.message || "Gradium STT error"));
        this.onError?.(error, { provider: "gradium", code: msg.code });
      }
    } catch {
      /* ignore non-JSON websocket frames */
    }
  }

  private getCompleteTranscript(): string {
    const ordered = this.segmentOrder.map((key) => this.segments.get(key)).filter(Boolean) as string[];
    return [...ordered, ...this.looseSegments].join(" ").replace(/\s+/g, " ").trim();
  }

  private resetTranscriptBuffers() {
    this.segmentOrder = [];
    this.segments.clear();
    this.looseSegments = [];
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

function pcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

