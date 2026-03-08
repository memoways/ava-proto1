-- Reinstall vector in public (already partially dropped)
CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;

-- Re-add embedding column
ALTER TABLE public.embeddings ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Recreate index
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Recreate function with search_path set
CREATE OR REPLACE FUNCTION public.match_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
RETURNS TABLE (
  id uuid,
  source_table text,
  source_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  select
    id,
    source_table,
    source_id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;