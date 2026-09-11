ALTER TABLE public.character_prompts
  ADD COLUMN IF NOT EXISTS politique_relationnelle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS references_intellectuelles text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.character_prompts.politique_relationnelle IS
  'Source Notion structurée : moteur, signes d''ouverture/fermeture, conditions des sujets, résistance et initiative.';
COMMENT ON COLUMN public.character_prompts.references_intellectuelles IS
  'Références culturelles et intellectuelles, séparées de la progression relationnelle.';

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
  tts_voice_id text,
  situation_summary text
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
    profile.tts_voice_id,
    prompt.situation_summary
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
