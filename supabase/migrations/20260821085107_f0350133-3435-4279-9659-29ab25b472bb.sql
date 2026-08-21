-- AVA v0.26.0 — additive settings contexts, named admins and session tracing.
-- Target: the Supabase project managed by Lovable Cloud only.

CREATE TABLE IF NOT EXISTS public.environments (
  id text PRIMARY KEY,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('production', 'sandbox')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.environments (id, label, type) VALUES
  ('prod', 'Production', 'production'),
  ('sandbox-ulrich', 'Ulrich', 'sandbox'),
  ('sandbox-romed', 'Romed', 'sandbox'),
  ('sandbox-benoit', 'Benoît', 'sandbox')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type;

ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.environments TO anon, authenticated;
GRANT ALL ON public.environments TO service_role;
DROP POLICY IF EXISTS "Anyone can list environments" ON public.environments;
CREATE POLICY "Anyone can list environments"
  ON public.environments FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  default_environment_id text NOT NULL REFERENCES public.environments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- SECURITY DEFINER is intentional: this non-exposed helper only returns
-- membership for the supplied UUID. It cannot read or mutate arbitrary data.
CREATE OR REPLACE FUNCTION private.is_admin_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_user_id
  )
$$;
REVOKE ALL ON FUNCTION private.is_admin_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can read admin users" ON public.admin_users;
CREATE POLICY "Members can read admin users"
  ON public.admin_users FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.is_admin_member((SELECT auth.uid())))
  );

-- Existing accounts are linked immediately. The trigger below covers accounts
-- manually created in Lovable Cloud after this migration is applied.
INSERT INTO public.admin_users (user_id, display_name, default_environment_id)
SELECT id, mapping.display_name, mapping.environment_id
FROM auth.users
JOIN (VALUES
  ('info@memoways.com', 'Production', 'prod'),
  ('ulrich.fischer@memoways.com', 'Ulrich', 'sandbox-ulrich'),
  ('romed@paradigmafilms.ch', 'Romed', 'sandbox-romed'),
  ('benoitperrincreate@gmail.com', 'Benoît', 'sandbox-benoit')
) AS mapping(email, display_name, environment_id)
  ON lower(auth.users.email) = mapping.email
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  default_environment_id = EXCLUDED.default_environment_id;

CREATE OR REPLACE FUNCTION private.enroll_ava_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_display_name text;
  v_environment_id text;
BEGIN
  SELECT mapping.display_name, mapping.environment_id
  INTO v_display_name, v_environment_id
  FROM (VALUES
    ('info@memoways.com', 'Production', 'prod'),
    ('ulrich.fischer@memoways.com', 'Ulrich', 'sandbox-ulrich'),
    ('romed@paradigmafilms.ch', 'Romed', 'sandbox-romed'),
    ('benoitperrincreate@gmail.com', 'Benoît', 'sandbox-benoit')
  ) AS mapping(email, display_name, environment_id)
  WHERE mapping.email = lower(NEW.email);

  IF v_environment_id IS NOT NULL THEN
    INSERT INTO public.admin_users (user_id, display_name, default_environment_id)
    VALUES (NEW.id, v_display_name, v_environment_id)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      default_environment_id = EXCLUDED.default_environment_id;
    IF to_regclass('public.user_roles') IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enroll_ava_admin_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enroll_ava_admin_user ON auth.users;
CREATE TRIGGER enroll_ava_admin_user
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.enroll_ava_admin_user();

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role FROM public.admin_users
ON CONFLICT (user_id, role) DO NOTHING;

-- admin_settings is the settings store used by LLM, TTS, STT, RAG, gameplay,
-- the GM and Max prompt controls. Existing rows become production rows.
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id);
UPDATE public.admin_settings SET environment_id = 'prod' WHERE environment_id IS NULL;
ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_pkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_settings'::regclass
      AND conname = 'admin_settings_pkey'
  ) THEN
    ALTER TABLE public.admin_settings
      ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key, environment_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS admin_settings_environment_key_idx
  ON public.admin_settings (environment_id, key);

