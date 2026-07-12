import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const gamilabPortalId = Deno.env.get("GAMILAB_PORTAL_ID") || null;
  const hasGamilabToken = Boolean(Deno.env.get("GAMILAB_API_KEY"));

  // NOTE: We intentionally do NOT return GAMILAB_API_KEY in the response.
  // Any client-side Gamilab initialisation must go through a dedicated
  // server-side proxy that keeps the secret token on the edge.
  return new Response(
    JSON.stringify({
      gamilabPortalId,
      configured: {
        deepgram: Boolean(Deno.env.get("DEEPGRAM_API_KEY")),
        gamilab: Boolean(gamilabPortalId && hasGamilabToken),
        openai_whisper: Boolean(Deno.env.get("OPENAI_API_KEY")),
        assemblyai: Boolean(Deno.env.get("ASSEMBLYAI_API_KEY")),
        gradium: Boolean(Deno.env.get("GRADIUM_API_KEY")),
      },
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
