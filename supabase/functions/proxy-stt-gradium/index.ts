// Gradium STT proxy — batch mode via POST /api/post/speech/asr.
// Docs: https://docs.gradium.ai/guides/speech-to-text-rest
// Response is NDJSON. We stream it back to the client verbatim so the browser
// can display partial transcripts as they arrive (Gradium emits multiple
// `text` segments before the final one).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-gradium-upstream-status",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "proxy-stt-gradium", corsHeaders);
  if (denied) return denied;

  try {
    const apiKey = Deno.env.get("GRADIUM_API_KEY");
    if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");

    let audio: ArrayBuffer;
    let contentType = req.headers.get("content-type") || "application/octet-stream";
    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: "Missing 'file' field" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      audio = await file.arrayBuffer();
      contentType = file.type || "audio/webm";
    } else {
      audio = await req.arrayBuffer();
    }

    const reqUrl = new URL(req.url);
    const language = reqUrl.searchParams.get("language") || "";
    const upstream = new URL("https://api.gradium.ai/api/post/speech/asr");
    if (language && language !== "auto") {
      upstream.searchParams.set("json_config", JSON.stringify({ language }));
    }
    const res = await fetch(upstream.toString(), {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": contentType },
      body: audio,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      console.error(`[proxy-stt-gradium] ${res.status}: ${errText.slice(0, 500)}`);
      return new Response(
        JSON.stringify({ error: `Gradium ${res.status}: ${errText.slice(0, 500)}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Stream NDJSON straight through so the client sees partials in real time.
    return new Response(res.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "x-gradium-upstream-status": String(res.status),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[proxy-stt-gradium]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
