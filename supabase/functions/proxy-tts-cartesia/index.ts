// Cartesia Sonic TTS proxy — POST /tts/bytes, returns binary audio to the client.
// Docs: https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
  generationConfig?: {
    speed?: number;
    volume?: number;
    emotion?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "proxy-tts-cartesia", corsHeaders);
  if (denied) return denied;

  try {
    const apiKey = Deno.env.get("CARTESIA_API_KEY");
    if (!apiKey) throw new Error("CARTESIA_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const voiceId = body.voiceId || "";
    if (!voiceId) throw new Error("Voice ID is required");

    const modelId = body.modelId || "sonic-3.5";
    const language = (body.language || "fr").trim() || "fr";
    const generationConfig: Record<string, unknown> = {};
    if (typeof body.generationConfig?.speed === "number") generationConfig.speed = body.generationConfig.speed;
    if (typeof body.generationConfig?.volume === "number") generationConfig.volume = body.generationConfig.volume;
    const langIsEnglish = language.toLowerCase() === "en" || language.toLowerCase().startsWith("en-");
    if (langIsEnglish && body.generationConfig?.emotion) {
      generationConfig.emotion = body.generationConfig.emotion;
    }

    const payload: Record<string, unknown> = {
      model_id: modelId,
      transcript: body.text,
      voice: { id: voiceId },
      language,
      output_format: {
        container: "mp3",
        encoding: "mp3",
        sample_rate: 44100,
      },
    };
    if (Object.keys(generationConfig).length > 0) payload.generation_config = generationConfig;

    console.log(
      `[proxy-tts-cartesia] model=${modelId} voice=${voiceId} lang=${language} emotion=${generationConfig.emotion ?? "omit"} text=${body.text.length}chars`,
    );

    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Cartesia-Version": "2026-08-14",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-cartesia] Cartesia error [${response.status}]:`, errorText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Cartesia error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Transfer-Encoding": "chunked" },
    });
  } catch (error: unknown) {
    console.error("[proxy-tts-cartesia] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
