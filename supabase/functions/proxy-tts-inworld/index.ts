// Inworld TTS proxy — POST /tts/v1/voice, returns binary MP3 to the client.
// Docs: https://docs.inworld.ai (TTS REST API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  text: string;
  voiceId?: string;
  modelId?: string;
  temperature?: number;
  languageCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("INWORLD_API_KEY");
    if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const voiceId = body.voiceId || "Hades";
    const modelId = body.modelId || "inworld-tts-1";

    const payload = {
      text: body.text,
      voiceId,
      modelId,
      ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
      audioConfig: { audioEncoding: "MP3", sampleRateHertz: 44100 },
    };

    console.log(`[proxy-tts-inworld] model=${modelId} voice=${voiceId} lang=${body.languageCode || "fr"} text=${body.text.length}chars`);

    // Inworld accepts the API key directly via Basic auth (base64 of "<key>")
    const auth = `Basic ${btoa(apiKey)}`;

    const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-inworld] Inworld error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `Inworld error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Inworld returns { audioContent: "<base64-mp3>" }
    const data = await response.json();
    const b64 = data.audioContent || data.audio_content || data.audio;
    if (!b64) {
      console.error("[proxy-tts-inworld] No audio in response:", JSON.stringify(data).slice(0, 300));
      return new Response(
        JSON.stringify({ error: "Inworld returned no audio", raw: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audioBytes = base64Decode(b64);
    return new Response(audioBytes, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (error: unknown) {
    console.error("[proxy-tts-inworld] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
