-- Lock every live turn, RAG lookup and session summary to one character.
-- Apply only through Lovable / Lovable Cloud.

ALTER TABLE public.session_summaries
  ADD COLUMN IF NOT EXISTS character_key text;

ALTER TABLE public.session_summaries
  DROP CONSTRAINT IF EXISTS session_summaries_session_id_key;

ALTER TABLE public.session_summaries
  DROP CONSTRAINT IF EXISTS session_summaries_character_key_check;

ALTER TABLE public.session_summaries
  ADD CONSTRAINT session_summaries_character_key_check
  CHECK (character_key IS NULL OR character_key IN ('max', 'emma'));

-- Legacy NULL rows remain available to administrators for diagnosis, while all
-- new runtime rows have a distinct key per character.
CREATE UNIQUE INDEX IF NOT EXISTS session_summaries_session_character_key
  ON public.session_summaries (session_id, character_key);

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
  WHERE p_character_id IS NOT NULL
    AND p_embedding_profile IS NOT NULL
    AND e.embedding_v IS NOT NULL
    AND e.embedding_profile = p_embedding_profile
    AND e.source_table = 'characters'
    AND e.source_id = p_character_id
    AND e.character_id = p_character_id
    AND (1 - (e.embedding_v <=> query_embedding)) > match_threshold
  ORDER BY e.embedding_v <=> query_embedding
  LIMIT match_count;
$$;

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
  WHERE p_character_id IS NOT NULL
    AND p_embedding_profile IS NOT NULL
    AND e.embedding IS NOT NULL
    AND e.embedding_profile = p_embedding_profile
    AND e.source_table = 'characters'
    AND e.source_id = p_character_id
    AND e.character_id = p_character_id
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_embeddings_voyage(vector, integer, double precision, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_embeddings_voyage(vector, integer, double precision, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.match_embeddings_scoped(vector, integer, double precision, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_embeddings_scoped(vector, integer, double precision, uuid, text) TO service_role;

-- The whole new corpus is inserted and the old corpus removed in one database
-- transaction. Any malformed chunk or vector rolls the RPC back completely.
CREATE OR REPLACE FUNCTION public.replace_character_embeddings(
  p_character_id uuid,
  p_embedding_profile text,
  p_records jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_record jsonb;
  v_new_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_character_id IS NULL OR length(coalesce(p_embedding_profile, '')) = 0 THEN
    RAISE EXCEPTION 'character and embedding profile are required';
  END IF;
  IF jsonb_typeof(p_records) <> 'array' OR jsonb_array_length(p_records) = 0 THEN
    RAISE EXCEPTION 'a complete non-empty character corpus is required';
  END IF;

  FOR v_record IN SELECT value FROM jsonb_array_elements(p_records)
  LOOP
    IF length(trim(coalesce(v_record ->> 'content', ''))) = 0 THEN
      RAISE EXCEPTION 'empty embedding content';
    END IF;
    INSERT INTO public.embeddings (
      source_table, source_id, content, character_id,
      embedding_provider, embedding_profile, embedding_model,
      embedding_dimension, embedding_dtype, chunking_strategy,
      chunk_index, chunk_count, indexed_at, embedding, embedding_v
    ) VALUES (
      'characters', p_character_id, v_record ->> 'content', p_character_id,
      v_record ->> 'embedding_provider', p_embedding_profile, v_record ->> 'embedding_model',
      (v_record ->> 'embedding_dimension')::integer, v_record ->> 'embedding_dtype',
      v_record ->> 'chunking_strategy', (v_record ->> 'chunk_index')::integer,
      (v_record ->> 'chunk_count')::integer,
      coalesce((v_record ->> 'indexed_at')::timestamptz, now()),
      CASE WHEN v_record ? 'embedding' THEN (v_record ->> 'embedding')::vector ELSE NULL END,
      CASE WHEN v_record ? 'embedding_v' THEN (v_record ->> 'embedding_v')::vector(1024) ELSE NULL END
    ) RETURNING id INTO v_new_id;
    v_new_ids := array_append(v_new_ids, v_new_id);
  END LOOP;

  DELETE FROM public.embeddings
  WHERE source_table = 'characters'
    AND source_id = p_character_id
    AND character_id = p_character_id
    AND embedding_profile = p_embedding_profile
    AND NOT (id = ANY(v_new_ids));

  RETURN cardinality(v_new_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_character_embeddings(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_character_embeddings(uuid, text, jsonb) TO service_role;

DROP FUNCTION IF EXISTS public.get_character_runtime_readiness_for_environment(text, text);
CREATE OR REPLACE FUNCTION public.get_character_runtime_readiness_for_environment(
  p_character_key text,
  p_environment_id text
)
RETURNS TABLE (
  character_key text,
  display_name text,
  enabled boolean,
  ready boolean,
  character_id uuid,
  notion_page_id text,
  environment_id text,
  prompt_updated_at timestamptz,
  opening_line text,
  portrait_url text,
  tts_provider text,
  tts_voice_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  WITH requested AS (
    SELECT CASE
      WHEN private.is_admin_member(auth.uid())
       AND EXISTS (SELECT 1 FROM public.environments WHERE id = p_environment_id)
        THEN p_environment_id
      ELSE COALESCE((SELECT environment_id FROM private.current_external_test_access()), 'prod')
    END AS environment_id
  ), selected_profile AS (
    SELECT profile.*
    FROM public.character_runtime_profiles profile
    CROSS JOIN requested
    WHERE profile.character_key = lower(p_character_key)
      AND profile.environment_id IN (requested.environment_id, 'prod')
      AND auth.uid() IS NOT NULL
    ORDER BY (profile.environment_id = requested.environment_id) DESC
    LIMIT 1
  )
  SELECT
    profile.character_key,
    profile.display_name,
    profile.enabled,
    (
      profile.enabled
      AND profile.notion_character_id IS NOT NULL
      AND character.notion_id IS NOT NULL
      AND prompt.character_id IS NOT NULL
      AND length(coalesce(prompt.identite_fondamentale, '')) > 0
      AND length(coalesce(prompt.qui_tu_es, '')) > 0
      AND length(coalesce(prompt.ce_que_tu_ne_fais_jamais, '')) > 0
      AND length(coalesce(profile.opening_line, '')) > 0
      AND length(coalesce(profile.portrait_url, '')) > 0
      AND length(coalesce(profile.tts_provider, '')) > 0
      AND length(coalesce(profile.tts_voice_id, '')) > 0
      AND profile.prompt_validated
      AND profile.rag_validated
      AND profile.qualitative_tests_validated
      AND profile.knowledge_isolation_validated
    ) AS ready,
    profile.notion_character_id,
    character.notion_id,
    profile.environment_id,
    prompt.updated_at,
    profile.opening_line,
    profile.portrait_url,
    profile.tts_provider,
    profile.tts_voice_id
  FROM selected_profile profile
  LEFT JOIN public.characters character ON character.id = profile.notion_character_id
  LEFT JOIN LATERAL (
    SELECT character_prompt.*
    FROM public.character_prompts character_prompt
    CROSS JOIN requested
    WHERE character_prompt.character_id = profile.notion_character_id
      AND character_prompt.environment_id IN (requested.environment_id, 'prod')
    ORDER BY (character_prompt.environment_id = requested.environment_id) DESC
    LIMIT 1
  ) prompt ON true;
$$;

REVOKE ALL ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) TO authenticated;