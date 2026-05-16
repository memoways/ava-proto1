// Hume Octave TTS proxy — POST /v0/tts/file, returns binary audio to the client.
// Docs: https://dev.hume.ai/docs/text-to-speech-tts/overview
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text: string;
  voiceName?: string;
  voiceProvider?: "HUME_AI" | "CUSTOM_VOICE";
  description?: string;
  format?: "mp3" | "wav" | "pcm";
  languageCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("HUME_API_KEY");
    if (!apiKey) throw new Error("HUME_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const voiceName = body.voiceName || "Male English Actor";
    const voiceProvider = body.voiceProvider || "HUME_AI";
    const format = body.format || "mp3";

    const utterance: Record<string, unknown> = {
      text: body.text,
      voice: { name: voiceName, provider: voiceProvider },
    };
    if (body.description) utterance.description = body.description;

    const payload = {
      utterances: [utterance],
      format: { type: format },
      num_generations: 1,
    };

    console.log(`[proxy-tts-hume] voice=${voiceName} provider=${voiceProvider} fmt=${format} lang=${body.languageCode || "fr"} text=${body.text.length}chars desc=${body.description ? "yes" : "no"}`);

    // /v0/tts/file streams audio bytes directly.
    const response = await fetch("https://api.hume.ai/v0/tts/file", {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-hume] Hume error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `Hume error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = format === "wav" ? "audio/wav" : format === "pcm" ? "audio/pcm" : "audio/mpeg";
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": contentType, "Transfer-Encoding": "chunked" },
    });
  } catch (error: unknown) {
    console.error("[proxy-tts-hume] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
