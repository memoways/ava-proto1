// Gradium STT proxy — batch mode via POST /api/post/speech/asr.
// Docs: https://docs.gradium.ai/guides/speech-to-text-rest
// Response is NDJSON; we aggregate `text` messages into one final string.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "proxy-stt-gradium", corsHeaders);
  if (denied) return denied;

  try {
    const apiKey = Deno.env.get("GRADIUM_API_KEY");
    if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");

    // Accept either multipart with `file`, or raw audio body.
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

    const startedAt = Date.now();
    const res = await fetch("https://api.gradium.ai/api/post/speech/asr", {
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

    // Parse NDJSON stream, aggregate text segments.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const parts: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg?.type === "text" && typeof msg.text === "string") parts.push(msg.text);
        } catch {
          // ignore non-JSON keepalive lines
        }
      }
    }
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer.trim());
        if (msg?.type === "text" && typeof msg.text === "string") parts.push(msg.text);
      } catch { /* ignore */ }
    }

    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    return new Response(
      JSON.stringify({ text, provider: "gradium", upstream_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[proxy-stt-gradium]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
