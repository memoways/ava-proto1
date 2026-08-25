/**
 * Gradium TTS provider — REST batch via the `proxy-tts-gradium` edge function,
 * plus optional WebSocket streaming (progressive playback) via
 * `gradiumStreamPlayer.ts`. Docs: https://docs.gradium.ai/guides/text-to-speech-rest
 * Advanced params (temp/cfg_coef/padding_bonus/rewrite_rules/pronunciation_id)
 * are sent via `json_config` (query param on REST, setup message on WS).
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult, TTSStreamPlaybackHandle, TTSStreamGenerationStats } from "@/services/tts/types";
import { resolveGradiumSettings, type GradiumSettings } from "@/services/tts/providerSettings";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { playAudioBlobRobust } from "@/services/audioPlayback";
import { createGradiumStreamSession, isStreamingSupported } from "@/services/tts/gradiumStreamPlayer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function buildJsonConfig(s: GradiumSettings): Record<string, number | string> {
  const jsonConfig: Record<string, number | string> = {
    temp: s.temp,
    cfg_coef: s.cfgCoef,
    padding_bonus: s.paddingBonus,
  };
  if (s.rewriteRules.trim()) jsonConfig.rewrite_rules = s.rewriteRules.trim();
  if (s.pronunciationId.trim()) jsonConfig.pronunciation_id = s.pronunciationId.trim();
  return jsonConfig;
}

let oggOpusPlayable: boolean | null = null;

/** Opus ships in an Ogg container, unplayable on Safari < 18.4 — fall back to wav there. */
function resolveRestFormat(format: GradiumSettings["outputFormat"]): GradiumSettings["outputFormat"] {
  if (format !== "opus") return format;
  if (oggOpusPlayable === null) {
    try {
      oggOpusPlayable = document.createElement("audio").canPlayType('audio/ogg; codecs="opus"') !== "";
    } catch {
      oggOpusPlayable = false;
    }
  }
  return oggOpusPlayable ? "opus" : "wav";
}

