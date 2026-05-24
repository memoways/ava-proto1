import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not configured");

    // Universal Streaming v3 temporary token endpoint
    const url = "https://streaming.assemblyai.com/v3/token?expires_in_seconds=120";
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `AssemblyAI token ${res.status}: ${errText.slice(0, 300)}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(
      JSON.stringify({
        token: data.token,
        expires_in: data.expires_in_seconds || 120,
        sample_rate: 16000,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[proxy-stt-assemblyai]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
