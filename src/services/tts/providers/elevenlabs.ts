/**
 * ElevenLabs TTS provider — wraps the existing `proxy-tts` edge function.
 * Reads voice + voice-quality settings via `getTTSSettings()` from settingsService.
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getTTSSettings } from "@/services/settingsService";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const elevenLabsProvider: TTSProvider = {
  id: "elevenlabs",
  label: "ElevenLabs",
  description: "Voix expressive multilingue, request stitching pour prosodie continue.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const tts = getTTSSettings();
    const preparedText = prepareTextForTTS(text);

    const body = {
      text: preparedText,
      modelId: tts.modelId,
      stability: tts.stability,
      similarityBoost: tts.similarityBoost,
      style: tts.style,
      speed: tts.speed,
      useSpeakerBoost: tts.useSpeakerBoost,
      outputFormat: tts.outputFormat,
      optimizeStreamingLatency: tts.optimizeStreamingLatency,
      languageCode: tts.languageCode,
      applyTextNormalization: tts.applyTextNormalization,
      seed: tts.seed,
      ...(ctx?.voiceId ? { voiceId: ctx.voiceId } : {}),
      ...(ctx?.previousText ? { previousText: prepareTextForTTS(ctx.previousText) } : {}),
      ...(ctx?.nextText ? { nextText: prepareTextForTTS(ctx.nextText) } : {}),
    };

    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-EL "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts`, body);
    const timeout = createTimeoutSignal(12000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    }).finally(timeout.cancel);
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-EL", response.status, startTime, err);
      const error = new Error(`TTS error: ${response.status} - ${err}`);
      (error as Error & { statusCode?: number }).statusCode = response.status;
      throw error;
    }

    const blob = await withTimeout("tts_elevenlabs_blob", response.blob(), 12000);
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-EL (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "elevenlabs",
        model: tts.modelId,
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },
};
