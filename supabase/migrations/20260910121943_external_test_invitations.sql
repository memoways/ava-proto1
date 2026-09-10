-- AVA — unique external tester invitations for settings sandboxes.
-- Target: the Supabase project managed by Lovable Cloud only.

CREATE TABLE IF NOT EXISTS public.external_test_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id text NOT NULL REFERENCES public.environments(id),
  created_by_user_id uuid NOT NULL REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
  tester_label text NOT NULL CHECK (
    length(btrim(tester_label)) BETWEEN 1 AND 80
  ),
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (
    (redeemed_at IS NULL AND redeemed_by_user_id IS NULL)
    OR (redeemed_at IS NOT NULL AND redeemed_by_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS external_test_invitations_creator_created_idx
  ON public.external_test_invitations (created_by_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS external_test_invitations_code_hash_key
  ON public.external_test_invitations (code_hash);
CREATE INDEX IF NOT EXISTS external_test_invitations_redeemed_user_idx
  ON public.external_test_invitations (redeemed_by_user_id)
  WHERE redeemed_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.external_test_access_grants (
  anonymous_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL UNIQUE
    REFERENCES public.external_test_invitations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS external_test_access_grants_expiry_idx
  ON public.external_test_access_grants (expires_at);

ALTER TABLE public.external_test_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_test_access_grants ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON public.external_test_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.external_test_access_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.external_test_invitations TO service_role;
GRANT ALL ON public.external_test_access_grants TO service_role;

-- This helper is the sole database authority for an external tester's current
-- sandbox. It is intentionally private and can only resolve auth.uid().
CREATE OR REPLACE FUNCTION private.current_external_test_access()
RETURNS TABLE (
  invitation_id uuid,
  environment_id text,
  created_by_user_id uuid,
  tester_label text,
  creator_display_name text,
  access_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT
    invitation.id,
    invitation.environment_id,
    invitation.created_by_user_id,
    invitation.tester_label,
    creator.display_name,
    access_grant.expires_at
  FROM public.external_test_access_grants access_grant
  JOIN public.external_test_invitations invitation
    ON invitation.id = access_grant.invitation_id
  JOIN public.admin_users creator
    ON creator.user_id = invitation.created_by_user_id
  WHERE access_grant.anonymous_user_id = auth.uid()
    AND access_grant.expires_at > now()
    AND invitation.redeemed_by_user_id = auth.uid()
    AND invitation.redeemed_at IS NOT NULL
    AND invitation.revoked_at IS NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.current_external_test_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_external_test_access() TO authenticated, service_role;

-- Atomic redemption. Only the Edge Function's service-role client may invoke
-- it, after verifying the caller JWT and applying the attempt rate limit.
CREATE OR REPLACE FUNCTION public.redeem_external_test_invitation(
  p_invitation_id uuid,
  p_code_hash text,
  p_anonymous_user_id uuid
)
RETURNS TABLE (
  invitation_id uuid,
  environment_id text,
  tester_label text,
  creator_display_name text,
  access_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_invitation public.external_test_invitations%ROWTYPE;
  v_creator_display_name text;
  v_access_expires_at timestamptz;
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_anonymous_user_id AND COALESCE(is_anonymous, false)
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_invitation
  FROM public.external_test_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.revoked_at IS NOT NULL
     OR (v_invitation.redeemed_at IS NULL AND v_invitation.expires_at <= clock_timestamp())
     OR v_invitation.code_hash <> p_code_hash
     OR (
       v_invitation.redeemed_by_user_id IS NOT NULL
       AND v_invitation.redeemed_by_user_id <> p_anonymous_user_id
     ) THEN
    RETURN;
  END IF;

  -- One browser identity may only expose one sandbox at a time. Refuse a
  -- second active invitation instead of silently replacing its current grant.
  IF EXISTS (
    SELECT 1 FROM public.external_test_access_grants existing_grant
    WHERE existing_grant.anonymous_user_id = p_anonymous_user_id
      AND existing_grant.invitation_id <> v_invitation.id
      AND existing_grant.expires_at > clock_timestamp()
  ) THEN
    RETURN;
  END IF;

  IF v_invitation.redeemed_by_user_id IS NULL THEN
    UPDATE public.external_test_invitations
    SET redeemed_at = clock_timestamp(), redeemed_by_user_id = p_anonymous_user_id
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;
  END IF;

  v_access_expires_at := v_invitation.redeemed_at + interval '4 hours';
  IF v_access_expires_at <= clock_timestamp() THEN
    RETURN;
  END IF;

  INSERT INTO public.external_test_access_grants (
    anonymous_user_id, invitation_id, created_at, expires_at
  ) VALUES (
    p_anonymous_user_id, v_invitation.id, v_invitation.redeemed_at, v_access_expires_at
  )
  ON CONFLICT (anonymous_user_id) DO UPDATE SET
    invitation_id = EXCLUDED.invitation_id,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at;

  SELECT display_name INTO v_creator_display_name
  FROM public.admin_users WHERE user_id = v_invitation.created_by_user_id;

  RETURN QUERY SELECT
    v_invitation.id,
    v_invitation.environment_id,
    v_invitation.tester_label,
    v_creator_display_name,
    v_access_expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_external_test_invitation(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_external_test_invitation(uuid, text, uuid)
  TO service_role;

-- Invitation-derived attribution is immutable and auditable on each session.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS test_invitation_id uuid
    REFERENCES public.external_test_invitations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sessions_test_invitation_started_idx
  ON public.sessions (test_invitation_id, started_at DESC)
  WHERE test_invitation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.trace_ava_session_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_is_member boolean := private.is_admin_member(auth.uid());
  v_test_access record;
BEGIN
  IF v_is_member THEN
    NEW.started_by_user_id := auth.uid();
    NEW.environment_id := CASE
      WHEN EXISTS (SELECT 1 FROM public.environments WHERE id = NEW.environment_id)
        THEN NEW.environment_id
      ELSE 'prod'
    END;
    NEW.context_type := CASE WHEN NEW.environment_id = 'prod' THEN 'internal' ELSE 'sandbox' END;
    NEW.campaign_id := NULL;
    NEW.test_invitation_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.test_invitation_id IS NOT NULL THEN
    SELECT * INTO v_test_access FROM private.current_external_test_access();
    IF NOT FOUND OR v_test_access.invitation_id <> NEW.test_invitation_id THEN
      RAISE EXCEPTION 'active external test invitation required' USING ERRCODE = '42501';
    END IF;
    NEW.environment_id := v_test_access.environment_id;
    NEW.context_type := 'user_test';
    NEW.campaign_id := NULL;
    NEW.tester_label := v_test_access.tester_label;
    NEW.started_by_user_id := v_test_access.created_by_user_id;
    RETURN NEW;
  END IF;

  NEW.environment_id := 'prod';
  NEW.started_by_user_id := NULL;
  NEW.context_type := CASE WHEN NEW.campaign_id IS NULL THEN 'public' ELSE 'user_test' END;
  NEW.test_invitation_id := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_ava_session_context_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role')
     OR private.is_admin_member(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.environment_id IS DISTINCT FROM OLD.environment_id
     OR NEW.context_type IS DISTINCT FROM OLD.context_type
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.tester_label IS DISTINCT FROM OLD.tester_label
     OR NEW.started_by_user_id IS DISTINCT FROM OLD.started_by_user_id
     OR NEW.test_invitation_id IS DISTINCT FROM OLD.test_invitation_id THEN
    RAISE EXCEPTION 'session attribution fields cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_ava_session_context_update ON public.sessions;
CREATE TRIGGER protect_ava_session_context_update
  BEFORE UPDATE OF environment_id, context_type, campaign_id, tester_label,
    started_by_user_id, test_invitation_id
  ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.protect_ava_session_context_update();

-- Existing production policies remain in place. These additive policies expose
-- only the active invitation's sandbox rows to its anonymous identity.
DROP POLICY IF EXISTS "External testers read invitation runtime settings" ON public.admin_settings;
CREATE POLICY "External testers read invitation runtime settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING (
    key LIKE 'ava\_%'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
    AND EXISTS (
      SELECT 1 FROM private.current_external_test_access() test_access
      WHERE test_access.environment_id = admin_settings.environment_id
    )
  );

DROP POLICY IF EXISTS "External testers read invitation character prompts" ON public.character_prompts;
CREATE POLICY "External testers read invitation character prompts"
  ON public.character_prompts FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
    AND EXISTS (
      SELECT 1 FROM private.current_external_test_access() test_access
      WHERE test_access.environment_id = character_prompts.environment_id
    )
  );

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
      ELSE COALESCE(
        (SELECT environment_id FROM private.current_external_test_access()),
        'prod'
      )
    END AS environment_id
  )
  SELECT
    profile.character_key,
    profile.display_name,
    (
      profile.enabled
      AND profile.notion_character_id IS NOT NULL
      AND length(coalesce(profile.opening_line, '')) > 0
      AND length(coalesce(profile.portrait_url, '')) > 0
      AND length(coalesce(profile.tts_provider, '')) > 0
      AND length(coalesce(profile.tts_voice_id, '')) > 0
      AND profile.prompt_validated
      AND profile.rag_validated
      AND profile.qualitative_tests_validated
      AND profile.knowledge_isolation_validated
    ) AS ready,
    profile.opening_line,
    profile.portrait_url,
    profile.tts_provider,
    profile.tts_voice_id
  FROM public.character_runtime_profiles profile
  CROSS JOIN requested
  WHERE profile.character_key = lower(p_character_key)
    AND profile.environment_id IN (requested.environment_id, 'prod')
    AND auth.uid() IS NOT NULL
  ORDER BY (profile.environment_id = requested.environment_id) DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text)
  TO authenticated;

-- Add the invitation-verification bucket without changing existing quotas.
CREATE OR REPLACE FUNCTION public.consume_game_rate_limit(
  p_bucket text,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_count integer;
  v_window_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_retry_after integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated game identity required' USING ERRCODE = '42501';
  END IF;

  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id
      AND user_id = v_user_id
      AND started_at > now() - interval '4 hours'
  ) THEN
    RAISE EXCEPTION 'session ownership mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT limits.max_requests, limits.window_seconds
    INTO v_limit, v_window_seconds
  FROM (VALUES
    ('proxy-stt-config', 60, 60),
    ('proxy-stt', 30, 60),
    ('proxy-stt-assemblyai', 30, 60),
    ('proxy-stt-whisper', 30, 60),
    ('proxy-stt-gradium', 30, 60),
    ('proxy-llm', 60, 60),
    ('proxy-tts', 120, 60),
    ('proxy-tts-inworld', 120, 60),
    ('proxy-tts-hume', 120, 60),
    ('proxy-tts-gradium', 120, 60),
    ('proxy-tts-cartesia', 120, 60),
    ('summarize-role', 10, 600),
    ('query-rag', 120, 60),
    ('rewrite-query', 60, 60),
    ('summarize-session', 5, 600),
    ('sync-questionnaire', 5, 3600),
    ('streaming-avatar-status', 30, 60),
    ('streaming-avatar-start', 3, 600),
    ('streaming-avatar-end', 12, 600),
    ('redeem-test-invitation', 5, 600)
  ) AS limits(bucket, max_requests, window_seconds)
  WHERE limits.bucket = p_bucket;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'unknown rate-limit bucket' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.game_rate_limits AS current_limit (
    user_id, bucket, window_started_at, request_count
  ) VALUES (v_user_id, p_bucket, v_now, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE SET
    window_started_at = CASE
      WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now
        THEN v_now ELSE current_limit.window_started_at END,
    request_count = CASE
      WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now
        THEN 1 ELSE current_limit.request_count + 1 END
  RETURNING request_count, window_started_at INTO v_count, v_window_started_at;

  v_retry_after := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
    v_window_started_at + make_interval(secs => v_window_seconds) - v_now
  )))::integer);

  RETURN jsonb_build_object(
    'allowed', v_count <= v_limit,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_count),
    'retry_after', CASE WHEN v_count <= v_limit THEN 0 ELSE v_retry_after END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.consume_game_rate_limit(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_game_rate_limit(text, uuid) TO authenticated;
