ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS output_mode text NOT NULL DEFAULT 'tts'
    CHECK (output_mode IN ('tts', 'streaming_avatar')),
  ADD COLUMN IF NOT EXISTS streaming_avatar_provider text
    CHECK (streaming_avatar_provider IS NULL OR streaming_avatar_provider IN ('heygen', 'tavus')),
  ADD COLUMN IF NOT EXISTS streaming_avatar_session_id text,
  ADD COLUMN IF NOT EXISTS streaming_avatar_connect_ms integer
    CHECK (streaming_avatar_connect_ms IS NULL OR streaming_avatar_connect_ms >= 0),
  ADD COLUMN IF NOT EXISTS streaming_avatar_first_frame_ms integer
    CHECK (streaming_avatar_first_frame_ms IS NULL OR streaming_avatar_first_frame_ms >= 0),
  ADD COLUMN IF NOT EXISTS streaming_avatar_first_speech_ms integer
    CHECK (streaming_avatar_first_speech_ms IS NULL OR streaming_avatar_first_speech_ms >= 0),
  ADD COLUMN IF NOT EXISTS streaming_avatar_fallback_reason text;

DROP POLICY IF EXISTS "Participant read streaming avatar runtime settings" ON public.admin_settings;
CREATE POLICY "Participant read streaming avatar runtime settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (key IN ('ava_output_settings', 'ava_streaming_avatar_settings'));

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
    ('sync-questionnaire', 5, 3600),
    ('streaming-avatar-status', 30, 60),
    ('streaming-avatar-start', 3, 600),
    ('streaming-avatar-end', 12, 600)
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