-- Expose the current environment's runtime portrait to the experience only.
-- Applied by Lovable Cloud together with the front-end release.

DROP FUNCTION IF EXISTS public.get_character_runtime_readiness(text);

CREATE OR REPLACE FUNCTION public.get_character_runtime_readiness(p_character_key text)
RETURNS TABLE (
  character_key text,
  display_name text,
  ready boolean,
  opening_line text,
  portrait_url text,
  tts_provider text,
  tts_voice_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.character_key,
    p.display_name,
    (
      p.enabled
      AND p.notion_character_id IS NOT NULL
      AND length(coalesce(p.opening_line, '')) > 0
      AND length(coalesce(p.portrait_url, '')) > 0
      AND length(coalesce(p.tts_provider, '')) > 0
      AND length(coalesce(p.tts_voice_id, '')) > 0
      AND p.prompt_validated
      AND p.rag_validated
      AND p.qualitative_tests_validated
      AND p.knowledge_isolation_validated
    ) AS ready,
    p.opening_line,
    p.portrait_url,
    p.tts_provider,
    p.tts_voice_id
  FROM public.character_runtime_profiles p
  WHERE p.character_key = lower(p_character_key)
    AND p.environment_id = 'prod'
    AND auth.uid() IS NOT NULL;
$$;

DROP FUNCTION IF EXISTS public.get_character_runtime_readiness_for_environment(text, text);

CREATE OR REPLACE FUNCTION public.get_character_runtime_readiness_for_environment(
  p_character_key text,
  p_environment_id text
)
RETURNS TABLE (
  character_key text,
  display_name text,
  ready boolean,
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
      ELSE 'prod'
    END AS environment_id
  )
  SELECT
    p.character_key,
    p.display_name,
    (
      p.enabled
      AND p.notion_character_id IS NOT NULL
      AND length(coalesce(p.opening_line, '')) > 0
      AND length(coalesce(p.portrait_url, '')) > 0
      AND length(coalesce(p.tts_provider, '')) > 0
      AND length(coalesce(p.tts_voice_id, '')) > 0
      AND p.prompt_validated
      AND p.rag_validated
      AND p.qualitative_tests_validated
      AND p.knowledge_isolation_validated
    ) AS ready,
    p.opening_line,
    p.portrait_url,
    p.tts_provider,
    p.tts_voice_id
  FROM public.character_runtime_profiles p
  CROSS JOIN requested r
  WHERE p.character_key = lower(p_character_key)
    AND p.environment_id IN (r.environment_id, 'prod')
    AND auth.uid() IS NOT NULL
  ORDER BY (p.environment_id = r.environment_id) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_character_runtime_readiness(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) TO authenticated;
