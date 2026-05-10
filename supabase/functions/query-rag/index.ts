import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OPENAI_API_URL = "https://api.openai.com/v1";
const VOYAGE_API_URL = "https://api.voyageai.com/v1";

interface RAGRequest {
  query?: string;
  user_message?: string;
  recent_context?: string;
  match_count?: number;
  match_threshold?: number;
  character_id?: string | null;
  provider?: "voyage" | "openai";
  rerank?: boolean;
  retrieve_k?: number;
}

async function embedOpenAI(text: string, apiKey: string): Promise<number[]> {
  const r = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI embeddings ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data[0].embedding;
}

async function embedVoyage(text: string, apiKey: string, inputType: "query" | "document" = "query"): Promise<number[]> {
  const r = await fetch(`${VOYAGE_API_URL}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3', input: [text], input_type: inputType, output_dimension: 1024 }),
  });
  if (!r.ok) throw new Error(`Voyage embeddings ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data[0].embedding;
}

async function rerankVoyage(query: string, documents: string[], apiKey: string, topK: number): Promise<Array<{ index: number; relevance_score: number }>> {
  const r = await fetch(`${VOYAGE_API_URL}/rerank`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'rerank-2.5', query, documents, top_k: topK, truncation: true }),
  });
  if (!r.ok) throw new Error(`Voyage rerank ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: RAGRequest = await req.json();
    const userQuery = (body.query || body.user_message || "").trim();
    if (!userQuery) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Combine recent context for better semantic match (only when no rewritten query was supplied)
    const searchInput = body.recent_context && !body.query
      ? `${userQuery}\n\nContexte récent: ${body.recent_context}`
      : userQuery;

    const provider: "voyage" | "openai" = body.provider || (VOYAGE_API_KEY ? "voyage" : "openai");
    const matchCount = body.match_count ?? 5;
    const retrieveK = Math.max(matchCount, body.retrieve_k ?? 15);
    const matchThreshold = body.match_threshold ?? 0.3;
    const characterId = body.character_id || null;
    const useRerank = body.rerank !== false && provider === "voyage" && !!VOYAGE_API_KEY;

    // 1. Embed query with chosen provider
    let matches: any[] = [];
    let providerUsed = provider;
    if (provider === "voyage") {
      if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY not configured");
      const emb = await embedVoyage(searchInput, VOYAGE_API_KEY, "query");
      const { data, error } = await supabase.rpc('match_embeddings_voyage', {
        query_embedding: JSON.stringify(emb),
        match_count: useRerank ? retrieveK : matchCount,
        match_threshold: matchThreshold,
        p_character_id: characterId,
      });
      if (error) throw new Error(`pgvector(voyage) error: ${error.message}`);
      matches = data || [];
      // If voyage returns nothing (e.g. embeddings not yet rebuilt), fall back to OpenAI scope
      if (matches.length === 0 && OPENAI_API_KEY) {
        console.warn('[query-rag] Voyage returned 0 matches, falling back to OpenAI scope');
        const embO = await embedOpenAI(searchInput, OPENAI_API_KEY);
        const { data: dataO } = await supabase.rpc('match_embeddings_scoped', {
          query_embedding: JSON.stringify(embO),
          match_count: matchCount,
          match_threshold: matchThreshold,
          p_character_id: characterId,
        });
        matches = dataO || [];
        providerUsed = "openai";
      }
    } else {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
      const emb = await embedOpenAI(searchInput, OPENAI_API_KEY);
      const { data, error } = await supabase.rpc('match_embeddings_scoped', {
        query_embedding: JSON.stringify(emb),
        match_count: matchCount,
        match_threshold: matchThreshold,
        p_character_id: characterId,
      });
      if (error) throw new Error(`pgvector(openai) error: ${error.message}`);
      matches = data || [];
    }

    // 2. Optional rerank with Voyage rerank-2.5
    let rerankUsed = false;
    if (useRerank && providerUsed === "voyage" && matches.length > 0) {
      try {
        const docs = matches.map((m) => m.content);
        const reranked = await rerankVoyage(userQuery, docs, VOYAGE_API_KEY!, matchCount);
        // Map indices back to matches and attach rerank_score
        const reorderedMap = new Map(reranked.map((r) => [r.index, r.relevance_score]));
        matches = reranked.map((r) => ({
          ...matches[r.index],
          retrieval_similarity: matches[r.index].similarity,
          rerank_score: r.relevance_score,
          similarity: r.relevance_score, // overwrite for downstream consumers that read .similarity
        }));
        rerankUsed = true;
        console.log(`[query-rag] Reranked ${docs.length}→${matches.length} (top score=${matches[0]?.rerank_score?.toFixed(3)})`);
      } catch (rerr) {
        console.error('[query-rag] Rerank failed, returning vector-only matches:', rerr);
      }
    } else {
      matches = matches.slice(0, matchCount);
    }

    console.log(`[query-rag] Provider=${providerUsed} rerank=${rerankUsed} matches=${matches.length} char=${characterId ? characterId.slice(0, 8) : "all"}`);

    return new Response(JSON.stringify({
      matches,
      query: userQuery,
      embedding_provider: providerUsed,
      rerank_used: rerankUsed,
      character_id: characterId,
      latency_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[query-rag] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
