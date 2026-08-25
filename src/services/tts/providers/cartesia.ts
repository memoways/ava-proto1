/**
 * Cartesia Sonic TTS provider — wraps `proxy-tts-cartesia`.
 * Emotion tags are English-only; French requests send speed/volume only.
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getCartesiaSettings } from "@/services/tts/providerSettings";
import { applyCartesiaGenerationConfig } from "@/services/tts/performanceIntent";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const cartesiaProvider: TTSProvider = {
  id: "cartesia",
  label: "Cartesia Sonic",
  description: "TTS Sonic 3.5 — volume/vitesse par tour ; émotion nommée seulement en anglais.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = getCartesiaSettings();
    const preparedText = prepareTextForTTS(text);
    const voiceId = ctx?.voiceId || s.voiceId;
    const generationConfig = applyCartesiaGenerationConfig(ctx?.performance, s.language);

    const body = {
      text: preparedText,
      voiceId,
      modelId: s.modelId,
      language: s.language,
      generationConfig,
    };

    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-CA "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts-cartesia`, body);
    const timeout = createTimeoutSignal(12000, ctx?.signal);

    const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-tts-cartesia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    }).finally(timeout.cancel);
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-CA", response.status, startTime, err);
      const error = new Error(`Cartesia TTS error: ${response.status} - ${err}`);
      (error as Error & { statusCode?: number }).statusCode = response.status;
      throw error;
    }

    const blob = await withTimeout("tts_cartesia_blob", response.blob(), 12000);
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-CA (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "cartesia",
        model: s.modelId,
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },
};
