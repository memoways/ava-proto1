
-- Chantier 1: filtrage strict par personnage
ALTER TABLE public.embeddings ADD COLUMN IF NOT EXISTS character_id uuid NULL REFERENCES public.characters(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_embeddings_character_id ON public.embeddings(character_id);

-- Chantier 2: nouvelle colonne pour embeddings Voyage 1024 dim
ALTER TABLE public.embeddings ADD COLUMN IF NOT EXISTS embedding_v vector(1024) NULL;
ALTER TABLE public.embeddings ADD COLUMN IF NOT EXISTS embedding_provider text NOT NULL DEFAULT 'openai';
CREATE INDEX IF NOT EXISTS idx_embeddings_v_cosine ON public.embeddings USING ivfflat (embedding_v vector_cosine_ops) WITH (lists = 100);

-- RPC scoped pour OpenAI (1536) avec filtre character
CREATE OR REPLACE FUNCTION public.match_embeddings_scoped(
  query_embedding vector,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.3,
  p_character_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, source_table text, source_id uuid, content text, similarity float, character_id uuid)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT e.id, e.source_table, e.source_id, e.content,
         1 - (e.embedding <=> query_embedding) AS similarity,
         e.character_id
  FROM public.embeddings e
  WHERE e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (p_character_id IS NULL OR e.character_id IS NULL OR e.character_id = p_character_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RPC scoped pour Voyage (1024)
CREATE OR REPLACE FUNCTION public.match_embeddings_voyage(
  query_embedding vector(1024),
  match_count int DEFAULT 15,
  match_threshold float DEFAULT 0.3,
  p_character_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, source_table text, source_id uuid, content text, similarity float, character_id uuid)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT e.id, e.source_table, e.source_id, e.content,
         1 - (e.embedding_v <=> query_embedding) AS similarity,
         e.character_id
  FROM public.embeddings e
  WHERE e.embedding_v IS NOT NULL
    AND (1 - (e.embedding_v <=> query_embedding)) > match_threshold
    AND (p_character_id IS NULL OR e.character_id IS NULL OR e.character_id = p_character_id)
  ORDER BY e.embedding_v <=> query_embedding
  LIMIT match_count;
$$;

-- Chantier 5: mémoire intra-session compressée
CREATE TABLE IF NOT EXISTS public.session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  last_turn int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session summaries" ON public.session_summaries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert session summaries" ON public.session_summaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update session summaries" ON public.session_summaries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete session summaries" ON public.session_summaries FOR DELETE USING (true);

CREATE TRIGGER session_summaries_updated_at
BEFORE UPDATE ON public.session_summaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
