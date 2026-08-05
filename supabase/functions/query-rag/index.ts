import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import {
  getRagEmbeddingProfile,
  LEGACY_OPENAI_PROFILE_ID,
  LEGACY_VOYAGE_PROFILE_ID,
  type RagEmbeddingProfile,
} from "../_shared/ragProfiles.ts";

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
  rerank?: boolean;
  retrieve_k?: number;
  rerank_model?: "rerank-2.5" | "rerank-2.5-lite";
  rerank_truncation?: boolean;
  include_retrieval_matches?: boolean;
}

interface RagDatabaseMatch {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  similarity: number;
  character_id: string | null;
}

async function embedOpenAI(text: string, apiKey: string, profile: RagEmbeddingProfile): Promise<number[]> {
  const r = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: profile.queryModel, input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI embeddings ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data[0].embedding;
}

async function embedVoyageQuery(text: string, apiKey: string, profile: RagEmbeddingProfile): Promise<number[]> {
  const r = await fetch(`${VOYAGE_API_URL}/${profile.endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(profile.endpoint === "contextualizedembeddings"
      ? {
          model: profile.queryModel,
          inputs: [text],
          input_type: "query",
          output_dimension: profile.dimension,
          output_dtype: profile.dtype,
        }
      : {
          model: profile.queryModel,
          input: [text],
          input_type: "query",
          output_dimension: profile.dimension,
          output_dtype: profile.dtype,
        }),
  });
  if (!r.ok) throw new Error(`Voyage embeddings ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const embedding = profile.endpoint === "contextualizedembeddings"
    ? d.data?.[0]?.data?.[0]?.embedding
    : d.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error(`Voyage ${profile.queryModel} returned no query embedding`);
  return embedding;
}

const AVA_RERANK_INSTRUCTION = "Priorise les passages qui contiennent des faits narratifs explicites sur le personnage actif et qui répondent directement à la question. Écarte les ressemblances de vocabulaire sans réponse factuelle.";

function buildRerankQuery(searchInput: string): string {
  return `${AVA_RERANK_INSTRUCTION}\n\nQuestion et contexte de conversation :\n${searchInput}`;
}

async function rerankVoyage(
  query: string,
  documents: string[],
  apiKey: string,
  topK: number,
  model: "rerank-2.5" | "rerank-2.5-lite",
  truncation: boolean,
): Promise<Array<{ index: number; relevance_score: number }>> {
  const r = await fetch(`${VOYAGE_API_URL}/rerank`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, query, documents, top_k: topK, truncation }),
  });
  if (!r.ok) throw new Error(`Voyage rerank ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const denied = await enforceGameRequest(req, "query-rag", corsHeaders);
  if (denied) return denied;

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

    const fallbackProfileId = !VOYAGE_API_KEY && !!OPENAI_API_KEY
      ? LEGACY_OPENAI_PROFILE_ID
      : LEGACY_VOYAGE_PROFILE_ID;
    const { data: indexState, error: indexStateError } = await supabase
      .from("rag_index_state")
      .select("active_profile")
      .eq("id", true)
      .maybeSingle();
    if (indexStateError) {
      console.warn("[query-rag] rag_index_state unavailable, using legacy profile:", indexStateError.message);
    }
    const versionedIndexAvailable = !indexStateError && Boolean(indexState?.active_profile);
    const profile = getRagEmbeddingProfile(indexState?.active_profile, fallbackProfileId);
    const provider: "voyage" | "openai" = profile.provider;
    const matchCount = body.match_count ?? 5;
    const retrieveK = Math.max(matchCount, body.retrieve_k ?? 15);
    const matchThreshold = body.match_threshold ?? 0.3;
    const characterId = body.character_id || null;
    const useRerank = body.rerank !== false && !!VOYAGE_API_KEY;
    const rerankModel = body.rerank_model === "rerank-2.5" ? "rerank-2.5" : "rerank-2.5-lite";
    const rerankTruncation = body.rerank_truncation !== false;
    const rerankQuery = buildRerankQuery(searchInput);

    // 1. Embed query with chosen provider
    let matches: RagDatabaseMatch[] = [];
    const providerUsed = provider;
    if (provider === "voyage") {
      if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY not configured");
      const emb = await embedVoyageQuery(searchInput, VOYAGE_API_KEY, profile);
      const { data, error } = await supabase.rpc('match_embeddings_voyage', {
        query_embedding: JSON.stringify(emb),
        match_count: useRerank ? retrieveK : matchCount,
        match_threshold: matchThreshold,
        p_character_id: characterId,
        ...(versionedIndexAvailable ? { p_embedding_profile: profile.id } : {}),
      });
      if (error) throw new Error(`pgvector(voyage) error: ${error.message}`);
      matches = data || [];
    } else {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
      const emb = await embedOpenAI(searchInput, OPENAI_API_KEY, profile);
      const { data, error } = await supabase.rpc('match_embeddings_scoped', {
        query_embedding: JSON.stringify(emb),
        match_count: useRerank ? retrieveK : matchCount,
        match_threshold: matchThreshold,
        p_character_id: characterId,
        ...(versionedIndexAvailable ? { p_embedding_profile: profile.id } : {}),
      });
      if (error) throw new Error(`pgvector(openai) error: ${error.message}`);
      matches = data || [];
    }

    // 2. Optional rerank with Voyage rerank-2.5
    const retrievalMatches = matches.map((match, index) => ({
      ...match,
      retrieval_similarity: match.similarity,
      retrieval_rank: index + 1,
    }));
    let rerankUsed = false;
    let rerankError: string | null = null;
    if (useRerank && matches.length > 0) {
      try {
        const docs = matches.map((m) => m.content);
        const reranked = await rerankVoyage(rerankQuery, docs, VOYAGE_API_KEY!, matchCount, rerankModel, rerankTruncation);
        // Map indices back to matches and attach rerank_score
        matches = reranked.map((r) => ({
          ...matches[r.index],
          retrieval_similarity: matches[r.index].similarity,
          retrieval_rank: r.index + 1,
          rerank_score: r.relevance_score,
          similarity: r.relevance_score, // overwrite for downstream consumers that read .similarity
        }));
        rerankUsed = true;
        console.log(`[query-rag] Reranked ${docs.length}→${matches.length} (top score=${matches[0]?.rerank_score?.toFixed(3)})`);
      } catch (rerr) {
        console.error('[query-rag] Rerank failed, returning vector-only matches:', rerr);
        rerankError = rerr instanceof Error ? rerr.message : String(rerr);
        matches = retrievalMatches.slice(0, matchCount);
      }
    } else {
      matches = matches.slice(0, matchCount);
    }

    console.log(`[query-rag] Provider=${providerUsed} rerank=${rerankUsed} matches=${matches.length} char=${characterId ? characterId.slice(0, 8) : "all"}`);

    return new Response(JSON.stringify({
      matches,
      ...(body.include_retrieval_matches ? { retrieval_matches: retrievalMatches } : {}),
      query: userQuery,
      search_input: searchInput,
      embedding_provider: providerUsed,
      embedding_profile: profile.id,
      document_embedding_model: profile.documentModel,
      query_embedding_model: profile.queryModel,
      embedding_dimension: profile.dimension,
      embedding_dtype: profile.dtype,
      rerank_used: rerankUsed,
      rerank_model: useRerank ? rerankModel : null,
      rerank_query: useRerank ? rerankQuery : null,
      rerank_error: rerankError,
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
