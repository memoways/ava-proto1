import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { buildOpenRouterPayload } from "./payload.ts";

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
  timeout_ms?: number;
  /** Explicit reasoning toggle from client. undefined => disabled by default for reasoning models. */
  reasoning?: boolean;
  /** Admin diagnostic mode: return request metadata, never credentials/headers. */
  diagnostic_trace?: boolean;
  // Special action for cost lookup
  _action?: string;
  generation_id?: string;
}

function getLookupErrorType(status: number) {
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status >= 500) return "server_error";
  return "http_error";
}

function clampTimeoutMs(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1000, Math.min(25000, Math.round(parsed)));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  const proxyStartedAt = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const denied = await enforceGameRequest(req, "proxy-llm", corsHeaders);
  if (denied) return denied;

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const body: LLMRequest = await req.json();

    if (body.diagnostic_trace === true) {
      const adminAuth = await requireAdmin(req, corsHeaders);
      if (!adminAuth.ok) return adminAuth.response!;
    }

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
          JSON.stringify({
            available: false,
            retryable: genRes.status === 404 || genRes.status === 408 || genRes.status >= 500,
            error: `Generation lookup failed: ${genRes.status}`,
            error_type: getLookupErrorType(genRes.status),
            status_code: genRes.status,
            details: errText,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const genData = await genRes.json();
      console.log(`[proxy-llm] Generation data:`, JSON.stringify(genData));
      const data = genData.data || genData;
      return new Response(
        JSON.stringify({
          available: true,
          cost_usd: data.total_cost ?? data.usage ?? 0,
          prompt_tokens: data.tokens_prompt ?? data.native_tokens_prompt ?? 0,
          completion_tokens: data.tokens_completion ?? data.native_tokens_completion ?? 0,
          total_tokens: (data.tokens_prompt ?? 0) + (data.tokens_completion ?? 0),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STANDARD CHAT COMPLETION =====
    const { model, max_tokens, stream, upstreamBody } = buildOpenRouterPayload(body);
    const timeoutMs = clampTimeoutMs(body.timeout_ms, stream ? 18000 : 15000);

    // Guardrails against turning this endpoint into an open LLM proxy.
    // Allowed model provider prefixes actually used by the AVA game.
    const ALLOWED_MODEL_PREFIXES = [
      'google/', 'qwen/', 'anthropic/', 'openai/', 'meta-llama/',
      'x-ai/', 'mistralai/', 'deepseek/',
    ];
    if (typeof model !== 'string' || !ALLOWED_MODEL_PREFIXES.some((p) => model.startsWith(p))) {
      return new Response(
        JSON.stringify({ error: `Model not allowed: ${model}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (body.messages.length > 60) {
      return new Response(
        JSON.stringify({ error: 'messages array too large' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const totalChars = body.messages.reduce((s, m) => s + (typeof m?.content === 'string' ? m.content.length : 0), 0);
    if (totalChars > 60000) {
      return new Response(
        JSON.stringify({ error: 'messages payload too large' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (typeof max_tokens !== 'number' || max_tokens > 4000 || max_tokens < 1) {
      return new Response(
        JSON.stringify({ error: 'max_tokens out of range (1-4000)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const upstreamStartedAt = Date.now();
    const response = await fetchWithTimeout(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ava-prototype.lovable.app',
        'X-Title': 'AVA Prototype 1',
      },
      body: JSON.stringify(upstreamBody),
    }, timeoutMs).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return new Response(

          JSON.stringify({ error: `OpenRouter timeout after ${timeoutMs}ms` }),
          { status: 504, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw error;
    });
    const upstreamLatencyMs = Date.now() - upstreamStartedAt;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error [${response.status}]:`, errorText);
      const diagnostic = body.diagnostic_trace === true ? {
        clientPayload: {
          messages: body.messages,
          stream,
          model: body.model,
          temperature: body.temperature,
          max_tokens: body.max_tokens,
          top_p: body.top_p,
          timeout_ms: body.timeout_ms,
          reasoning: body.reasoning === true,
        },
        upstreamPayload: upstreamBody,
        requestedModel: model,
        returnedModel: model,
        provider: null,
        generationId: null,
        usage: null,
        upstreamLatencyMs,
        proxyLatencyMs: Date.now() - proxyStartedAt,
      } : undefined;
      return new Response(
        JSON.stringify({ error: `OpenRouter error: ${response.status}`, details: errorText, _ava_trace: diagnostic }),
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
    if (body.diagnostic_trace === true) {
      data._ava_trace = {
        clientPayload: {
          messages: body.messages,
          stream,
          model: body.model,
          temperature: body.temperature,
          max_tokens: body.max_tokens,
          top_p: body.top_p,
          timeout_ms: body.timeout_ms,
          reasoning: body.reasoning === true,
        },
        upstreamPayload: upstreamBody,
        requestedModel: model,
        returnedModel: typeof data.model === "string" && data.model ? data.model : model,
        provider: typeof data.provider === "string" ? data.provider : null,
        generationId: typeof data.id === "string" ? data.id : null,
        usage: data.usage || null,
        upstreamLatencyMs,
        proxyLatencyMs: Date.now() - proxyStartedAt,
      };
    }
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
