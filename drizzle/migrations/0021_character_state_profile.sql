-- Réglages GM lisibles, lot D : état du personnage (radar à 5 dimensions).
-- À coller dans le chat Lovable après fusion (jamais de Supabase direct).
-- Additif : une colonne nullable et une fonction de lecture ; aucune ligne modifiée.

ALTER TABLE public.character_runtime_profiles
  ADD COLUMN IF NOT EXISTS state_profile jsonb;

COMMENT ON COLUMN public.character_runtime_profiles.state_profile IS
  'Radar d''état du personnage : { initial, min, max, gmCanEvolve, maxStepPerTurn, labels } par axe combativite, initiative, lucidite, ouverture, agitation (0–5). NULL = pas d''état (comportement antérieur).';

-- Lecture runtime du profil d'état, figé sur la session au premier appel
-- (même autorisation et même résolution d'environnement que get_character_speech_runtime).
CREATE OR REPLACE FUNCTION public.get_character_state_profile(
  p_character_key text,
  p_environment_id text,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_env text;
  v_session public.sessions%ROWTYPE;
  v_admin boolean;
  v_profile jsonb;
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_character_key NOT IN ('max','emma','ava','leo') THEN RAISE EXCEPTION 'Unknown character'; END IF;
  v_admin := private.is_admin_member(auth.uid());
  v_env := CASE
    WHEN v_admin AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = p_environment_id) THEN p_environment_id
    ELSE COALESCE((SELECT a.environment_id FROM private.current_external_test_access() a), 'prod')
  END;

  IF p_session_id IS NOT NULL THEN
    SELECT s.* INTO v_session FROM public.sessions s WHERE s.id = p_session_id FOR UPDATE;
    IF NOT FOUND OR (v_session.user_id IS DISTINCT FROM auth.uid() AND NOT v_admin) THEN
      RAISE EXCEPTION 'Session access denied' USING ERRCODE = '42501';
    END IF;
    IF v_session.environment_id IS DISTINCT FROM v_env THEN
      RAISE EXCEPTION 'Environment access denied' USING ERRCODE = '42501';
    END IF;
    v_snapshot := v_session.character_speech_runtime -> p_character_key;
    IF v_snapshot IS NOT NULL AND v_snapshot ? 'state_profile' THEN
      RETURN NULLIF(v_snapshot -> 'state_profile', 'null'::jsonb);
    END IF;
  END IF;

  SELECT c.state_profile INTO v_profile
  FROM public.character_runtime_profiles c
  WHERE c.character_key = p_character_key AND c.environment_id IN (v_env, 'prod')
  ORDER BY (c.environment_id = v_env) DESC
  LIMIT 1;

  -- Freeze on the session only once its speech snapshot exists (written by
  -- get_character_speech_runtime, which the turn calls in parallel).
  IF p_session_id IS NOT NULL AND v_snapshot IS NOT NULL THEN
    UPDATE public.sessions s
    SET character_speech_runtime = jsonb_set(
      s.character_speech_runtime, ARRAY[p_character_key],
      v_snapshot || jsonb_build_object('state_profile', COALESCE(v_profile, 'null'::jsonb)))
    WHERE s.id = p_session_id;
  END IF;

  RETURN v_profile;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_character_state_profile(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_character_state_profile(text, text, uuid) TO authenticated, service_role;
