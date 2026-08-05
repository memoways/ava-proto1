-- Versioned RAG embedding profiles.
-- Apply and publish through Lovable / Lovable Cloud only.

ALTER TABLE public.embeddings
  ADD COLUMN IF NOT EXISTS embedding_profile text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimension integer,
  ADD COLUMN IF NOT EXISTS embedding_dtype text,
  ADD COLUMN IF NOT EXISTS chunking_strategy text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS chunk_count integer,
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

UPDATE public.embeddings
SET
  embedding_profile = CASE
    WHEN embedding_provider = 'voyage' THEN 'voyage-3-legacy'
    ELSE 'openai-legacy'
  END,
  embedding_model = CASE
    WHEN embedding_provider = 'voyage' THEN 'voyage-3'
    ELSE 'text-embedding-3-small'
  END,
  embedding_dimension = CASE
    WHEN embedding_provider = 'voyage' THEN 1024
    ELSE 1536
  END,
  embedding_dtype = 'float',
  chunking_strategy = 'notion-structure-v1',
  indexed_at = COALESCE(created_at, now())
WHERE embedding_profile IS NULL
   OR embedding_model IS NULL
   OR embedding_dimension IS NULL
   OR embedding_dtype IS NULL
   OR chunking_strategy IS NULL
   OR indexed_at IS NULL;

ALTER TABLE public.embeddings
  ALTER COLUMN embedding_profile SET DEFAULT 'voyage-3-legacy',
  ALTER COLUMN embedding_profile SET NOT NULL,
  ALTER COLUMN embedding_dtype SET DEFAULT 'float';

CREATE INDEX IF NOT EXISTS embeddings_profile_character_idx
  ON public.embeddings (embedding_profile, character_id);

CREATE TABLE IF NOT EXISTS public.rag_index_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active_profile text NOT NULL,
  previous_profile text,
  provider text NOT NULL,
  document_model text NOT NULL,
  query_model text NOT NULL,
  endpoint text NOT NULL,
  dimension integer NOT NULL,
  dtype text NOT NULL,
  chunking_strategy text NOT NULL,
  chunk_size_chars integer NOT NULL,
  chunk_overlap_chars integer NOT NULL,
  total_chunks integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'building', 'failed')),
  last_rebuild_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rag_index_state (
  id,
  active_profile,
  provider,
  document_model,
  query_model,
  endpoint,
  dimension,
  dtype,
  chunking_strategy,
  chunk_size_chars,
  chunk_overlap_chars,
  total_chunks,
  last_rebuild_at
)
SELECT
  true,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.embeddings WHERE embedding_profile = 'voyage-3-legacy'
  ) THEN 'voyage-3-legacy' ELSE 'openai-legacy' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.embeddings WHERE embedding_profile = 'voyage-3-legacy'
  ) THEN 'voyage' ELSE 'openai' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.embeddings WHERE embedding_profile = 'voyage-3-legacy'
  ) THEN 'voyage-3' ELSE 'text-embedding-3-small' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.embeddings WHERE embedding_profile = 'voyage-3-legacy'
  ) THEN 'voyage-3' ELSE 'text-embedding-3-small' END,
  'embeddings',
  CASE WHEN EXISTS (
    SELECT 1 FROM public.embeddings WHERE embedding_profile = 'voyage-3-legacy'
  ) THEN 1024 ELSE 1536 END,
  'float',
  'notion-structure-v1',
  1000,
  150,
  (SELECT count(*)::integer FROM public.embeddings),
  (SELECT max(indexed_at) FROM public.embeddings)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rag_index_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rag_index_state FROM PUBLIC, anon;
GRANT SELECT ON public.rag_index_state TO authenticated;
GRANT ALL ON public.rag_index_state TO service_role;

DROP POLICY IF EXISTS "Admin read RAG index state" ON public.rag_index_state;
CREATE POLICY "Admin read RAG index state"
  ON public.rag_index_state FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.match_embeddings_voyage(vector, integer, double precision, uuid);
DROP FUNCTION IF EXISTS public.match_embeddings_voyage(vector, integer, real, uuid);
DROP FUNCTION IF EXISTS public.match_embeddings_voyage(vector, integer, double precision, uuid, text);

CREATE OR REPLACE FUNCTION public.match_embeddings_voyage(
  query_embedding vector(1024),
  match_count integer DEFAULT 15,
  match_threshold double precision DEFAULT 0.3,
  p_character_id uuid DEFAULT NULL,
  p_embedding_profile text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_table text,
  source_id uuid,
  content text,
  similarity double precision,
  character_id uuid
)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT e.id, e.source_table, e.source_id, e.content,
         1 - (e.embedding_v <=> query_embedding) AS similarity,
         e.character_id
  FROM public.embeddings e
  WHERE e.embedding_v IS NOT NULL
    AND (p_embedding_profile IS NULL OR e.embedding_profile = p_embedding_profile)
    AND (1 - (e.embedding_v <=> query_embedding)) > match_threshold
    AND (p_character_id IS NULL OR e.character_id IS NULL OR e.character_id = p_character_id)
  ORDER BY e.embedding_v <=> query_embedding
  LIMIT match_count;
$$;

DROP FUNCTION IF EXISTS public.match_embeddings_scoped(vector, integer, double precision, uuid);
DROP FUNCTION IF EXISTS public.match_embeddings_scoped(vector, integer, real, uuid);
DROP FUNCTION IF EXISTS public.match_embeddings_scoped(vector, integer, double precision, uuid, text);

CREATE OR REPLACE FUNCTION public.match_embeddings_scoped(
  query_embedding vector,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3,
  p_character_id uuid DEFAULT NULL,
  p_embedding_profile text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_table text,
  source_id uuid,
  content text,
  similarity double precision,
  character_id uuid
)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT e.id, e.source_table, e.source_id, e.content,
         1 - (e.embedding <=> query_embedding) AS similarity,
         e.character_id
  FROM public.embeddings e
  WHERE e.embedding IS NOT NULL
    AND (p_embedding_profile IS NULL OR e.embedding_profile = p_embedding_profile)
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (p_character_id IS NULL OR e.character_id IS NULL OR e.character_id = p_character_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_embeddings_voyage(vector, integer, double precision, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_embeddings_voyage(vector, integer, double precision, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.match_embeddings_scoped(vector, integer, double precision, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_embeddings_scoped(vector, integer, double precision, uuid, text) TO service_role;
