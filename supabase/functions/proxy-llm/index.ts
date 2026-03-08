import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_GENERATION_URL = "https://openrouter.ai/api/v1/generation";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMRequest {
  messages?: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  // Special action for cost lookup
  _action?: string;
  generation_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const body: LLMRequest = await req.json();

    // ===== GENERATION COST LOOKUP =====
    if (body._action === "get_generation_cost" && body.generation_id) {
      console.log(`[proxy-llm] Looking up generation cost for: ${body.generation_id}`);
      const genRes = await fetch(`${OPENROUTER_GENERATION_URL}?id=${body.generation_id}`, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        },
      });

      if (!genRes.ok) {
        const errText = await genRes.text();
        console.error(`[proxy-llm] OpenRouter generation lookup error [${genRes.status}]:`, errText);
        return new Response(
          JSON.stringify({ error: `Generation lookup failed: ${genRes.status}`, details: errText }),
          { status: genRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const genData = await genRes.json();
      console.log(`[proxy-llm] Generation data:`, JSON.stringify(genData));
      const data = genData.data || genData;
      return new Response(
        JSON.stringify({
          cost_usd: data.total_cost ?? data.usage ?? 0,
          prompt_tokens: data.tokens_prompt ?? data.native_tokens_prompt ?? 0,
          completion_tokens: data.tokens_completion ?? data.native_tokens_completion ?? 0,
          total_tokens: (data.tokens_prompt ?? 0) + (data.tokens_completion ?? 0),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STANDARD CHAT COMPLETION =====
    const model = body.model || "qwen/qwen-2.5-72b-instruct";
    const temperature = body.temperature ?? 0.8;
    const max_tokens = body.max_tokens ?? 500;
    const top_p = body.top_p ?? 0.95;
    const stream = body.stream ?? true;

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ava-prototype.lovable.app',
        'X-Title': 'AVA Prototype 1',
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature,
        max_tokens,
        top_p,
        stream,
        // Request usage info for tracking
        usage: { include: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `OpenRouter error: ${response.status}`, details: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For streaming, return the response body directly
    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // For non-streaming, return JSON
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in proxy-llm:', error);
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
