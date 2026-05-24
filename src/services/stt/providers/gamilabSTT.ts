import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { getSTTRuntimeConfig } from "../runtimeConfig";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";

type GamilabSingleton = {
  connect: (host?: string) => Promise<void>;
  disconnect?: () => Promise<void>;
  use_portal: (portalIdOrOpts: number | string | { portal_id: number; token?: string }, token?: string) => Promise<void>;
  create_thread: () => Promise<{ thread_id: string; token: string }>;
  start_recording: () => Promise<void>;
  pause_recording?: () => Promise<void>;
  resume_recording?: () => Promise<void>;
  stop_recording?: () => Promise<void>;
  on: (event: string, cb: (payload: any) => void) => unknown;
  off: (ref: unknown) => void;
};

declare global {
  interface Window {
    __gami_singleton__?: GamilabSingleton;
  }
}

/**
 * Wait for the SDK to initialise. The SDK fires `gami:init` repeatedly until
 * `evt.detail.Gami()` is called; we cache the singleton on `window`.
 */
function getGamiSingleton(timeoutMs = 5000): Promise<GamilabSingleton> {
  if (window.__gami_singleton__) return Promise.resolve(window.__gami_singleton__);
  return new Promise((resolve, reject) => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (detail?.Gami) {
        const gami = detail.Gami() as GamilabSingleton;
        window.__gami_singleton__ = gami;
        window.removeEventListener("gami:init", handler);
        resolve(gami);
      }
    };
    window.addEventListener("gami:init", handler);
    setTimeout(() => {
      window.removeEventListener("gami:init", handler);
      reject(new Error("Gamilab SDK never fired gami:init (script https://gamilab.ch/js/sdk.js not loaded?)"));
    }, timeoutMs);
  });
}

/**
 * Gamilab STT (transcription only, no extraction).
 * Uses connect → use_portal(id, token) → create_thread → start_recording.
 * Listens to text_current (live), text_history (final) and silence events.
 */
export class GamilabSTT implements STTSession {
  private gami: GamilabSingleton | null = null;
  private listeners: unknown[] = [];
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
    /* Gamilab manages turn finalization via silence/text_history events */
  }

  async start() {
    const config = await getSTTRuntimeConfig();
    const portalId = config.gamilabPortalId;
    const portalToken = config.gamilabPortalToken;
    if (!portalId) {
      throw new Error("Gamilab portal_id manquant (GAMILAB_PORTAL_ID).");
    }
    if (!portalToken) {
      throw new Error("Gamilab portal token manquant (GAMILAB_API_KEY).");
    }

    const gami = await getGamiSingleton();
    this.gami = gami;
    this.startedAt = performance.now();
    this.bindEvents(gami);

    await gami.connect();
    // portal_id is numeric, token is the JWT-like string from Gamilab
    await gami.use_portal({ portal_id: Number(portalId), token: portalToken });
    await gami.create_thread();
    await gami.start_recording();

    this._active = true;
    this._paused = false;
    debugLogger.log({ service: "stt", level: "success", direction: "in", label: `Gamilab STT recording (portal ${portalId})` });
  }

  pause() {
    this._paused = true;
    void this.gami?.pause_recording?.();
  }

  resume() {
    this._paused = false;
    this.fullTranscript = "";
    void this.gami?.resume_recording?.();
  }

  flush() {
    const finalText = this.fullTranscript.trim();
    this.fullTranscript = "";
    if (finalText) this.emitFinal(finalText, "ptt_flush");
  }

  async stop() {
    this._active = false;
    this._paused = false;
    try { await this.gami?.stop_recording?.(); } catch { /* ignore */ }
    try { await this.gami?.pause_recording?.(); } catch { /* ignore */ }
    // unsubscribe listeners
    if (this.gami) {
      for (const ref of this.listeners) {
        try { this.gami.off(ref); } catch { /* ignore */ }
      }
    }
    this.listeners = [];
    // Do NOT disconnect — keep singleton hot for the next turn
    this.gami = null;
    this.fullTranscript = "";
  }

  private bindEvents(gami: GamilabSingleton) {
    this.listeners.push(
      gami.on("text_current", (payload: any) => {
        if (this._paused) return;
        const text = this.extractText(payload);
        if (!text) return;
        if (!this.firstPartialAt) this.firstPartialAt = performance.now();
        this.onTranscript(text, false);
      }),
    );

    this.listeners.push(
      gami.on("text_history", (payload: any) => {
        if (this._paused) return;
        const text = this.extractText(payload);
        if (!text) return;
        this.fullTranscript = text;
      }),
    );

    this.listeners.push(
      gami.on("silence", (isSilence: boolean) => {
        if (!isSilence || this._paused) return;
        const finalText = this.fullTranscript.trim();
        if (finalText) {
          this.fullTranscript = "";
          this.emitFinal(finalText, "silence");
        }
      }),
    );
  }

  private extractText(payload: any): string {
    if (typeof payload === "string") return payload.trim();
    if (typeof payload?.text === "string") return payload.text.trim();
    if (typeof payload?.transcript === "string") return payload.transcript.trim();
    if (Array.isArray(payload)) return payload.map((item) => this.extractText(item)).filter(Boolean).join(" ").trim();
    return "";
  }

  private emitFinal(finalText: string, trigger: "ptt_flush" | "silence") {
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
    this.firstPartialAt = 0;
    this.onTranscript(finalText, true);
  }
}
