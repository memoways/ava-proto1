import { observeVoice, observeService } from "../voiceTurnTelemetryV2";
/**
 * Public TTS façade — single entry point for the rest of the app.
 *
 * - generateSpeech(text, opts): routes to the active provider (default ElevenLabs).
 * - Re-exports utilities (prepareTextForTTS, chunkTextForTTS, extractSentences) so
 *   existing imports continue to work.
 * - Records latency telemetry uniformly across providers, including the new
 *   `provider`, `status_code`, `error_type` fields (Phase 2 will read those).
 */

import { getActiveProvider, getProviderById } from "@/services/tts/registry";
import type {
  TTSGenerateContext,
  TTSProvider,
  TTSProviderId,
  TTSProviderRequestError,
  TTSStreamPlaybackHandle,
} from "@/services/tts/types";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { playAudioBlobRobust, type PlaybackResult } from "@/services/audioPlayback";
import { getOpeningTTSBlob, openingTTSCacheKey } from '../openingTTSCache';
import { getActiveEnvironment } from '../environmentContext';
import { getTTSSettings } from '../settingsService';
import { getCartesiaSettings, getFishSettings, getInworldSettings, resolveGradiumSettings } from './providerSettings';
import type { ServiceObservation } from '../voiceTurnTelemetryV2';

export { prepareTextForTTS } from "@/services/tts/textPrep";
export { chunkTextForTTS, extractSentences } from "@/services/tts/textChunking";

export interface TTSOptions extends TTSGenerateContext {
  /** Explicit scripted greeting only; live WS always bypasses the blob cache. */
  cacheOpening?: boolean;
  /** Force a specific provider for this call (ignored by TTSQueue). */
  providerId?: TTSProviderId;
  characterOverride?: boolean;
}

function classifyError(statusCode: number | undefined, message: string): "quota" | "rate_limit" | "auth" | "network" | "server" | "client" | "unknown" {
  if (!statusCode) {
    if (/network|fetch|abort/i.test(message)) return "network";
    return "unknown";
  }
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (/quota|credits|insufficient_credits/i.test(message)) return "quota";
  if (statusCode === 429) return "rate_limit";
  if (statusCode >= 500) return "server";
  if (statusCode >= 400) return "client";
  return "unknown";
}

const ELEVENLABS_RETRYABLE_CODES = new Set([
  "concurrent_limit_exceeded",
  "rate_limit_exceeded",
  "system_busy",
  "too_many_concurrent_requests",
]);

function isRetryableElevenLabsError(provider: TTSProvider, error: unknown): boolean {
  if (provider.id !== "elevenlabs") return false;
  const typed = error as TTSProviderRequestError;
  const statusCode = typed?.statusCode;
  const message = error instanceof Error ? error.message : String(error);
  if (statusCode !== undefined && statusCode >= 500 && statusCode <= 599) return true;
  if (statusCode !== 429) return false;
  if (/credits|insufficient|quota_exceeded/i.test(message)) return false;
  return !typed.providerErrorCode || ELEVENLABS_RETRYABLE_CODES.has(typed.providerErrorCode);
}

function createAbortError(): DOMException {
  return new DOMException("TTS retry cancelled", "AbortError");
}

function waitBeforeRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function generateWithBoundedRetry(
  provider: TTSProvider,
  text: string,
  opts?: TTSOptions,
): Promise<{ result: Awaited<ReturnType<TTSProvider["generate"]>>; retryCount: number }> {
  let retryCount = 0;
  try {
    return { result: await provider.generate(text, opts), retryCount };
  } catch (error) {
    if (!isRetryableElevenLabsError(provider, error) || opts?.signal?.aborted) throw error;
    retryCount = 1;
    const delayMs = 650 + Math.floor(Math.random() * 250);
    const code = (error as TTSProviderRequestError).providerErrorCode ?? "transient_http_error";
    console.warn(`[TTS] ElevenLabs ${code}; retrying once in ${delayMs}ms`);
    await waitBeforeRetry(delayMs, opts?.signal);
    try {
      return { result: await provider.generate(text, opts), retryCount };
    } catch (retryError) {
      if (retryError && typeof retryError === "object") {
        (retryError as TTSProviderRequestError).retryCount = retryCount;
      }
      throw retryError;
    }
  }
}

