// Gradium TTS proxy — POST /api/post/speech/tts (only_audio=true → raw audio bytes).
// Docs: https://docs.gradium.ai/guides/text-to-speech-rest
// Advanced params live in json_config, passed as a URL-encoded JSON query param.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text: string;
  voiceId?: string;
  outputFormat?: string;
  jsonConfig?: Record<string, unknown>;
}

// Note: Gradium API does NOT support "mp3" — supported formats per
// https://docs.gradium.ai/api-reference/endpoint/tts-post
const CONTENT_TYPES: Record<string, string> = {
  wav: "audio/wav",
  opus: "audio/ogg",
  pcm: "audio/pcm",
  ulaw_8000: "audio/basic",
  mulaw_8000: "audio/basic",
  alaw_8000: "audio/basic",
  pcm_8000: "audio/pcm",
  pcm_16000: "audio/pcm",
  pcm_22050: "audio/pcm",
  pcm_24000: "audio/pcm",
  pcm_44100: "audio/pcm",
  pcm_48000: "audio/pcm",
};


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "proxy-tts-gradium", corsHeaders);
  if (denied) return denied;

  try {
    const apiKey = Deno.env.get("GRADIUM_API_KEY");
    if (!apiKey) throw new Error("GRADIUM_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const outputFormat = body.outputFormat || "mp3";
    const payload: Record<string, unknown> = {
      text: body.text,
      voice_id: body.voiceId || "b5ioHAR7JuHVLskk",
      output_format: outputFormat,
      only_audio: true,
    };

    // Build json_config URL-encoded query param (Gradium REST spec).
    const url = new URL("https://api.gradium.ai/api/post/speech/tts");
    if (body.jsonConfig && Object.keys(body.jsonConfig).length > 0) {
      url.searchParams.set("json_config", JSON.stringify(body.jsonConfig));
    }

    console.log(
      `[proxy-tts-gradium] voice=${payload.voice_id} format=${outputFormat} text=${body.text.length}chars json_config=${JSON.stringify(body.jsonConfig ?? {})}`,
    );

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-gradium] error [${response.status}]:`, errorText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Gradium error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audio = await response.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": CONTENT_TYPES[outputFormat] || "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("[proxy-tts-gradium] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
