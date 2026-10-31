/**
 * Gradium TTS provider — REST batch via the `proxy-tts-gradium` edge function,
 * plus optional WebSocket streaming (progressive playback) via
 * `gradiumStreamPlayer.ts`. Docs: https://docs.gradium.ai/guides/text-to-speech-rest
 * Advanced params (temp/cfg_coef/padding_bonus/rewrite_rules/pronunciation_id)
 * are sent via `json_config` (query param on REST, setup message on WS).
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult, TTSStreamPlaybackHandle, TTSStreamGenerationStats } from "@/services/tts/types";
import { resolveGradiumSettings, type GradiumSettings } from "@/services/tts/providerSettings";
import { applyGradiumPerformance, resolveGradiumPauseSeconds } from "@/services/tts/performanceIntent";
import type { PerformanceIntent } from "@/services/tts/performanceIntent";
import { debugLogger } from "@/services/debugLogger";
import { createGradiumSpeechPreparer, planGradiumSpeech, prepareTextForGradium } from '../gradiumSpeech';
import { validateSpeechAudition, getSpeechPerformanceSettings } from '../speechPerformanceSettings';
import { withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { playAudioBlobRobust } from "@/services/audioPlayback";
import { createGradiumStreamSession, createGradiumTurnSession, isStreamingSupported } from "@/services/tts/gradiumStreamPlayer";

export { prepareTextForGradium } from '../gradiumSpeech';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function buildGradiumJsonConfig(s: GradiumSettings, performance?: PerformanceIntent | null): Record<string, number | string> {
  const tuned = applyGradiumPerformance(
    { temp: s.temp, paddingBonus: s.paddingBonus },
    performance,
  );
  const jsonConfig: Record<string, number | string> = {
    temp: tuned.temp,
    cfg_coef: s.cfgCoef,
    padding_bonus: tuned.paddingBonus,
  };
  if (s.rewriteRules.trim()) jsonConfig.rewrite_rules = s.rewriteRules.trim();
  if (s.pronunciationId.trim()) jsonConfig.pronunciation_id = s.pronunciationId.trim();
  return jsonConfig;
}

function auditionSnapshot(ctx?: TTSGenerateContext) {
  if (!ctx?.speechAudition) return undefined;
  const snapshot = validateSpeechAudition(ctx.speechAudition, ctx.characterKey);
  if (!snapshot.validStates.includes(ctx.performance?.speechState ?? '')) {
    throw new Error('État audition non validé pour ce personnage');
  }
  return snapshot;
}
function effectiveSettings(ctx?: TTSGenerateContext) {
  return auditionSnapshot(ctx)?.gradium ?? resolveGradiumSettings(ctx?.characterKey);
}
function pauseForContext(ctx?: TTSGenerateContext) {
  return resolveGradiumPauseSeconds(ctx?.performance, ctx?.characterKey, auditionSnapshot(ctx)?.settings);
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

async function generateGradiumSpeech(text: string, ctx: TTSGenerateContext | undefined, s: GradiumSettings): Promise<TTSGenerateResult> {
    if (ctx?.signal?.aborted) throw new DOMException('Annulé', 'AbortError');
    const preparedText = prepareTextForGradium(text);
    const pauseSeconds = pauseForContext(ctx);
    const pauseRendering = planGradiumSpeech(text, pauseSeconds).some(part => part.type === 'pause') ? 'rest_unavailable' : 'disabled';
    if (pauseRendering === 'rest_unavailable') debugLogger.log({ service: 'tts', level: 'warn', direction: 'out', label: 'TTS-GR REST: experimental pauses unavailable; cleaned speech preserved' });
    const voiceId = ctx?.voiceId || s.voiceId;

    const body = {
      text: preparedText,
      voiceId,
      outputFormat: resolveRestFormat(s.outputFormat),
      jsonConfig: buildGradiumJsonConfig(s, ctx?.performance),
    };

    ctx?.onAuditionRequest?.({ transport: 'rest', body });
    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-GR "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts-gradium`, body);
    const controller = new AbortController();
    const abort = () => controller.abort(ctx?.signal?.reason);
    if (ctx?.signal?.aborted) abort();
    else ctx?.signal?.addEventListener('abort', abort, { once: true });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancelReader = () => { void reader?.cancel(controller.signal.reason).catch(() => {}); };
    controller.signal.addEventListener('abort', cancelReader, { once: true });
    try {
    const response = await withTimeout('tts_gradium_request', authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-tts-gradium`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }), (ctx?.timeoutMs ?? 12000), () => controller.abort(new Error('Gradium request deadline')));
    const tFirstByte = performance.now();

    reader = response.body?.getReader();
    if (!reader) throw new Error('Gradium audio body missing');
    const readBlob = async () => {
      const chunks: ArrayBuffer[] = [];
      let bytes = 0;
      while (true) {
        if (controller.signal.aborted) throw new DOMException('Gradium body cancelled', 'AbortError');
        const { done, value } = await reader!.read();
        if (controller.signal.aborted) throw new DOMException('Gradium body cancelled', 'AbortError');
        if (done) break;
        bytes += value.length;
        if (bytes > 32 * 1024 * 1024) throw new Error('Gradium audio body exceeds 32 MiB');
        const copy = new Uint8Array(value.length);
        copy.set(value);
        chunks.push(copy.buffer);
      }
      return new Blob(chunks, { type: response.headers.get('Content-Type') || 'audio/wav' });
    };
    const blob = await withTimeout("tts_gradium_blob", readBlob(), (ctx?.timeoutMs ?? 12000), () => controller.abort(new Error('Gradium body deadline')));
    if (!response.ok) {
      const err = await blob.text();
      debugLogger.logResponse(debugId, "tts", "TTS-GR", response.status, startTime, err);
      const error = new Error(`Gradium TTS error: ${response.status} - ${err}`);
      (error as Error & { statusCode?: number }).statusCode = response.status;
      throw error;
    }

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
        pauseRendering,
      },
    };
    } finally {
      controller.abort();
      ctx?.signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', cancelReader);
      void reader?.cancel().catch(() => {});
    }
}

export const gradiumProvider: TTSProvider = {
  id: "gradium",
  label: "Gradium TTS",
  description: "TTS Gradium (WebSocket streaming + REST fallback). Voix naturelles, 237 voix.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    return generateGradiumSpeech(text, ctx, effectiveSettings(ctx));
  },

  createStreamingPlayback(text: string, ctx?: TTSGenerateContext): TTSStreamPlaybackHandle | null {
    const s = effectiveSettings(ctx);
    if ((!ctx?.speechAudition && !s.streamingEnabled) || !isStreamingSupported()) return null;
    return createStreamingHandleWithFallback(text, s, ctx);
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
  text: string,
  s: GradiumSettings,
  ctx?: TTSGenerateContext,
): TTSStreamPlaybackHandle {
  const pauseSeconds = pauseForContext(ctx);
  const t0 = performance.now();

  const parts = planGradiumSpeech(text, pauseSeconds);
  const observeSetup = () => ctx?.onAuditionRequest?.({ transport: 'websocket', controls: parts, body: {
    model_name: 'default', voice_id: ctx?.voiceId || s.voiceId,
    output_format: s.streamingFormat === 'pcm_48000' ? 'pcm' : s.streamingFormat,
    json_config: buildGradiumJsonConfig(s, ctx?.performance),
  } });
  const session = createGradiumStreamSession(text, {
    captureAudio: Boolean(ctx?.speechAudition),
    onSetupSent: observeSetup,
    validateContext: () => { auditionSnapshot(ctx); },
    voiceId: ctx?.voiceId || s.voiceId,
    format: s.streamingFormat,
    jsonConfig: buildGradiumJsonConfig(s, ctx?.performance),
    bufferPreset: ctx?.bufferPreset,
    signal: ctx?.signal,
    onVoiceObservation: ctx?.onVoiceObservation,
    prepareText: createGradiumSpeechPreparer(() => pauseSeconds),
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
        auditionAudio: stats.auditionAudio,
        auditionCapture: stats.auditionCapture,
        pauseRendering: parts.some(part => part.type === 'pause') ? 'websocket' : 'disabled',
        statusCode: 200,
        firstByteMs: stats.firstByteMs,
        totalMs: stats.totalGenMs,
        bufferPreset: stats.bufferPreset,
        prebufferMs: stats.prebufferMs,
        rebufferMs: stats.rebufferMs,
        rebufferCount: stats.rebufferCount,
        underrunCount: stats.underrunCount,
        maxGapMs: stats.maxGapMs,
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
    generateGradiumSpeech(text, ctx, s).then(
      (result) => {
        if (cancelled) return;
        fallbackBlob = result.blob;
        resolveGeneration({
          provider: "gradium",
          model: result.meta.model,
          transport: "rest_fallback",
          auditionAudio: ctx?.speechAudition ? result.blob : undefined,
          pauseRendering: result.meta.pauseRendering,
          statusCode: result.meta.statusCode,
          firstByteMs: Math.round(performance.now() - t0),
          totalMs: Math.round(performance.now() - t0),
          bufferPreset: null,
          prebufferMs: null,
          rebufferMs: null,
          rebufferCount: null,
          underrunCount: null,
          maxGapMs: null,
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

/** Freezes the existing character voice and settings at turn preparation. */
export function createGradiumIncrementalTurn(ctx: TTSGenerateContext, onProgress?: import("../gradiumStreamPlayer").GradiumStreamOptions["onProgress"]) {
  const s = resolveGradiumSettings(ctx.characterKey);
  const speechSettings = getSpeechPerformanceSettings();
  let intent = ctx.performance;
  let appended = false;
  const prepareText = createGradiumSpeechPreparer(() => resolveGradiumPauseSeconds(intent, ctx.characterKey, speechSettings));
  const session = createGradiumTurnSession({
    voiceId: ctx.voiceId || s.voiceId,
    format: s.outputFormat === "pcm_24000" ? "pcm_24000" : "pcm_48000",
    jsonConfig: buildGradiumJsonConfig(s, ctx.performance), bufferPreset: ctx.bufferPreset, signal: ctx.signal,
    onVoiceObservation: ctx.onVoiceObservation, onProgress,
    deferSetup: Boolean(ctx.resolveSpeechPerformance),
    prepareText,
  });
  const append = session.appendText;
  return Object.assign(session, {
    appendText: (text: string) => { appended = true; append(text); },
    setPerformance: (value: PerformanceIntent) => {
      if (appended) return;
      intent = value; ctx.performance = value; session.configure(buildGradiumJsonConfig(s, value));
    },
    generateFallback: (text: string, signal: AbortSignal) => generateGradiumSpeech(text, { ...ctx, signal }, s),
  });
}