/** Generate speech using the active provider (or `opts.providerId` if forced). */
export async function generateSpeech(text: string, opts?: TTSOptions): Promise<Blob> {
  const provider = opts?.providerId ? getProviderById(opts.providerId) : getActiveProvider();
  if (!opts?.cacheOpening || opts.speechAudition || opts.auditionModelId || opts.onAuditionRequest) return generateUncachedSpeech(provider, text, opts);
  const settings = provider.id === 'gradium' ? resolveGradiumSettings(opts.characterKey)
    : provider.id === 'inworld' ? getInworldSettings()
    : provider.id === 'fish' ? getFishSettings()
    : provider.id === 'cartesia' ? getCartesiaSettings() : getTTSSettings();
  const key = openingTTSCacheKey({ environmentId: getActiveEnvironment(), text, providerId: provider.id,
    voiceId: opts.voiceId, characterKey: opts.characterKey, settings, performance: opts.performance,
    previousText: opts.previousText, nextText: opts.nextText });
  const result = await getOpeningTTSBlob(key, async () => {
    let service: ServiceObservation | undefined;
    const blob = await generateUncachedSpeech(provider, text, { ...opts, onServiceObserved: value => {
      service = value;
      observeService(opts.onServiceObserved, value);
    } });
    return { blob, service };
  }, opts.signal);
  if (opts.signal?.aborted) throw createAbortError();
  if (result.cached) {
    // No fabricated provider generation timing on a replay; playback is measured anew.
    if (result.service) observeService(opts.onServiceObserved, { ...result.service, transport: 'cache', retry_count: 0 });
    observeVoice(opts.onVoiceObservation, 'audio_blob_ready');
  }
  return result.blob;
}

async function generateUncachedSpeech(provider: TTSProvider, text: string, opts?: TTSOptions): Promise<Blob> {
  const tRequest = performance.now();
  observeVoice(opts?.onVoiceObservation, "tts_text_sent", tRequest);
  try {
    const { result: { blob, meta }, retryCount } = await generateWithBoundedRetry(provider, text, opts);
    if (opts?.signal?.aborted) throw createAbortError();
    const totalElapsedMs = Math.round(performance.now() - tRequest);
    observeService(opts?.onServiceObserved, {
      service: "tts", requested_provider: opts?.providerId ?? provider.id, requested_model: meta.model ?? null,
      resolved_provider: provider.id, resolved_model: meta.model ?? null,
      effective_provider: meta.provider, effective_model: meta.model ?? null,
      transport: "rest", character_override: opts?.characterOverride ?? !!opts?.providerId, fallback: false, retry_count: retryCount,
    });
    observeVoice(opts?.onVoiceObservation, "audio_blob_ready");
    recordAudioLatency({
      session_id: opts?.session_id ?? undefined,
      turn_index: opts?.turn_index ?? undefined,
      direction: "out",
      t_tts_first_byte_ms: meta.firstByteMs,
      t_tts_total_ms: retryCount > 0 ? totalElapsedMs : meta.totalMs,
      tts_text_len: text.length,
      metadata: {
        turn_id: opts?.turn_id ?? null,
        attempt_id: opts?.attempt_id ?? null,
        provider: meta.provider,
        model: meta.model,
        status_code: meta.statusCode ?? 200,
        error_type: "ok",
        retry_count: retryCount,
        stitched_previous: !!opts?.previousText,
        stitched_next: !!opts?.nextText,
        performance_emotion: opts?.performance?.emotion ?? null,
        performance_intensity: opts?.performance?.intensity ?? null,
        performance_source: opts?.performance?.source ?? null,
        performance_speech_state: opts?.performance?.speechState ?? null,
        performance_mapping_version: opts?.performance?.mappingVersion ?? null,
      },
    });
    return blob;
  } catch (err) {
    const totalMs = Math.round(performance.now() - tRequest);
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const providerErrorCode = (err as TTSProviderRequestError)?.providerErrorCode;
    const retryCount = (err as TTSProviderRequestError)?.retryCount ?? 0;
    recordAudioLatency({
      session_id: opts?.session_id ?? undefined,
      turn_index: opts?.turn_index ?? undefined,
      direction: "out",
      t_tts_total_ms: totalMs,
      tts_text_len: text.length,
      metadata: {
        turn_id: opts?.turn_id ?? null,
        attempt_id: opts?.attempt_id ?? null,
        provider: provider.id,
        status_code: statusCode ?? 0,
        error_type: classifyError(statusCode, message),
        error_message: message.slice(0, 500),
        provider_error_code: providerErrorCode ?? null,
        retry_count: retryCount,
      },
    });
    throw err;
  }
}

