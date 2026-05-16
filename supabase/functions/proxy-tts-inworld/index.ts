// Inworld TTS proxy — streams audio from POST /tts/v1/voice:stream and pipes
// concatenated MP3 frames back to the client (audio/mpeg). Falls back to the
// non-streaming /tts/v1/voice endpoint if streaming is unavailable.
//
// Docs: https://docs.inworld.ai/tts/tts.md
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
  deliveryMode?: "STABLE" | "BALANCED" | "CREATIVE";
  language?: string;
  speakingRate?: number;
  stream?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("INWORLD_API_KEY");
    if (!apiKey) throw new Error("INWORLD_API_KEY is not configured");

    const body: ReqBody = await req.json();
    if (!body.text?.trim()) throw new Error("Text is required");

    const voiceId = body.voiceId || "Alain";
    const modelId = body.modelId || "inworld-tts-2";
    const deliveryMode = body.deliveryMode || "BALANCED";
    const language = body.language || "AUTO";
    const speakingRate = typeof body.speakingRate === "number" ? body.speakingRate : 1;
    const wantStream = body.stream !== false; // default true
    const isLegacyModel = /^inworld-tts-1/.test(modelId);

    // Inworld accepts the API key directly via Basic auth.
    // The key the user provided is already base64 — do NOT re-encode.
    const auth = `Basic ${apiKey}`;

    console.log(
      `[proxy-tts-inworld] model=${modelId} voice=${voiceId} lang=${language} mode=${deliveryMode} stream=${wantStream} text=${body.text.length}chars`,
    );

    if (wantStream) {
      // ---- Streaming endpoint (snake_case payload) ----
      const streamPayload: Record<string, unknown> = {
        text: body.text,
        voice_id: voiceId,
        model_id: modelId,
        audio_config: { audio_encoding: "MP3", speaking_rate: speakingRate },
      };
      if (isLegacyModel) {
        if (typeof body.temperature === "number") streamPayload.temperature = body.temperature;
      } else {
        streamPayload.delivery_mode = deliveryMode;
        streamPayload.language = language;
      }

      const response = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(streamPayload),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error(`[proxy-tts-inworld] stream error [${response.status}]:`, errorText.slice(0, 500));
        return new Response(
          JSON.stringify({ error: `Inworld error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Pipe NDJSON → decoded MP3 bytes as a streamed response.
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";

      const audioStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                tryEmitLine(buffer, controller);
              }
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            let nlIdx;
            while ((nlIdx = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, nlIdx).trim();
              buffer = buffer.slice(nlIdx + 1);
              if (line) tryEmitLine(line, controller);
            }
            // Return control to consumer between network reads.
            return;
          }
        },
        cancel(reason) {
          try { reader.cancel(reason); } catch { /* ignore */ }
        },
      });

      return new Response(audioStream, {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      });
    }

    // ---- Non-streaming fallback ----
    const payload: Record<string, unknown> = {
      text: body.text,
      voiceId,
      modelId,
      audioConfig: { audioEncoding: "MP3", speakingRate },
    };
    if (isLegacyModel) {
      if (typeof body.temperature === "number") payload.temperature = body.temperature;
    } else {
      payload.deliveryMode = deliveryMode;
      payload.language = language;
    }

    const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy-tts-inworld] error [${response.status}]:`, errorText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Inworld error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

function tryEmitLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    const obj = JSON.parse(line);
    const b64 =
      obj?.result?.audioContent ||
      obj?.result?.audio_content ||
      obj?.audioContent ||
      obj?.audio_content;
    if (b64) controller.enqueue(base64Decode(b64));
    else if (obj?.error) {
      console.error("[proxy-tts-inworld] stream chunk error:", JSON.stringify(obj.error).slice(0, 300));
    }
  } catch (err) {
    console.warn("[proxy-tts-inworld] bad NDJSON line:", line.slice(0, 120), err);
  }
}
