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
  const gamilabPortalToken = Deno.env.get("GAMILAB_API_KEY") || null;

  return new Response(
    JSON.stringify({
      gamilabPortalId,
      gamilabPortalToken,
      configured: {
        deepgram: Boolean(Deno.env.get("DEEPGRAM_API_KEY")),
        gamilab: Boolean(gamilabPortalId && gamilabPortalToken),
        openai_whisper: Boolean(Deno.env.get("OPENAI_API_KEY")),
        assemblyai: Boolean(Deno.env.get("ASSEMBLYAI_API_KEY")),
      },
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
