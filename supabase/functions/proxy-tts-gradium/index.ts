// Gradium TTS proxy.
// - GET: mint a short-lived browser WebSocket token (no API key in client)
// - POST: REST batch via /api/post/speech/tts (only_audio=true → raw audio bytes)
// Docs: https://docs.gradium.ai/guides/text-to-speech-rest
// Advanced params live in json_config, passed as a URL-encoded JSON query param.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    if (req.method === "GET") {
      const tokenRes = await fetch("https://api.gradium.ai/api/api-keys/token", {
        headers: { "x-api-key": apiKey },
      });
      const tokenBody = await tokenRes.text();
      if (!tokenRes.ok) {
        console.error(`[proxy-tts-gradium] token ${tokenRes.status}: ${tokenBody.slice(0, 500)}`);
        return new Response(JSON.stringify({ error: `Gradium token ${tokenRes.status}` }), {
          status: tokenRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      return new Response(tokenBody, {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const requestedFormat = body.outputFormat || "wav";
    // Gradium does not support "mp3" — fall back to "wav" if a legacy client sends it.
    const outputFormat = requestedFormat === "mp3" ? "wav" : requestedFormat;
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

    // Pipe the upstream body straight through instead of buffering it, so the
    // client starts receiving audio while Gradium is still generating/sending.
    // (Empty-audio detection moved client-side: blob.size === 0 in gradium.ts.)
    const upstreamCT = response.headers.get("content-type") || "";
    console.log(`[proxy-tts-gradium] upstream ok status=${response.status} upstream-content-type=${upstreamCT} (streaming)`);
    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "Gradium returned no body", upstreamContentType: upstreamCT, format: outputFormat }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": CONTENT_TYPES[outputFormat] || "audio/wav",
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