-- Compiled character prompts are the effective Max/character prompt store.
ALTER TABLE public.character_prompts
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id);
UPDATE public.character_prompts SET environment_id = 'prod' WHERE environment_id IS NULL;
ALTER TABLE public.character_prompts DROP CONSTRAINT IF EXISTS character_prompts_pkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.character_prompts'::regclass
      AND conname = 'character_prompts_pkey'
  ) THEN
    ALTER TABLE public.character_prompts
      ADD CONSTRAINT character_prompts_pkey PRIMARY KEY (character_id, environment_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS character_prompts_environment_character_idx
  ON public.character_prompts (environment_id, character_id);
GRANT SELECT ON public.character_prompts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.character_prompts TO authenticated;
GRANT ALL ON public.character_prompts TO service_role;

DROP POLICY IF EXISTS "character_prompts_read_all" ON public.character_prompts;
DROP POLICY IF EXISTS "Public read production character prompts" ON public.character_prompts;
DROP POLICY IF EXISTS "Anonymous identity read production character prompts" ON public.character_prompts;
CREATE POLICY "Public read production character prompts"
  ON public.character_prompts FOR SELECT TO anon
  USING (environment_id = 'prod');
CREATE POLICY "Anonymous identity read production character prompts"
  ON public.character_prompts FOR SELECT TO authenticated
  USING (
    environment_id = 'prod'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );

-- Character runtime profiles contain environment-sensitive voice and opening
-- configuration. Sandboxes start as exact production copies.
ALTER TABLE public.character_runtime_profiles
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id);
UPDATE public.character_runtime_profiles SET environment_id = 'prod' WHERE environment_id IS NULL;
ALTER TABLE public.character_runtime_profiles
  DROP CONSTRAINT IF EXISTS character_runtime_profiles_character_key_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.character_runtime_profiles'::regclass
      AND conname = 'character_runtime_profiles_character_key_environment_key'
  ) THEN
    ALTER TABLE public.character_runtime_profiles
      ADD CONSTRAINT character_runtime_profiles_character_key_environment_key
      UNIQUE (character_key, environment_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS character_runtime_profiles_environment_character_idx
  ON public.character_runtime_profiles (environment_id, character_key);

INSERT INTO public.character_runtime_profiles (
  character_key, display_name, enabled, notion_character_id, opening_line,
  portrait_url, tts_provider, tts_voice_id, prompt_validated, rag_validated,
  qualitative_tests_validated, knowledge_isolation_validated, metadata,
  environment_id
)
SELECT
  source.character_key, source.display_name, source.enabled,
  source.notion_character_id, source.opening_line, source.portrait_url,
  source.tts_provider, source.tts_voice_id, source.prompt_validated,
  source.rag_validated, source.qualitative_tests_validated,
  source.knowledge_isolation_validated, source.metadata, environment.id
FROM public.character_runtime_profiles source
CROSS JOIN public.environments environment
WHERE source.environment_id = 'prod'
  AND environment.type = 'sandbox'
ON CONFLICT (character_key, environment_id) DO NOTHING;

-- PRD4's versioned Game Master configuration is also a settings store.
ALTER TABLE public.experience_orchestration_versions
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id);
UPDATE public.experience_orchestration_versions SET environment_id = 'prod'
WHERE environment_id IS NULL;
DROP INDEX IF EXISTS public.experience_orchestration_one_published_idx;
CREATE UNIQUE INDEX IF NOT EXISTS experience_orchestration_one_published_per_environment_idx
  ON public.experience_orchestration_versions (environment_id)
  WHERE status = 'published';

INSERT INTO public.experience_orchestration_versions (
  status, name, prompt, config, source_version_id, published_at, environment_id
)
SELECT
  'published', source.name || ' — ' || environment.label,
  source.prompt, source.config, source.id, now(), environment.id
