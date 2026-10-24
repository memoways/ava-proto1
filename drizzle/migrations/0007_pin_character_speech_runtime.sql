ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS character_speech_runtime jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.sessions.character_speech_runtime IS 'Per-character speech setting snapshots pinned on first use; admin edits affect new sessions only.';
CREATE OR REPLACE FUNCTION public.get_character_speech_runtime(p_character_key text, p_environment_id text, p_session_id uuid DEFAULT NULL)
RETURNS TABLE(rugosite smallint, settings_version text, environment_id text, recent_states jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $function$
DECLARE v_env text; v_session public.sessions%ROWTYPE; v_profile public.character_runtime_profiles%ROWTYPE; v_snapshot jsonb; v_states jsonb := '[]'::jsonb; v_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_character_key NOT IN ('max','emma','ava','leo') THEN RAISE EXCEPTION 'Unknown character'; END IF;
  v_admin := private.is_admin_member(auth.uid());
  v_env := CASE WHEN v_admin AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = p_environment_id) THEN p_environment_id ELSE COALESCE((SELECT a.environment_id FROM private.current_external_test_access() a), 'prod') END;
  IF p_session_id IS NOT NULL THEN
    SELECT s.* INTO v_session FROM public.sessions s WHERE s.id = p_session_id FOR UPDATE;
    IF NOT FOUND OR (v_session.user_id IS DISTINCT FROM auth.uid() AND NOT v_admin) THEN RAISE EXCEPTION 'Session access denied' USING ERRCODE = '42501'; END IF;
    IF v_session.environment_id IS DISTINCT FROM v_env THEN RAISE EXCEPTION 'Environment access denied' USING ERRCODE = '42501'; END IF;
    v_snapshot := v_session.character_speech_runtime -> p_character_key;
    SELECT COALESCE(jsonb_agg(x.state ORDER BY x.ord DESC), '[]'::jsonb) INTO v_states FROM (
      SELECT entry ->> 'speech_state_played' AS state, ord
      FROM jsonb_array_elements(v_session.gm_post_turn_log) WITH ORDINALITY AS logs(entry, ord)
      WHERE entry ->> 'character_key' = p_character_key
      ORDER BY ord DESC LIMIT 2
    ) x;
  END IF;
  IF v_snapshot IS NULL THEN
    SELECT c.* INTO v_profile FROM public.character_runtime_profiles c WHERE c.character_key = p_character_key AND c.environment_id IN (v_env,'prod') ORDER BY (c.environment_id = v_env) DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Speech profile unavailable'; END IF;
    v_snapshot := jsonb_build_object('rugosite', v_profile.rugosite, 'settings_version', v_profile.updated_at::text, 'environment_id', v_profile.environment_id);
    IF p_session_id IS NOT NULL THEN
      UPDATE public.sessions s SET character_speech_runtime = jsonb_set(s.character_speech_runtime, ARRAY[p_character_key], v_snapshot) WHERE s.id = p_session_id;
    END IF;
  END IF;
  RETURN QUERY SELECT (v_snapshot ->> 'rugosite')::smallint, v_snapshot ->> 'settings_version', v_snapshot ->> 'environment_id', v_states;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_character_speech_runtime(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_character_speech_runtime(text,text,uuid) TO authenticated, service_role;