import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is not configured');
    }

    // Return the temporary Deepgram API key for client-side WebSocket connection
    // In production, use Deepgram's temporary key API for better security
    const response = await fetch('https://api.deepgram.com/v1/manage/keys', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    // For the prototype, we return the key directly
    // The client will use it to establish a WebSocket connection to Deepgram
    return new Response(
      JSON.stringify({ 
        key: DEEPGRAM_API_KEY,
        model: 'nova-2',
        language: 'fr',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in proxy-stt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