/**
 * Streaming playback entry point. Returns a progressive playback handle when
 * the active provider supports streaming and it's enabled, null otherwise —
 * callers then use the classic generateSpeech + playAudioBlob path. Telemetry
 * is recorded here with the same shape as generateSpeech (one record per
 * segment), plus `metadata.transport` for websocket/rest_fallback slicing.
 */
export function tryCreateStreamingPlayback(text: string, opts?: TTSOptions): TTSStreamPlaybackHandle | null {
  const provider = opts?.providerId ? getProviderById(opts.providerId) : getActiveProvider();
  if (!provider.createStreamingPlayback) return null;
  const handle = provider.createStreamingPlayback(text, opts);
  if (!handle) return null;

  const tRequest = performance.now();
  handle.generationDone.then(
    (stats) => {
      observeService(opts?.onServiceObserved, {
        service: "tts", requested_provider: opts?.providerId ?? provider.id, requested_model: stats.model ?? null,
        resolved_provider: provider.id, resolved_model: stats.model ?? null,
        effective_provider: stats.provider, effective_model: stats.model ?? null,
        transport: stats.transport, character_override: opts?.characterOverride ?? !!opts?.providerId,
        fallback: stats.transport === "rest_fallback", retry_count: 0,
      });
      recordAudioLatency({
        session_id: opts?.session_id ?? undefined,
        turn_index: opts?.turn_index ?? undefined,
        direction: "out",
        t_tts_first_byte_ms: stats.firstByteMs,
        t_tts_total_ms: stats.totalMs,
        tts_text_len: text.length,
        metadata: {
          turn_id: opts?.turn_id ?? null,
        attempt_id: opts?.attempt_id ?? null,
          provider: stats.provider,
          model: stats.model,
          status_code: stats.statusCode ?? 200,
          error_type: "ok",
          transport: stats.transport,
          performance_emotion: opts?.performance?.emotion ?? null,
          performance_source: opts?.performance?.source ?? null,
          performance_speech_state: opts?.performance?.speechState ?? null,
          performance_mapping_version: opts?.performance?.mappingVersion ?? null,
          buffer_preset: stats.bufferPreset ?? null,
          buffer_prebuffer_ms: stats.prebufferMs ?? null,
          buffer_rebuffer_ms: stats.rebufferMs ?? null,
          buffer_rebuffer_count: stats.rebufferCount ?? null,
          buffer_underrun_count: stats.underrunCount ?? null,
          buffer_max_gap_ms: stats.maxGapMs ?? null,
        },
      });
    },
    (err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof DOMException && err.name === "AbortError") return; // barge-in, not an error
      const statusCode = (err as { statusCode?: number })?.statusCode;
      recordAudioLatency({
        session_id: opts?.session_id ?? undefined,
        turn_index: opts?.turn_index ?? undefined,
        direction: "out",
        t_tts_total_ms: Math.round(performance.now() - tRequest),
        tts_text_len: text.length,
        metadata: {
          turn_id: opts?.turn_id ?? null,
        attempt_id: opts?.attempt_id ?? null,
          provider: provider.id,
          status_code: statusCode ?? 0,
          error_type: classifyError(statusCode, message),
          error_message: message.slice(0, 500),
          transport: "websocket",
        },
      });
    },
  );
  return handle;
}

/** Play an audio Blob through an <audio> element. */
export function playAudioBlob(
  blob: Blob,
  onPlaybackStart?: (playbackStartMs: number) => void,
  signal?: AbortSignal,
): Promise<PlaybackResult> {
  return playAudioBlobRobust(blob, undefined, onPlaybackStart, signal).then((result) => {
    if (result.status === "played") return result;
    const error = result.error || new Error("Audio playback failed");
    (error as Error & { playbackErrorType?: string }).playbackErrorType = result.errorInfo?.type;
    throw error;
  });
}

/** Convenience: generate + play. */
export async function speakText(text: string, opts?: TTSOptions): Promise<void> {
  const blob = await generateSpeech(text, opts);
  await playAudioBlob(blob, undefined, opts?.signal);
}
