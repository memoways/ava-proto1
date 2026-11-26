/**
 * ElevenLabs raw PCM stream (lot T1): the first line of a Tavus "Ava voice" turn is read from
 * the `proxy-tts` body as it arrives instead of waiting for the whole blob, so the face can
 * start on the first 250 ms of audio. Only the first line takes this path; other providers,
 * the scripted opening (blob cache) and every later line keep the blob path.
 */

import { requestElevenLabsSpeech, buildElevenLabsRequest } from "@/services/tts/providers/elevenlabs";
import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";
import { observeService, observeVoice } from "@/services/voiceTurnTelemetryV2";
import type { TTSGenerateContext } from "@/services/tts/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Raw mono PCM16 at the Tavus Echo rate: no decoding, no resampling. */
export const ELEVENLABS_PCM_STREAM_FORMAT = "pcm_24000";
export const ELEVENLABS_PCM_STREAM_RATE = 24_000;

export interface PcmChunker {
  /** Complete chunks available after this read; an odd trailing byte is kept for the next one. */
  push(bytes: Uint8Array): Int16Array[];
  /** What is left at the end of the stream (a partial chunk, possibly empty). */
  flush(): Int16Array;
}

/** Cuts a byte stream into fixed `chunkMs` PCM16 chunks whatever the read boundaries are. */
export function createPcmChunker(sampleRate: number, chunkMs: number): PcmChunker {
  const chunkBytes = Math.max(1, Math.round((sampleRate * chunkMs) / 1000)) * 2;
  let pending = new Uint8Array(0);
  const toSamples = (bytes: Uint8Array): Int16Array => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Int16Array(bytes.byteLength >> 1);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true);
    return samples;
  };
  return {
    push(bytes) {
      if (bytes.length === 0) return [];
      const merged = new Uint8Array(pending.length + bytes.length);
      merged.set(pending);
      merged.set(bytes, pending.length);
      const chunks: Int16Array[] = [];
      let offset = 0;
      while (merged.length - offset >= chunkBytes) {
        chunks.push(toSamples(merged.subarray(offset, offset + chunkBytes)));
        offset += chunkBytes;
      }
      pending = merged.slice(offset);
      return chunks;
    },
    flush() {
      const samples = toSamples(pending.subarray(0, pending.length - (pending.length % 2)));
      pending = new Uint8Array(0);
      return samples;
    },
  };
}

export type ElevenLabsPcmStreamContext = TTSGenerateContext & {
  providerId?: string;
  characterOverride?: boolean;
};

/**
 * Opens the PCM stream. Rejects before the first byte on any request failure (the caller falls
 * back to the blob path) and returns null when the response has no readable body. The returned
 * iterable yields raw little-endian PCM16 bytes and records the turn's TTS telemetry.
 */
export async function openElevenLabsPcmStream(
  text: string,
  ctx: ElevenLabsPcmStreamContext,
  signal: AbortSignal,
  options: { recordTelemetry?: boolean } = {},
): Promise<AsyncGenerator<Uint8Array, void, void> | null> {
  // Local playback (lot 1) reports through `tryCreateStreamingPlayback` instead.
  const recordTelemetry = options.recordTelemetry ?? true;
  const { body, modelId, label } = buildElevenLabsRequest(text, ctx);
  const pcmBody = { ...body, outputFormat: ELEVENLABS_PCM_STREAM_FORMAT };
  const startTime = Date.now();
  const tRequest = performance.now();
  observeVoice(ctx.onVoiceObservation, "tts_text_sent", tRequest);
  const debugId = debugLogger.logFetch("tts", label, `${SUPABASE_URL}/functions/v1/proxy-tts`, pcmBody);
  const response = await requestElevenLabsSpeech(pcmBody, ctx.timeoutMs ?? 12000, signal, debugId, startTime);
  const reader = response.body?.getReader();
  if (!reader) return null;
  const tFirstByte = performance.now();
  const record = (error: unknown) => {
    if (!recordTelemetry) return;
    const statusCode = (error as { statusCode?: number } | null)?.statusCode;
    const message = error instanceof Error ? error.message : String(error ?? "");
    recordAudioLatency({
      session_id: ctx.session_id ?? undefined,
      turn_index: ctx.turn_index ?? undefined,
      direction: "out",
      ...(error ? {} : { t_tts_first_byte_ms: Math.round(tFirstByte - tRequest) }),
      t_tts_total_ms: Math.round(performance.now() - tRequest),
      tts_text_len: text.length,
      metadata: {
        turn_id: ctx.turn_id ?? null,
        attempt_id: ctx.attempt_id ?? null,
        provider: "elevenlabs",
        model: modelId,
        status_code: error ? statusCode ?? 0 : response.status,
        error_type: error ? "network" : "ok",
        ...(error ? { error_message: message.slice(0, 500) } : {}),
        transport: "http_stream_pcm",
        stitched_previous: !!ctx.previousText,
        stitched_next: !!ctx.nextText,
        performance_emotion: ctx.performance?.emotion ?? null,
        performance_source: ctx.performance?.source ?? null,
        performance_speech_state: ctx.performance?.speechState ?? null,
        performance_mapping_version: ctx.performance?.mappingVersion ?? null,
      },
    });
  };
  return (async function* () {
    let first = true;
    let completed = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        if (first) {
          first = false;
          observeVoice(ctx.onVoiceObservation, "first_audio_chunk");
        }
        yield value;
      }
      completed = true;
      observeVoice(ctx.onVoiceObservation, "audio_blob_ready");
      if (recordTelemetry) observeService(ctx.onServiceObserved, {
        service: "tts", requested_provider: ctx.providerId ?? "elevenlabs", requested_model: modelId,
        resolved_provider: "elevenlabs", resolved_model: modelId,
        effective_provider: "elevenlabs", effective_model: modelId,
        transport: "http_stream_pcm", character_override: ctx.characterOverride ?? !!ctx.providerId,
        fallback: false, retry_count: 0,
      });
      record(null);
    } catch (error) {
      if (!signal.aborted) record(error);
      throw error;
    } finally {
      if (!completed) void reader.cancel().catch(() => {});
    }
  })();
}
