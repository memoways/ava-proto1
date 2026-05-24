import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const TOKEN_ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-assemblyai`;

/**
 * AssemblyAI Universal Streaming v3 STT.
 * Streams PCM 16kHz mono via WebSocket using a short-lived token from /proxy-stt-assemblyai.
 */
export class AssemblyAISTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];

  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private _active = false;
  private _paused = false;
  private fullTranscript = "";
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastFinalTelemetry: unknown = null;

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
  }

  get isActive() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  getStream() {
    return this.stream;
  }
  getLastFinalTelemetry() {
    return this.lastFinalTelemetry;
  }
  setManualMode(_manual: boolean) {
    /* AssemblyAI handles turn detection itself */
  }

  async start() {
    const tokenRes = await fetch(TOKEN_ENDPOINT);
    if (!tokenRes.ok) throw new Error(`AssemblyAI token error: ${tokenRes.status}`);
    const { token, sample_rate = 16000 } = await tokenRes.json();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: sample_rate, channelCount: 1 } });
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioCtx({ sampleRate: sample_rate });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${sample_rate}&format_turns=true&token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.startedAt = performance.now();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("AssemblyAI WS open timeout")), 8000);
      this.ws!.onopen = () => {
        clearTimeout(timeout);
        debugLogger.log({ service: "stt", level: "success", direction: "in", label: "AssemblyAI WS connected" });
        resolve();
      };
      this.ws!.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("AssemblyAI WS error"));
      };
    });

    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onclose = () => debugLogger.log({ service: "stt", level: "info", direction: "in", label: "AssemblyAI WS closed" });

    this.processor.onaudioprocess = (e) => {
      if (this._paused || this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(input);
      this.ws.send(pcm);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this._active = true;
    this._paused = false;
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this.fullTranscript = ""; }

  flush() {
    const finalText = this.fullTranscript.trim();
    this.fullTranscript = "";
    if (finalText) this.emitFinal(finalText, "ptt_flush");
  }

  async stop() {
    this._active = false;
    try { this.processor?.disconnect(); } catch { /* ignore */ }
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { await this.audioCtx?.close(); } catch { /* ignore */ }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws = null;
    this.stream = null;
    this.audioCtx = null;
    this.source = null;
    this.processor = null;
    this.fullTranscript = "";
  }

  private handleMessage(event: MessageEvent) {
    if (this._paused) return;
    try {
      const data = JSON.parse(event.data);
      // v3: { type: "Turn", transcript, end_of_turn, turn_is_formatted }
      if (data.type === "Turn") {
        const transcript = (data.transcript || "").trim();
        if (!transcript) return;
        if (!this.firstPartialAt) this.firstPartialAt = performance.now();
        if (data.end_of_turn) {
          this.fullTranscript = transcript;
          this.emitFinal(transcript, "silence");
        } else {
          this.onTranscript(transcript, false);
        }
      } else if (data.type === "Termination" || data.error) {
        if (data.error) this.onError?.(new Error(String(data.error)), { provider: "assemblyai" });
      }
    } catch {
      /* ignore non-JSON */
    }
  }

  private emitFinal(finalText: string, trigger: "ptt_flush" | "silence") {
    const context = this.getTelemetryContext?.() ?? {};
    const now = performance.now();
    const t_stt_ms = Math.max(0, Math.round(now - (this.firstPartialAt || this.startedAt || now)));
    this.lastFinalTelemetry = {
      t_stt_ms,
      stt_text_len: finalText.length,
      trigger,
      provider: "AssemblyAI",
      model: "universal-streaming-v3",
      language: "fr",
    };
    recordAudioLatency({
      session_id: context.session_id ?? undefined,
      turn_index: context.turn_index ?? undefined,
      direction: "in",
      t_stt_ms,
      stt_text_len: finalText.length,
      metadata: {
        turn_id: context.turn_id ?? null,
        provider: "AssemblyAI",
        model: "universal-streaming-v3",
        mode: "realtime",
        language: "fr",
        trigger,
      },
    });
    this.firstPartialAt = 0;
    this.onTranscript(finalText, true);
  }
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
