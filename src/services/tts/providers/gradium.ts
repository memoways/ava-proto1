/**
 * Gradium TTS provider — wraps the `proxy-tts-gradium` edge function.
 * Docs: https://docs.gradium.ai/guides/text-to-speech-rest
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getGradiumSettings } from "@/services/tts/providerSettings";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const gradiumProvider: TTSProvider = {
  id: "gradium",
  label: "Gradium TTS",
  description: "TTS Gradium (REST). Voix naturelles, latence faible, 237 voix.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = getGradiumSettings();
    const preparedText = prepareTextForTTS(text);
    const voiceId = ctx?.voiceId || s.voiceId;

    const body = {
      text: preparedText,
      voiceId,
      outputFormat: s.outputFormat,
      speed: s.speed,
      temperature: s.temperature,
      language: s.language,
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
};
