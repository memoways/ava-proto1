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
import type { TTSGenerateContext, TTSProviderId } from "@/services/tts/types";
import { recordAudioLatency } from "@/services/latencyTelemetry";

export { prepareTextForTTS } from "@/services/tts/textPrep";
export { chunkTextForTTS, extractSentences } from "@/services/tts/textChunking";

export interface TTSOptions extends TTSGenerateContext {
  /** Force a specific provider for this call (ignored by TTSQueue). */
  providerId?: TTSProviderId;
}

function classifyError(statusCode: number | undefined, message: string): "quota" | "auth" | "network" | "server" | "client" | "unknown" {
  if (!statusCode) {
    if (/network|fetch|abort/i.test(message)) return "network";
    return "unknown";
  }
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 429 || /quota|credits/i.test(message)) return "quota";
  if (statusCode >= 500) return "server";
  if (statusCode >= 400) return "client";
  return "unknown";
}

/** Generate speech using the active provider (or `opts.providerId` if forced). */
export async function generateSpeech(text: string, opts?: TTSOptions): Promise<Blob> {
  const provider = opts?.providerId ? getProviderById(opts.providerId) : getActiveProvider();
  const tRequest = performance.now();
  try {
    const { blob, meta } = await provider.generate(text, opts);
    recordAudioLatency({
      direction: "out",
      t_tts_first_byte_ms: meta.firstByteMs,
      t_tts_total_ms: meta.totalMs,
      tts_text_len: text.length,
      metadata: {
        provider: meta.provider,
        model: meta.model,
        status_code: meta.statusCode ?? 200,
        error_type: "ok",
        stitched_previous: !!opts?.previousText,
        stitched_next: !!opts?.nextText,
      },
    });
    return blob;
  } catch (err) {
    const totalMs = Math.round(performance.now() - tRequest);
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as { statusCode?: number })?.statusCode;
    recordAudioLatency({
      direction: "out",
      t_tts_total_ms: totalMs,
      tts_text_len: text.length,
      metadata: {
        provider: provider.id,
        status_code: statusCode ?? 0,
        error_type: classifyError(statusCode, message),
        error_message: message.slice(0, 500),
      },
    });
    throw err;
  }
}

/** Play an audio Blob through an <audio> element. */
export function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
    audio.onerror = (e) => { URL.revokeObjectURL(audioUrl); reject(new Error(`Audio playback failed: ${e}`)); };
    audio.play().catch(reject);
  });
}

/** Convenience: generate + play. */
export async function speakText(text: string, opts?: TTSOptions): Promise<void> {
  const blob = await generateSpeech(text, opts);
  await playAudioBlob(blob);
}
