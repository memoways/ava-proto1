-- Phase 1: give every public game participant a real, anonymous Supabase
-- identity. Sessions stay private to that identity and expensive Edge
-- Functions share an atomic per-user rate limiter.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS sessions_user_id_started_at_idx
  ON public.sessions (user_id, started_at DESC)
  WHERE user_id IS NOT NULL;

-- Expand step: authenticated clients get private ownership while the previous
-- anonymous frontend can keep running during the Lovable rollout. The next
-- migration removes that temporary compatibility path.
CREATE OR REPLACE FUNCTION private.protect_game_session_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      NEW.user_id := NULL;
      RETURN NEW;
    END IF;
    NEW.user_id := auth.uid();
    NEW.started_at := clock_timestamp();
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Temporary compatibility for the old anonymous frontend. Once the contract
  -- migration revokes anon access this branch is no longer reachable.
  IF auth.uid() IS NULL AND OLD.user_id IS NULL THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
      RAISE EXCEPTION 'protected session fields cannot be changed' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'session ownership mismatch' USING ERRCODE = '42501';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.admin_note IS DISTINCT FROM OLD.admin_note THEN
    RAISE EXCEPTION 'protected session fields cannot be changed' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_game_session_identity ON public.sessions;
CREATE TRIGGER protect_game_session_identity
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.protect_game_session_identity();

DROP POLICY IF EXISTS "Participant insert own session" ON public.sessions;
DROP POLICY IF EXISTS "Participant read own session" ON public.sessions;
DROP POLICY IF EXISTS "Participant update own active session" ON public.sessions;
DROP POLICY IF EXISTS "Admin read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admin update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admin delete sessions" ON public.sessions;

CREATE POLICY "Participant insert own session"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Participant read own session"
  ON public.sessions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Participant update own active session"
  ON public.sessions FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND started_at > now() - interval '4 hours'
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND started_at > now() - interval '4 hours'
  );

CREATE POLICY "Admin read sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin update sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin delete sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;

CREATE TABLE IF NOT EXISTS private.game_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE private.game_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.game_rate_limits FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER is intentional here: callers may only increment their own
-- counter because the identity comes exclusively from auth.uid(). The backing
-- table lives in an unexposed schema and EXECUTE is revoked from PUBLIC/anon.
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
    SELECT 1
    FROM public.sessions
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
    ('summarize-role', 10, 600),
    ('query-rag', 120, 60),
    ('rewrite-query', 60, 60),
    ('summarize-session', 5, 600),
    ('sync-questionnaire', 5, 3600)
  ) AS limits(bucket, max_requests, window_seconds)
  WHERE limits.bucket = p_bucket;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'unknown rate-limit bucket' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.game_rate_limits AS current_limit (
    user_id, bucket, window_started_at, request_count
  ) VALUES (
    v_user_id, p_bucket, v_now, 1
  )
  ON CONFLICT (user_id, bucket) DO UPDATE SET
    window_started_at = CASE
      WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now
        THEN v_now
      ELSE current_limit.window_started_at
    END,
    request_count = CASE
      WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now
        THEN 1
      ELSE current_limit.request_count + 1
    END
  RETURNING request_count, window_started_at
    INTO v_count, v_window_started_at;

  v_retry_after := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (
      v_window_started_at + make_interval(secs => v_window_seconds) - v_now
    )))::integer
  );

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
