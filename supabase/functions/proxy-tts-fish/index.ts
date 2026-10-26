// Fish Audio TTS proxy — POST https://api.fish.audio/v1/tts, returns binary audio.
// Docs: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = new Set(["s1", "speech-1.6", "speech-1.5"]);
const FORMATS = new Set(["mp3", "wav", "pcm", "opus"]);
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

interface ReqBody {
  text: string;
  referenceId?: string;
  model?: string;
  format?: string;
  mp3Bitrate?: number;
  latency?: string;
  temperature?: number;
  topP?: number;
  speed?: number;
  volume?: number;
  normalize?: boolean;
  chunkLength?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "proxy-tts-fish", corsHeaders);
  if (denied) return denied;

  try {
    const apiKey = Deno.env.get("FISH_AUDIO_API_KEY");
    if (!apiKey) throw new Error("FISH_AUDIO_API_KEY is not configured");

    const body: ReqBody = await req.json();
    const text = body.text?.trim();
    if (!text) throw new Error("Text is required");
    if (text.length > 5000) throw new Error("Text too long");

    const model = MODELS.has(body.model ?? "") ? body.model! : "s1";
    const format = FORMATS.has(body.format ?? "") ? body.format! : "mp3";
    const payload: Record<string, unknown> = {
      text,
      format,
      latency: body.latency === "normal" ? "normal" : "balanced",
      temperature: clamp(body.temperature, 0, 1, 0.7),
      top_p: clamp(body.topP, 0, 1, 0.7),
      normalize: body.normalize !== false,
      chunk_length: clamp(body.chunkLength, 100, 300, 200),
      prosody: { speed: clamp(body.speed, 0.5, 2, 1), volume: clamp(body.volume, -10, 10, 0) },
    };
    if (format === "mp3") payload.mp3_bitrate = [64, 128, 192].includes(body.mp3Bitrate ?? 0) ? body.mp3Bitrate : 128;
    if (body.referenceId?.trim()) payload.reference_id = body.referenceId.trim();

    console.log(`[proxy-tts-fish] model=${model} voice=${payload.reference_id ? "custom" : "default"} fmt=${format} text=${text.length}chars`);

    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", model },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-fish] Fish error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `Fish Audio error: ${response.status}`, details: errorText.slice(0, 500) }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = format === "wav" ? "audio/wav" : format === "pcm" ? "audio/pcm" : format === "opus" ? "audio/ogg" : "audio/mpeg";
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": contentType, "Transfer-Encoding": "chunked" },
    });
  } catch (error: unknown) {
    console.error("[proxy-tts-fish] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
