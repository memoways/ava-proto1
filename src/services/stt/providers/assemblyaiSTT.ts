import { observeVoice } from "../../voiceTurnTelemetryV2";
import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { waitForCondition } from "../finalization";
import { getDictionaryTerms } from "../dictionary";
import { getSTTProviderSettings } from "../providerSettings";
import { createPcmCapture, encodePcm16 } from "../pcmCapture";



const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const TOKEN_ENDPOINT = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/proxy-stt-assemblyai`;

/**
 * AssemblyAI Universal Streaming v3 STT.
 * Streams PCM 16kHz mono via WebSocket using a short-lived token from /proxy-stt-assemblyai.
 */
export class AssemblyAISTT implements STTSession {
  private onTranscript: TranscriptCallback;
  private onVoiceObservation?: STTCreateOptions["onVoiceObservation"];
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];

  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private capture: Awaited<ReturnType<typeof createPcmCapture>> | null = null;
  private generation = 0;
  private flushAudio: Float32Array[] = [];
  private _active = false;
  private _paused = false;
  private capturePaused = false;
  private fullTranscript = "";
  private manualMode = false;
  private lastTurnEndedAt = 0;
  private flushPromise: Promise<void> | null = null;
  private initialStream?: MediaStream | Promise<MediaStream>;
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onVoiceObservation = opts?.onVoiceObservation;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
    this.initialStream = opts?.initialStream;
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
  setManualMode(manual: boolean) { this.manualMode = manual; }

  async start() {
    const generation = this.generation;
    const tokenRes = await authenticatedFunctionFetch(TOKEN_ENDPOINT);
    if (!tokenRes.ok) throw new Error(`AssemblyAI token error: ${tokenRes.status}`);
    const { token, sample_rate = 16000 } = await tokenRes.json();
    if (generation !== this.generation) throw new DOMException("Capture replaced", "AbortError");

    this.stream = await Promise.resolve(
      this.initialStream ?? navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
    );
    this.initialStream = undefined;
    if (generation !== this.generation) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; throw new DOMException("Capture replaced", "AbortError"); }
    // AssemblyAI v3 accepts a `keyterms_prompt` JSON array + turn-detection knobs.
    const keyterms = getDictionaryTerms();
    const aa = getSTTProviderSettings("assemblyai");
    const params = new URLSearchParams({
      sample_rate: String(sample_rate),
      format_turns: aa.formatTurns ? "true" : "false",
      min_end_of_turn_silence_when_confident: String(Math.round(aa.minEndOfTurnSilenceWhenConfident)),
      end_of_turn_confidence_threshold: String(aa.endOfTurnConfidenceThreshold),
      token,
    });
    if (keyterms.length > 0) params.set("keyterms_prompt", JSON.stringify(keyterms));
    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;


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

    const socket = this.ws;
    if (generation !== this.generation) { socket.close(); throw new DOMException("Capture replaced", "AbortError"); }
    this.ws.onmessage = (event) => { if (this.ws === socket && generation === this.generation) this.handleMessage(event); };
    this.ws.onerror = () => this.onError?.(new Error("AssemblyAI STT error"), { provider: "assemblyai" });
    this.ws.onclose = () => { if (this._active) this.onError?.(new Error("AssemblyAI STT disconnected"), { provider: "assemblyai" }); };

    const capture = await createPcmCapture(this.stream, sample_rate, Math.round(sample_rate * 0.05), samples => {
      if (this._paused || this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.capturePaused) {
        if (this.flushAudio.length >= 60) { this.onError?.(new Error("AssemblyAI pending capture exceeded 3 seconds")); return; }
        this.flushAudio.push(samples); return;
      }
      this.ws.send(encodePcm16(samples));
      observeVoice(this.onVoiceObservation, "last_audio_sent");
    }, error => { if (generation === this.generation) this.onError?.(error, { provider: "assemblyai" }); });
    if (generation !== this.generation || this.ws !== socket) { capture.stop(); throw new DOMException("Capture replaced", "AbortError"); }
    this.capture = capture;
    observeVoice(this.onVoiceObservation, "capture_started");
    observeVoice(this.onVoiceObservation, "capture_ready");
    this._active = true;
    this._paused = false;
    this.capturePaused = false;
  }

  pause() { this._paused = true; this.capturePaused = true; this.flushAudio = []; this.capture?.enabled(false); }
  resume() {
    if (!this._paused && !this.capturePaused) return;
    this._paused = false; this.capturePaused = false; this.fullTranscript = ""; this.capture?.enabled(true);
    for (const samples of this.flushAudio.splice(0)) {
      if (this.ws?.readyState !== WebSocket.OPEN) break;
      this.ws.send(encodePcm16(samples)); observeVoice(this.onVoiceObservation, "last_audio_sent");
    }
  }

  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.finalizeCurrentTurn().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async finalizeCurrentTurn(): Promise<void> {
    const generation = this.generation;
    await this.capture?.flush();
    if (generation !== this.generation) return;
    this.capturePaused = true;
    const requestedAt = performance.now();
    if (this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ type: "ForceEndpoint" })); observeVoice(this.onVoiceObservation, "flush_sent"); } catch { /* use latest running text */ }
    }
    await waitForCondition(() => this.lastTurnEndedAt >= requestedAt, 1300);
    if (generation !== this.generation) return;
    const finalText = this.fullTranscript.trim();
    this.fullTranscript = "";
    if (finalText) this.emitFinal(finalText, "ptt_flush");
  }

  async stop() {
    this.generation++; this._active = false; this._paused = true;
    this.capture?.stop();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws = null;
    this.stream = null;
    this.capture = null;
    this.flushAudio = [];
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
        // v3 `transcript` is the complete running text for the current turn.
        // Keep every revision so flush always has a fallback before EOT arrives.
        this.fullTranscript = transcript;
        if (data.end_of_turn) {
          this.lastTurnEndedAt = performance.now();
          if (!this.manualMode) {
            this.fullTranscript = "";
            this.emitFinal(transcript, "silence");
          } else {
            this.onTranscript(transcript, false);
          }
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
