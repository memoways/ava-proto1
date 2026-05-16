/**
 * Hume Octave TTS provider — wraps the `proxy-tts-hume` edge function.
 * Settings live under admin_settings key `ava_tts_settings_hume`.
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getHumeSettings } from "@/services/tts/providerSettings";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const humeProvider: TTSProvider = {
  id: "hume",
  label: "Hume AI Octave",
  description: "TTS très expressif, contrôle prosodique par description textuelle.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = getHumeSettings();
    const preparedText = prepareTextForTTS(text);
    const voiceName = ctx?.voiceId || s.voiceName;

    const body = {
      text: preparedText,
      voiceName,
      voiceProvider: s.voiceProvider,
      description: s.description || undefined,
      format: s.format,
      languageCode: s.languageCode,
    };

    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-Hume "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts-hume`, body);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-tts-hume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-Hume", response.status, startTime, err);
      const error = new Error(`Hume TTS error: ${response.status} - ${err}`);
      (error as any).statusCode = response.status;
      throw error;
    }

    const blob = await response.blob();
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-Hume (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "hume",
        model: "octave",
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },
};
