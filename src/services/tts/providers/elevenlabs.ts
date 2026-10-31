/**
 * ElevenLabs TTS provider — wraps the existing `proxy-tts` edge function.
 * Reads voice + voice-quality settings via `getTTSSettings()` from settingsService.
 */

import type {
  TTSGenerateContext,
  TTSGenerateResult,
  TTSProvider,
  TTSProviderRequestError,
  TTSStreamPlaybackHandle,
} from "@/services/tts/types";
import { getTTSSettings } from "@/services/settingsService";
import { applyElevenLabsPerformance } from "@/services/tts/performanceIntent";
import { supportsElevenLabsAudioTags } from "../../../../supabase/functions/_shared/elevenLabsModels";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { createElevenLabsStreamingPlayback, resolveMp3MediaSource } from "@/services/tts/elevenLabsStreamPlayer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

export function parseElevenLabsErrorDetails(raw: string): {
  type?: string;
  code?: string;
  message?: string;
} {
  const outer = parseJsonRecord(raw);
  const rawDetails = outer?.details;
  const providerBody = typeof rawDetails === "string"
    ? parseJsonRecord(rawDetails)
    : asRecord(rawDetails) ?? outer;
  const detail = asRecord(providerBody?.detail) ?? providerBody;
  const type = typeof detail?.type === "string" ? detail.type : undefined;
  const codeCandidate = detail?.code ?? detail?.status;
  const code = typeof codeCandidate === "string" ? codeCandidate : undefined;
  const messageCandidate = detail?.message;
  const message = typeof messageCandidate === "string" ? messageCandidate.slice(0, 200) : undefined;
  return { type, code, message };
}

/**
 * Lot G1: v4 Turbo reads « Ava » the English way (heard « Éva ») although the
 * request is `language_code: fr`; text and STT both said « Ava ». The expressive
 * models (audio tags: v3/v4) get a French phonetic spelling; v2/Flash keep the
 * written name. Spelling chosen by ear in the G1.2 recette.
 */
export const ELEVENLABS_AVA_SPELLING = "Ahva";

export function prepareElevenLabsText(text: string, modelId: string): string {
  const prepared = prepareTextForTTS(text);
  return supportsElevenLabsAudioTags(modelId) ? prepared.replace(/\bAva\b/g, ELEVENLABS_AVA_SPELLING) : prepared;
}

/** Request body for `proxy-tts`, shared by the blob and streaming paths. */
export function buildElevenLabsRequest(text: string, ctx?: TTSGenerateContext) {
  const tts = getTTSSettings();
  const modelId = ctx?.auditionModelId ?? tts.modelId;
  const shaped = applyElevenLabsPerformance(
    { style: tts.style, stability: tts.stability, speed: tts.speed, modelId },
    prepareElevenLabsText(text, modelId),
    ctx?.performance,
  );
  const body = {
    text: shaped.text,
    modelId,
    stability: shaped.stability,
    similarityBoost: tts.similarityBoost,
    style: shaped.style,
    speed: shaped.speed,
    useSpeakerBoost: tts.useSpeakerBoost,
    outputFormat: tts.outputFormat,
    optimizeStreamingLatency: tts.optimizeStreamingLatency,
    languageCode: tts.languageCode,
    applyTextNormalization: tts.applyTextNormalization,
    seed: tts.seed,
    ...(ctx?.voiceId ? { voiceId: ctx.voiceId } : {}),
    ...(ctx?.previousText ? { previousText: prepareElevenLabsText(ctx.previousText, modelId) } : {}),
    ...(ctx?.nextText ? { nextText: prepareElevenLabsText(ctx.nextText, modelId) } : {}),
  };
  return { body, modelId, label: `TTS-EL "${shaped.text.slice(0, 60)}…"` };
}

/**
 * POSTs to `proxy-tts` and resolves on response headers (the proxy relays the
 * ElevenLabs `/stream` body chunked). The timeout covers the headers only.
 */
export async function requestElevenLabsSpeech(
  body: ReturnType<typeof buildElevenLabsRequest>["body"],
  timeoutMs: number,
  signal: AbortSignal | undefined,
  debugId: string,
  startTime: number,
): Promise<Response> {
  const timeout = createTimeoutSignal(timeoutMs, signal);
  const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: timeout.signal,
  }).finally(timeout.cancel);
  if (response.ok) return response;
  const err = await response.text();
  debugLogger.logResponse(debugId, "tts", "TTS-EL", response.status, startTime, err);
  const details = parseElevenLabsErrorDetails(err);
  const suffix = `${details.code ? ` (${details.code})` : ""}${details.message ? `: ${details.message}` : ""}`;
  const error = new Error(`ElevenLabs TTS error: ${response.status}${suffix}`) as TTSProviderRequestError;
  error.statusCode = response.status;
  error.providerErrorType = details.type;
  error.providerErrorCode = details.code;
  throw error;
}

export const elevenLabsProvider: TTSProvider = {
  id: "elevenlabs",
  label: "ElevenLabs",
  description: "Voix expressive multilingue, request stitching pour prosodie continue.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const { body, modelId, label } = buildElevenLabsRequest(text, ctx);
    ctx?.onAuditionRequest?.({ transport: 'rest', body });
    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", label, `${SUPABASE_URL}/functions/v1/proxy-tts`, body);
    const response = await requestElevenLabsSpeech(body, ctx?.timeoutMs ?? 12000, ctx?.signal, debugId, startTime);
    const tFirstByte = performance.now();

    const blob = await withTimeout("tts_elevenlabs_blob", response.blob(), (ctx?.timeoutMs ?? 12000));
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-EL (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "elevenlabs",
        model: modelId,
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },

  /**
   * Progressive MP3 playback (L1.1). Workshop auditions keep the blob path (they
   * capture the exact audio), the scripted opening keeps its blob cache, and
   * non-MP3 formats or engines without MediaSource MP3 return null.
   */
  createStreamingPlayback(text: string, ctx?: TTSGenerateContext): TTSStreamPlaybackHandle | null {
    if (ctx?.speechAudition || ctx?.auditionModelId || ctx?.onAuditionRequest
      || (ctx as { cacheOpening?: boolean } | undefined)?.cacheOpening) return null;
    if (!getTTSSettings().outputFormat.startsWith("mp3_") || !resolveMp3MediaSource()) return null;
    const { body, modelId, label } = buildElevenLabsRequest(text, ctx);
    return createElevenLabsStreamingPlayback(ctx, {
      model: modelId,
      label,
      request: (signal, debugId, startTime) => requestElevenLabsSpeech(body, ctx?.timeoutMs ?? 12000, signal, debugId, startTime),
      generateBlob: () => elevenLabsProvider.generate(text, ctx),
    });
  },
};

/** Admin diagnostic: TTS models the ElevenLabs account can really use (needs the deployed `proxy-tts` list_models action). */
export async function fetchElevenLabsAccountModels(): Promise<{ id: string; name?: string }[]> {
  const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_models" }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`ElevenLabs models error: ${response.status}${parseElevenLabsErrorDetails(raw).message ? `: ${parseElevenLabsErrorDetails(raw).message}` : ""}`);
  return (parseJsonRecord(raw)?.models as { id: string; name?: string }[] | undefined) ?? [];
}
