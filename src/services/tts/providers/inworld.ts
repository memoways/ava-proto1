/**
 * Inworld TTS provider — wraps the `proxy-tts-inworld` edge function.
 * Settings live under admin_settings key `ava_tts_settings_inworld`.
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getInworldSettings } from "@/services/tts/providerSettings";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const inworldProvider: TTSProvider = {
  id: "inworld",
  label: "Inworld TTS",
  description: "TTS Inworld (modèles inworld-tts-1 / -max). Voix expressive, latence faible.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = getInworldSettings();
    const preparedText = prepareTextForTTS(text);
    const voiceId = ctx?.voiceId || s.voiceId;

    const body = {
      text: preparedText,
      voiceId,
      modelId: s.modelId,
      deliveryMode: s.deliveryMode,
      language: s.language,
      speakingRate: s.speakingRate,
      temperature: s.temperature,
      stream: false,
    };

    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-IW "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts-inworld`, body);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-tts-inworld`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-IW", response.status, startTime, err);
      const error = new Error(`Inworld TTS error: ${response.status} - ${err}`);
      (error as any).statusCode = response.status;
      throw error;
    }

    const blob = await response.blob();
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-IW (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "inworld",
        model: s.modelId,
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },
};
