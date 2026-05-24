import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { getSTTRuntimeConfig } from "../runtimeConfig";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";

type GamilabClient = {
  connect: (options?: Record<string, unknown>) => Promise<void> | void;
  use_portal: (portalId: string) => Promise<void> | void;
  create_thread: () => Promise<void> | void;
  start_recording: () => Promise<void> | void;
  stop_recording?: () => Promise<void> | void;
  pause_recording?: () => Promise<void> | void;
  resume_recording?: () => Promise<void> | void;
  on?: (event: string, callback: (payload: any) => void) => void;
  off?: (event: string, callback: (payload: any) => void) => void;
  disconnect?: () => Promise<void> | void;
};

type GamilabFactory = new (options?: Record<string, unknown>) => GamilabClient;

declare global {
  interface Window {
    Gamilab?: GamilabFactory;
    gami?: GamilabClient;
  }
}

export class GamilabSTT implements STTSession {
  private client: GamilabClient | null = null;
  private onTranscript: TranscriptCallback;
  private onError?: STTCreateOptions["onError"];
  private getTelemetryContext?: STTCreateOptions["getTelemetryContext"];
  private _active = false;
  private _paused = false;
  private fullTranscript = "";
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastFinalTelemetry: import("../types").STTFinalTelemetryBase | null = null;

  constructor(onTranscript: TranscriptCallback, opts?: STTCreateOptions) {
    this.onTranscript = onTranscript;
    this.onError = opts?.onError;
    this.getTelemetryContext = opts?.getTelemetryContext;
  }

  get isActive() {
    return this._active;
  }

  getStream(): MediaStream | null {
    return null;
  }

  getLastFinalTelemetry(): import("../types").STTFinalTelemetryBase | null {
    return this.lastFinalTelemetry;
  }

  setManualMode(_manual: boolean) {
    // Gamilab controls finalization through text_history/silence events.
  }

  async start() {
    const config = await getSTTRuntimeConfig();
    const portalId = config.gamilabPortalId;
    if (!portalId) {
      throw new Error("Gamilab portal_id manquant. Configure GAMILAB_PORTAL_ID côté Lovable/Supabase.");
    }

    const client = this.resolveClient();
    if (!client) {
      throw new Error("SDK Gamilab introuvable côté navigateur. Charge le Browser SDK avant d'activer ce provider.");
    }

    this.client = client;
    this.startedAt = performance.now();
    this.bindEvents(client);

    await client.connect();
    await client.use_portal(portalId);
    await client.create_thread();
    await client.start_recording();
    this._active = true;
    this._paused = false;

    debugLogger.log({ service: "stt", level: "success", direction: "in", label: "Gamilab STT connected" });
  }

  pause() {
    this._paused = true;
    void this.client?.pause_recording?.();
  }

  resume() {
    this._paused = false;
    this.fullTranscript = "";
    void this.client?.resume_recording?.();
  }

  flush() {
    const finalText = this.fullTranscript.trim();
    this.fullTranscript = "";
    if (finalText) this.emitFinal(finalText, "ptt_flush");
  }

  async stop() {
    this._active = false;
    this._paused = false;
    try { await this.client?.stop_recording?.(); } catch { /* ignore */ }
    try { await this.client?.disconnect?.(); } catch { /* ignore */ }
    this.client = null;
    this.fullTranscript = "";
  }

  private resolveClient(): GamilabClient | null {
    if (window.gami) return window.gami;
    if (window.Gamilab) return new window.Gamilab();
    return null;
  }

  private bindEvents(client: GamilabClient) {
    client.on?.("text_current", (payload) => {
      if (this._paused) return;
      const text = this.extractText(payload);
      if (!text) return;
      if (!this.firstPartialAt) this.firstPartialAt = performance.now();
      this.onTranscript(text, false);
    });

    client.on?.("text_history", (payload) => {
      if (this._paused) return;
      const text = this.extractText(payload);
      if (!text) return;
      this.fullTranscript = text;
      this.emitFinal(text, "text_history");
    });

    client.on?.("silence", () => {
      if (!this._paused) this.flush();
    });

    client.on?.("error", (payload) => {
      const error = payload instanceof Error ? payload : new Error(String(payload?.message || payload || "Gamilab STT error"));
      this.onError?.(error, { provider: "gamilab" });
    });
  }

  private extractText(payload: any): string {
    if (typeof payload === "string") return payload.trim();
    if (typeof payload?.text === "string") return payload.text.trim();
    if (typeof payload?.transcript === "string") return payload.transcript.trim();
    if (Array.isArray(payload)) return payload.map((item) => this.extractText(item)).filter(Boolean).join(" ").trim();
    return "";
  }

  private emitFinal(finalText: string, trigger: "ptt_flush" | "text_history") {
    const context = this.getTelemetryContext?.() ?? {};
    const now = performance.now();
    const t_stt_ms = Math.max(0, Math.round(now - (this.firstPartialAt || this.startedAt || now)));
    this.lastFinalTelemetry = {
      t_stt_ms,
      stt_text_len: finalText.length,
      trigger,
      provider: "Gamilab",
      model: "gamilab-browser-sdk",
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
        provider: "Gamilab",
        model: "gamilab-browser-sdk",
        mode: "realtime",
        language: "fr",
        trigger,
      },
    });
    this.onTranscript(finalText, true);
  }
}
