import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Short-lived Deepgram token TTL (seconds). Long enough to open the WebSocket
// and cover a typical game turn, short enough that a leaked token is useless.
const TOKEN_TTL_SECONDS = 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const denied = await enforceGameRequest(req, "proxy-stt", corsHeaders);
  if (denied) return denied;

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is not configured');
    }

    // Request a short-lived scoped token from Deepgram instead of returning
    // the permanent project key to the browser.
    const grantRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
    });

    if (!grantRes.ok) {
      const errText = await grantRes.text();
      console.error(`[proxy-stt] Deepgram grant error [${grantRes.status}]:`, errText);
      const forbidden = grantRes.status === 403;
      return new Response(
        JSON.stringify({
          error: forbidden
            ? 'Deepgram API key needs Member permission for temporary tokens'
            : `Deepgram grant failed: ${grantRes.status}`,
          code: forbidden ? 'DEEPGRAM_GRANT_PERMISSION' : 'DEEPGRAM_GRANT_FAILED',
          upstream_status: grantRes.status,
          details: errText,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const grant = await grantRes.json();
    const shortLivedToken = grant.access_token ?? grant.token;
    if (!shortLivedToken) {
      throw new Error('Deepgram grant response missing access_token');
    }

    return new Response(
      JSON.stringify({
        key: shortLivedToken,
        expires_in: grant.expires_in ?? TOKEN_TTL_SECONDS,
        model: 'nova-2',
        language: 'fr',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in proxy-stt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