FROM public.environments environment
CROSS JOIN LATERAL (
  SELECT id, name, prompt, config
  FROM public.experience_orchestration_versions
  WHERE status = 'published' AND environment_id = 'prod'
  ORDER BY published_at DESC NULLS LAST, version_number DESC
  LIMIT 1
) source
WHERE environment.type = 'sandbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.experience_orchestration_versions existing
    WHERE existing.environment_id = environment.id AND existing.status = 'published'
  );

-- Keep only production runtime values public. The password key is deliberately
-- outside the ava_% namespace and is never readable by public clients.
DROP POLICY IF EXISTS "Anon read runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Participant read streaming avatar runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin read all settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin update admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin delete admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Public read production runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anonymous identity read production runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members read all settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members insert settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members update settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members delete settings" ON public.admin_settings;

CREATE POLICY "Public read production runtime settings"
  ON public.admin_settings FOR SELECT TO anon
  USING (environment_id = 'prod' AND key LIKE 'ava\_%');
CREATE POLICY "Anonymous identity read production runtime settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING (
    environment_id = 'prod'
    AND key LIKE 'ava\_%'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );
CREATE POLICY "Members read all settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))));
CREATE POLICY "Members insert settings"
  ON public.admin_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))));
CREATE POLICY "Members update settings"
  ON public.admin_settings FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))));
CREATE POLICY "Members delete settings"
  ON public.admin_settings FOR DELETE TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))));