export const gradiumProvider: TTSProvider = {
  id: "gradium",
  label: "Gradium TTS",
  description: "TTS Gradium (WebSocket streaming + REST fallback). Voix naturelles, 237 voix.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = resolveGradiumSettings(ctx?.characterKey);
    const preparedText = prepareTextForTTS(text);
    const voiceId = ctx?.voiceId || s.voiceId;

    const body = {
      text: preparedText,
      voiceId,
      outputFormat: resolveRestFormat(s.outputFormat),
      jsonConfig: buildJsonConfig(s),
    };

    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-GR "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts-gradium`, body);
    const timeout = createTimeoutSignal(12000, ctx?.signal);

    const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-tts-gradium`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    }).finally(timeout.cancel);
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-GR", response.status, startTime, err);
      const error = new Error(`Gradium TTS error: ${response.status} - ${err}`);
      (error as Error & { statusCode?: number }).statusCode = response.status;
      throw error;
    }

    const blob = await withTimeout("tts_gradium_blob", response.blob(), 12000);
    if (blob.size === 0) {
      // The proxy pipes the upstream body without buffering, so an empty
      // generation is only detectable here.
      debugLogger.logResponse(debugId, "tts", "TTS-GR (empty)", response.status, startTime, "empty audio");
      throw new Error("Gradium returned empty audio");
    }
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-GR (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "gradium",
        model: "gradium-tts",
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },

  createStreamingPlayback(text: string, ctx?: TTSGenerateContext): TTSStreamPlaybackHandle | null {
    const s = resolveGradiumSettings(ctx?.characterKey);
    if (!s.streamingEnabled || !isStreamingSupported()) return null;
    return createStreamingHandleWithFallback(this, text, s, ctx);
  },
};

/**
 * Wraps a WS stream session so that any failure occurring *before audio became
 * audible* transparently switches to the REST blob path (`generate` + <audio>
 * element). The queue never sees the transport switch — `open()`, `started`,
 * `finished` and `generationDone` behave identically either way. Failures after
 * audio started are surfaced as-is (no fallback: no partial replays).
 */
function createStreamingHandleWithFallback(
  provider: TTSProvider,
  text: string,
  s: GradiumSettings,
  ctx?: TTSGenerateContext,
): TTSStreamPlaybackHandle {
  const preparedText = prepareTextForTTS(text);
  const t0 = performance.now();

  const session = createGradiumStreamSession(preparedText, {
    voiceId: ctx?.voiceId || s.voiceId,
    format: s.streamingFormat,
    jsonConfig: buildJsonConfig(s),
    signal: ctx?.signal,
  });

  // Single state machine: "ws" until a pre-audio failure flips it to "fallback".
  let mode: "ws" | "fallback" = "ws";
  let openRequested = false;
  let cancelled = false;
  let fallbackBlob: Blob | null = null;
  let fallbackPlaybackLaunched = false;

  let resolveStarted!: () => void, rejectStarted!: (e: unknown) => void;
  let resolveFinished!: (v: { playbackTotalMs: number }) => void, rejectFinished!: (e: unknown) => void;
  let resolveGeneration!: (v: TTSStreamGenerationStats) => void, rejectGeneration!: (e: unknown) => void;
  const startedP = new Promise<void>((res, rej) => { resolveStarted = res; rejectStarted = rej; });
  const finishedP = new Promise<{ playbackTotalMs: number }>((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  const generationP = new Promise<TTSStreamGenerationStats>((res, rej) => { resolveGeneration = res; rejectGeneration = rej; });
  startedP.catch(() => {});
  finishedP.catch(() => {});
  generationP.catch(() => {});

  session.started.then(() => { if (mode === "ws") resolveStarted(); }, (err) => maybeFallback(err));
  session.generationDone.then(
    (stats) => {
      if (mode !== "ws") return;
      resolveGeneration({
        provider: "gradium",
        model: "gradium-tts",
        transport: "websocket",
        statusCode: 200,
        firstByteMs: stats.firstByteMs,
        totalMs: stats.totalGenMs,
      });
    },
    (err) => maybeFallback(err),
  );
  session.finished.then(
    (r) => { if (mode === "ws") resolveFinished(r); },
    (err) => maybeFallback(err),
  );

  function maybeFallback(err: unknown) {
    if (mode !== "ws" || cancelled) return;
    const aborted = ctx?.signal?.aborted || (err instanceof DOMException && err.name === "AbortError");
    if (aborted || session.hasAudibleOutput) {
      // Abort, or audio already played — surface the failure, no fallback.
      rejectStarted(err);
      rejectGeneration(err);
      rejectFinished(err);
      return;
    }
    mode = "fallback";
    session.cancel("switching to REST fallback");
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[TTS-GR] WS streaming failed before audio (${message.slice(0, 120)}); falling back to REST`);
    provider.generate(preparedText, ctx).then(
      (result) => {
        if (cancelled) return;
        fallbackBlob = result.blob;
        resolveGeneration({
          provider: "gradium",
          model: result.meta.model,
          transport: "rest_fallback",
          statusCode: result.meta.statusCode,
          firstByteMs: Math.round(performance.now() - t0),
          totalMs: Math.round(performance.now() - t0),
        });
        if (openRequested) launchFallbackPlayback();
      },
      (genErr) => {
        rejectStarted(genErr);
        rejectGeneration(genErr);
        rejectFinished(genErr);
      },
    );
  }

  function launchFallbackPlayback() {
    if (fallbackPlaybackLaunched || cancelled || !fallbackBlob) return;
    fallbackPlaybackLaunched = true;
    const playStart = performance.now();
    playAudioBlobRobust(fallbackBlob, undefined, () => resolveStarted(), ctx?.signal).then((result) => {
      if (result.status === "played") {
        resolveFinished({ playbackTotalMs: result.playbackTotalMs ?? Math.round(performance.now() - playStart) });
      } else {
        const error = result.error || new Error("Audio playback failed");
        (error as Error & { playbackErrorType?: string }).playbackErrorType = result.errorInfo?.type;
        rejectStarted(error);
        rejectFinished(error);
      }
    });
  }

  return {
    open() {
      if (openRequested || cancelled) return;
      openRequested = true;
      if (mode === "ws") session.open();
      else launchFallbackPlayback();
    },
    started: startedP,
    finished: finishedP,
    generationDone: generationP,
    cancel(reason?: unknown) {
      if (cancelled) return;
      cancelled = true;
      session.cancel(reason);
      const err = reason instanceof Error || reason instanceof DOMException
        ? reason
        : new DOMException("Gradium stream cancelled", "AbortError");
      rejectStarted(err);
      rejectGeneration(err);
      rejectFinished(err);
    },
  };
}
