// Gradium TTS proxy — POST /api/post/speech/tts (only_audio=true → raw audio bytes).
// Docs: https://docs.gradium.ai/guides/text-to-speech-rest
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text: string;
  voiceId?: string;
  outputFormat?: "wav" | "mp3" | "opus" | "pcm";
  speed?: number;
  temperature?: number;
  language?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  pcm: "audio/pcm",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GRADIUM_API_KEY");
    if (!apiKey) throw new Error("GRADIUM_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const outputFormat = body.outputFormat || "mp3";
    const payload: Record<string, unknown> = {
      text: body.text,
      voice_id: body.voiceId || "YTpq7expH9539ERJ",
      output_format: outputFormat,
      only_audio: true,
    };
    if (typeof body.speed === "number") payload.speed = body.speed;
    if (typeof body.temperature === "number") payload.temperature = body.temperature;
    if (body.language) payload.language = body.language;

    console.log(
      `[proxy-tts-gradium] voice=${payload.voice_id} format=${outputFormat} text=${body.text.length}chars`,
    );

    const response = await fetch("https://api.gradium.ai/api/post/speech/tts", {
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
