-- Drop ivfflat indexes: too small dataset (~226 rows) for ivfflat with lists=100.
-- Sequential scan on cosine distance is fast & accurate at this scale.
DROP INDEX IF EXISTS public.embeddings_embedding_idx;
DROP INDEX IF EXISTS public.idx_embeddings_v_cosine;

-- Use HNSW indexes instead (works well at any scale, no probes tuning needed).
-- m=16, ef_construction=64 are good defaults for small/medium datasets.
CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx
  ON public.embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS embeddings_embedding_v_hnsw_idx
  ON public.embeddings USING hnsw (embedding_v vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);