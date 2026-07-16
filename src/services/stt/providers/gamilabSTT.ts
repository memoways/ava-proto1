import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { getSTTRuntimeConfig } from "../runtimeConfig";
import type { STTCreateOptions, STTSession, TranscriptCallback } from "../types";
import { waitForCondition } from "../finalization";
import { buildGamilabTranscript, isMeaningfulGamilabTranscript } from "./gamilabTranscript";

type GamilabSingleton = {
  connect: (host?: string) => Promise<void>;
  disconnect?: () => Promise<void>;
  use_portal: (portalIdOrOpts: number | string | { portal_id: number; token?: string }, token?: string) => Promise<void>;
  create_thread: () => Promise<{ thread_id: string; token: string }>;
  start_recording: () => Promise<void>;
  pause_recording?: () => Promise<void>;
  resume_recording?: () => Promise<void>;
  stop_recording?: () => Promise<void>;
  on: <T>(event: string, cb: (payload: T) => void) => unknown;
  off: (ref: unknown) => void;
};

declare global {
  interface Window {
    __gami_singleton__?: GamilabSingleton;
  }
}

const GAMILAB_SDK_URL = "https://gamilab.ch/js/sdk.js";
let singletonPromise: Promise<GamilabSingleton> | null = null;

/**
 * Wait for the SDK to initialise. The SDK fires `gami:init` repeatedly until
 * `evt.detail.Gami()` is called; we cache the singleton on `window`.
 */
function getGamiSingleton(timeoutMs = 5000): Promise<GamilabSingleton> {
  if (window.__gami_singleton__) return Promise.resolve(window.__gami_singleton__);
  if (singletonPromise) return singletonPromise;

  singletonPromise = new Promise<GamilabSingleton>((resolve, reject) => {
    let settled = false;
    const timer: { id?: number } = {};
    let script: HTMLScriptElement | null = null;
    const cleanup = () => {
      window.removeEventListener("gami:init", handler);
      if (timer.id !== undefined) window.clearTimeout(timer.id);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      script?.remove();
      reject(new Error(message));
    };
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (!settled && detail?.Gami) {
        settled = true;
        const gami = detail.Gami() as GamilabSingleton;
        window.__gami_singleton__ = gami;
        cleanup();
        resolve(gami);
      }
    };

    // Register before injecting the third-party script so the first init event
    // cannot be missed. The script is loaded only after the user has accepted
    // the required voice/storage information.
    window.addEventListener("gami:init", handler);
    script = document.querySelector<HTMLScriptElement>(`script[src="${GAMILAB_SDK_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GAMILAB_SDK_URL;
      script.async = true;
      script.defer = true;
      script.dataset.avaGamilabSdk = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => fail("Impossible de charger le SDK Gamilab."), { once: true });
    timer.id = window.setTimeout(
      () => fail(`Gamilab SDK never fired gami:init (${GAMILAB_SDK_URL}).`),
      timeoutMs,
    );
  }).catch((error) => {
    singletonPromise = null;
    throw error;
  });

  return singletonPromise;
}

/** Starts loading Gamilab during the teaser without delaying the first PTT. */
export async function prefetchGamilabSDK(): Promise<void> {
  await getGamiSingleton(10_000);
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
  private latestLiveTranscript = "";
  private manualMode = false;
  private flushPromise: Promise<void> | null = null;
  private startedAt = 0;
  private firstPartialAt = 0;
  private lastTextAt = 0;
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

  setManualMode(manual: boolean) { this.manualMode = manual; }

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
    // Try positional signature first (portal_id, token), then fall back to object form.
    try {
      await gami.use_portal(Number(portalId), portalToken);
    } catch (errPos) {
      debugLogger.log({ service: "stt", level: "warn", direction: "in", label: `Gamilab use_portal(positional) failed: ${(errPos as Error).message}, retrying with object` });
      await gami.use_portal({ portal_id: Number(portalId), token: portalToken });
    }
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
    this.latestLiveTranscript = "";
    void this.gami?.resume_recording?.();
  }

  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.finalizeCurrentTurn().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async finalizeCurrentTurn(): Promise<void> {
    const requestedAt = performance.now();
    // Stop accepting new audio while keeping listeners alive for the provider's
    // delayed text_history correction.
    try { await this.gami?.pause_recording?.(); } catch { /* preserve latest live text */ }
    await waitForCondition(
      () => this.lastTextAt >= requestedAt && performance.now() - this.lastTextAt >= 180,
      1200,
    );
    const finalText = this.getCompleteTranscript();
    this.fullTranscript = "";
    this.latestLiveTranscript = "";
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
    this.latestLiveTranscript = "";
  }

  private bindEvents(gami: GamilabSingleton) {
    this.listeners.push(
      gami.on("text_current", (payload: unknown) => {
        if (this._paused) return;
        const text = this.extractText(payload);
        if (!isMeaningfulGamilabTranscript(text)) return;
        if (!this.firstPartialAt) this.firstPartialAt = performance.now();
        this.lastTextAt = performance.now();
        this.latestLiveTranscript = text;
        this.onTranscript(this.getCompleteTranscript(), false);
      }),
    );

    this.listeners.push(
      gami.on("text_history", (payload: unknown) => {
        if (this._paused) return;
        const text = this.extractText(payload);
        if (!isMeaningfulGamilabTranscript(text)) return;
        this.lastTextAt = performance.now();
        this.fullTranscript = text;
        // text_history is the corrected cumulative source. If it already
        // contains the live fragment, do not append that fragment twice.
        if (text.toLocaleLowerCase().includes(this.latestLiveTranscript.toLocaleLowerCase())) {
          this.latestLiveTranscript = "";
        }
        this.onTranscript(this.getCompleteTranscript(), false);
      }),
    );

    this.listeners.push(
      gami.on("silence", (isSilence: boolean) => {
        if (!isSilence || this._paused) return;
        const finalText = this.getCompleteTranscript();
        if (finalText) {
          if (this.manualMode) {
            // Keep the corrected history as the flush fallback until the user
            // explicitly clicks send.
            this.fullTranscript = finalText;
            this.onTranscript(finalText, false);
          } else {
            this.fullTranscript = "";
            this.latestLiveTranscript = "";
            this.emitFinal(finalText, "silence");
          }
        }
      }),
    );
  }

  private getCompleteTranscript(): string {
    return buildGamilabTranscript(this.fullTranscript, this.latestLiveTranscript);
  }

  private extractText(payload: unknown): string {
    if (typeof payload === "string") return payload.trim();
    if (Array.isArray(payload)) return payload.map((item) => this.extractText(item)).filter(Boolean).join(" ").trim();
    if (payload && typeof payload === "object") {
      const candidate = payload as { text?: unknown; transcript?: unknown };
      if (typeof candidate.text === "string") return candidate.text.trim();
      if (typeof candidate.transcript === "string") return candidate.transcript.trim();
    }
    return "";
  }

  private emitFinal(finalText: string, trigger: "ptt_flush" | "silence") {
    const context = this.getTelemetryContext?.() ?? {};
    const now = performance.now();
    const t_stt_ms = Math.max(0, Math.round(now - (this.lastTextAt || this.firstPartialAt || this.startedAt || now)));
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
    this.lastTextAt = 0;
    this.onTranscript(finalText, true);
  }
}
