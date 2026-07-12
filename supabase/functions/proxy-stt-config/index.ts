import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const denied = await enforceGameRequest(req, "proxy-stt-config", corsHeaders);
  if (denied) return denied;

  const gamilabPortalId = Deno.env.get("GAMILAB_PORTAL_ID") || null;
  const gamilabPortalToken = Deno.env.get("GAMILAB_API_KEY") || null;

  // The current Gamilab browser SDK requires this portal credential in
  // use_portal(). Keep the endpoint no-store and gate it with Phase 1 before
  // any external test; replace it with an ephemeral token if Gamilab offers one.
  return new Response(
    JSON.stringify({
      gamilabPortalId,
      gamilabPortalToken,
      configured: {
        deepgram: Boolean(Deno.env.get("DEEPGRAM_API_KEY")),
        gamilab: Boolean(gamilabPortalId && gamilabPortalToken),
        openai_whisper: Boolean(Deno.env.get("OPENAI_API_KEY")),
        assemblyai: Boolean(Deno.env.get("ASSEMBLYAI_API_KEY")),
        gradium: Boolean(Deno.env.get("GRADIUM_API_KEY")),
      },
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