GRANT SELECT ON public.admin_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id),
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'public'
    CHECK (context_type IN ('public', 'user_test', 'sandbox', 'internal')),
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS tester_label text,
  ADD COLUMN IF NOT EXISTS started_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sessions_environment_started_idx
  ON public.sessions (environment_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_context_started_idx
  ON public.sessions (context_type, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_campaign_started_idx
  ON public.sessions (campaign_id, started_at DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_started_by_idx
  ON public.sessions (started_by_user_id, started_at DESC) WHERE started_by_user_id IS NOT NULL;

-- Denormalized dimensions are additive and make dashboards filterable without
-- another session lookup. Existing writes keep the safe production defaults.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'turn_latencies', 'audio_latencies', 'voice_turn_events', 'voice_error_events'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT ''prod'' REFERENCES public.environments(id)',
        table_name
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT ''public'' CHECK (context_type IN (''public'', ''user_test'', ''sandbox'', ''internal''))',
        table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (environment_id, context_type, created_at DESC)',
        table_name || '_environment_context_idx', table_name
      );
    END IF;
  END LOOP;
END $$;

-- All named members are full administrators. These policies are additive: the
-- participant ownership/write policies used by the public game remain intact.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sessions', 'turn_latencies', 'audio_latencies', 'voice_turn_events',
    'voice_error_events', 'llm_usage', 'openrouter_cost_error_logs',
    'session_summaries', 'conversation_turn_traces', 'questionnaire_responses',
    'rag_lab_pinned_questions',
    'rag_lab_semantic_question_cache', 'characters', 'character_prompts',
    'character_runtime_profiles', 'experience_orchestration_versions',
    'experience_events', 'video_triggers', 'embeddings'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Named members full access" ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY "Named members full access" ON public.%I FOR ALL TO authenticated USING ((SELECT private.is_admin_member((SELECT auth.uid())))) WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))))',
        table_name
      );
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END $$;

-- Account attribution is set server-side and cannot be spoofed by public users.
CREATE OR REPLACE FUNCTION private.trace_ava_session_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_is_member boolean := private.is_admin_member(auth.uid());
BEGIN
  IF NOT v_is_member THEN
    NEW.environment_id := 'prod';
    NEW.started_by_user_id := NULL;
    NEW.context_type := CASE WHEN NEW.campaign_id IS NULL THEN 'public' ELSE 'user_test' END;
  ELSE
    NEW.started_by_user_id := auth.uid();
    NEW.environment_id := CASE
      WHEN EXISTS (SELECT 1 FROM public.environments WHERE id = NEW.environment_id)
        THEN NEW.environment_id
      ELSE 'prod'
    END;
    NEW.context_type := CASE WHEN NEW.environment_id = 'prod' THEN 'internal' ELSE 'sandbox' END;
    NEW.campaign_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trace_ava_session_context ON public.sessions;
CREATE TRIGGER trace_ava_session_context
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.trace_ava_session_context();

-- Participants may update their active session payload, but its attribution is
-- immutable after creation. Named members and the service role retain the full
-- administrative access required by the back-office.
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
     OR NEW.started_by_user_id IS DISTINCT FROM OLD.started_by_user_id THEN
    RAISE EXCEPTION 'session attribution fields cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_ava_session_context_update ON public.sessions;
CREATE TRIGGER protect_ava_session_context_update
  BEFORE UPDATE OF environment_id, context_type, campaign_id, tester_label, started_by_user_id
  ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.protect_ava_session_context_update();

-- Pin the published GM version from the session's environment, with the same
-- sandbox → prod fallback used by JSON settings.
CREATE OR REPLACE FUNCTION public.pin_current_orchestration_version(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_version_id uuid;
  v_environment_id text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT orchestration_version_id, environment_id
    INTO v_version_id, v_environment_id
  FROM public.sessions
  WHERE id = p_session_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;

  IF v_version_id IS NULL THEN
    SELECT id INTO v_version_id
    FROM public.experience_orchestration_versions
    WHERE status = 'published' AND environment_id IN (v_environment_id, 'prod')
    ORDER BY (environment_id = v_environment_id) DESC, published_at DESC NULLS LAST, version_number DESC
    LIMIT 1;

    UPDATE public.sessions SET orchestration_version_id = v_version_id
    WHERE id = p_session_id AND user_id = v_user_id AND orchestration_version_id IS NULL;
  END IF;
  RETURN v_version_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pin_current_orchestration_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_current_orchestration_version(uuid) TO authenticated;

-- Preserve the existing RPC contract as a production-only compatibility path.
CREATE OR REPLACE FUNCTION public.get_character_runtime_readiness(p_character_key text)
RETURNS TABLE (
  character_key text,
  display_name text,
  ready boolean,
  opening_line text,
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
    p.tts_provider,
    p.tts_voice_id
  FROM public.character_runtime_profiles p
  WHERE p.character_key = lower(p_character_key)
    AND p.environment_id = 'prod'
    AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_character_runtime_readiness(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness(text) TO authenticated;

-- Environment-aware runtime lookup. Anonymous identities are forcibly pinned
-- to production; named members receive sandbox → production fallback.
CREATE OR REPLACE FUNCTION public.get_character_runtime_readiness_for_environment(
  p_character_key text,
  p_environment_id text
)
RETURNS TABLE (
  character_key text,
  display_name text,
  ready boolean,
  opening_line text,
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
REVOKE ALL ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_character_runtime_readiness_for_environment(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_experience_orchestration_version(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_environment_id text;
BEGIN
  IF NOT private.is_admin_member(auth.uid()) THEN RAISE EXCEPTION 'admin membership required'; END IF;
  SELECT environment_id INTO v_environment_id
  FROM public.experience_orchestration_versions
  WHERE id = p_version_id AND status = 'draft';
  IF v_environment_id IS NULL THEN RAISE EXCEPTION 'publishable version not found'; END IF;

  UPDATE public.experience_orchestration_versions
  SET status = 'archived', archived_at = now(), updated_at = now()
  WHERE status = 'published' AND environment_id = v_environment_id AND id <> p_version_id;
  UPDATE public.experience_orchestration_versions
  SET status = 'published', published_at = now(), archived_at = NULL, updated_at = now()
  WHERE id = p_version_id;
  RETURN p_version_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_experience_orchestration_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_experience_orchestration_version(uuid) TO authenticated;