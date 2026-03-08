import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OPENAI_API_URL = "https://api.openai.com/v1";

interface RAGRequest {
  query: string;
  match_count?: number;
  match_threshold?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RAGRequest = await req.json();

    if (!body.query?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Generate embedding for the query
    const embRes = await fetch(`${OPENAI_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: body.query,
      }),
    });

    if (!embRes.ok) {
      const err = await embRes.text();
      throw new Error(`OpenAI Embeddings error [${embRes.status}]: ${err}`);
    }

    const embData = await embRes.json();
    const queryEmbedding = embData.data[0].embedding;

    // 2. Search pgvector using match_embeddings function
    const { data: matches, error } = await supabase.rpc('match_embeddings', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: body.match_count || 5,
      match_threshold: body.match_threshold || 0.5,
    });

    if (error) {
      console.error('[query-rag] match_embeddings error:', error);
      throw new Error(`pgvector search error: ${error.message}`);
    }

    console.log(`[query-rag] Found ${matches?.length || 0} matches for query: "${body.query.slice(0, 50)}..."`);

    return new Response(JSON.stringify({
      matches: matches || [],
      query: body.query,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[query-rag] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
