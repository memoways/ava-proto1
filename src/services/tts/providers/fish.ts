/**
 * Fish Audio TTS provider — wraps the `proxy-tts-fish` edge function.
 * Settings live under admin_settings key `ava_tts_settings_fish`.
 * Emotion markers are injected here from the turn state, never by the LLM.
 */

import type { TTSProvider, TTSGenerateContext, TTSGenerateResult } from "@/services/tts/types";
import { getFishSettings } from "@/services/tts/providerSettings";
import { applyFishPerformance, expressiveTemperature } from "@/services/tts/performanceIntent";
import { debugLogger } from "@/services/debugLogger";
import { prepareTextForTTS } from "@/services/tts/textPrep";
import { createTimeoutSignal, withTimeout } from "@/services/asyncUtils";
import { authenticatedFunctionFetch } from "@/services/gameAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/proxy-tts-fish`;

export const fishProvider: TTSProvider = {
  id: "fish",
  label: "Fish Audio",
  description: "TTS expressif, marqueurs d'émotion (S1) et vitesse pilotés par l'état du tour.",

  async generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult> {
    const s = getFishSettings();
    const shaped = applyFishPerformance(s, prepareTextForTTS(text), ctx?.performance);
    const body = {
      text: shaped.text,
      referenceId: ctx?.voiceId || s.referenceId || undefined,
      model: s.model,
      format: s.format,
      mp3Bitrate: s.mp3Bitrate,
      latency: s.latency,
      temperature: expressiveTemperature(s.temperature, ctx?.performance),
      topP: s.topP,
      speed: shaped.speed,
      volume: s.volume,
      normalize: s.normalize,
      chunkLength: s.chunkLength,
    };

    ctx?.onAuditionRequest?.({ transport: 'rest', body });
    const startTime = Date.now();
    const tRequest = performance.now();
    const debugId = debugLogger.logFetch("tts", `TTS-Fish "${shaped.text.slice(0, 60)}…"`, ENDPOINT, body);
    const timeout = createTimeoutSignal((ctx?.timeoutMs ?? 12000), ctx?.signal);

    const response = await authenticatedFunctionFetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    }).finally(timeout.cancel);
    const tFirstByte = performance.now();

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "tts", "TTS-Fish", response.status, startTime, err);
      const error = new Error(`Fish Audio TTS error: ${response.status} - ${err}`);
      (error as Error & { statusCode?: number }).statusCode = response.status;
      throw error;
    }

    const blob = await withTimeout("tts_fish_blob", response.blob(), (ctx?.timeoutMs ?? 12000));
    const tEnd = performance.now();
    debugLogger.logResponse(debugId, "tts", `TTS-Fish (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);

    return {
      blob,
      meta: {
        provider: "fish",
        model: s.model,
        statusCode: response.status,
        firstByteMs: Math.round(tFirstByte - tRequest),
        totalMs: Math.round(tEnd - tRequest),
      },
    };
  },
};
