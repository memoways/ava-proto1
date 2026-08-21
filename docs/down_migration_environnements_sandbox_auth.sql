-- Manual rollback for 20260821120000_settings_environments_admin_users.sql.
-- Run only in Lovable Cloud after exporting sandbox rows for audit.
BEGIN;

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
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Public read production runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anonymous identity read production runtime settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members read all settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members insert settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members update settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members delete settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Members can read admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Public read production character prompts" ON public.character_prompts;
DROP POLICY IF EXISTS "Anonymous identity read production character prompts" ON public.character_prompts;

CREATE TABLE IF NOT EXISTS public.admin_settings_sandbox_archive AS
SELECT * FROM public.admin_settings WHERE false;
INSERT INTO public.admin_settings_sandbox_archive
SELECT * FROM public.admin_settings WHERE environment_id <> 'prod';
DELETE FROM public.admin_settings WHERE environment_id <> 'prod';

CREATE TABLE IF NOT EXISTS public.experience_orchestration_sandbox_archive AS
SELECT * FROM public.experience_orchestration_versions WHERE false;
INSERT INTO public.experience_orchestration_sandbox_archive
SELECT * FROM public.experience_orchestration_versions WHERE environment_id <> 'prod';
DELETE FROM public.experience_orchestration_versions WHERE environment_id <> 'prod';
DROP INDEX IF EXISTS public.experience_orchestration_one_published_per_environment_idx;
ALTER TABLE public.experience_orchestration_versions DROP COLUMN IF EXISTS environment_id;
CREATE UNIQUE INDEX IF NOT EXISTS experience_orchestration_one_published_idx
  ON public.experience_orchestration_versions ((status)) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.character_prompts_sandbox_archive AS
SELECT * FROM public.character_prompts WHERE false;
INSERT INTO public.character_prompts_sandbox_archive
SELECT * FROM public.character_prompts WHERE environment_id <> 'prod';
DELETE FROM public.character_prompts WHERE environment_id <> 'prod';
DROP INDEX IF EXISTS public.character_prompts_environment_character_idx;
ALTER TABLE public.character_prompts DROP CONSTRAINT IF EXISTS character_prompts_pkey;
ALTER TABLE public.character_prompts ADD CONSTRAINT character_prompts_pkey PRIMARY KEY (character_id);
ALTER TABLE public.character_prompts DROP COLUMN IF EXISTS environment_id;
DROP POLICY IF EXISTS "character_prompts_read_all" ON public.character_prompts;
CREATE POLICY "character_prompts_read_all" ON public.character_prompts FOR SELECT USING (true);

DROP FUNCTION IF EXISTS public.get_character_runtime_readiness_for_environment(text, text);
DROP FUNCTION IF EXISTS public.get_character_runtime_readiness(text);
CREATE TABLE IF NOT EXISTS public.character_runtime_profiles_sandbox_archive AS
SELECT * FROM public.character_runtime_profiles WHERE false;
INSERT INTO public.character_runtime_profiles_sandbox_archive
SELECT * FROM public.character_runtime_profiles WHERE environment_id <> 'prod';
DELETE FROM public.character_runtime_profiles WHERE environment_id <> 'prod';
DROP INDEX IF EXISTS public.character_runtime_profiles_environment_character_idx;
ALTER TABLE public.character_runtime_profiles
  DROP CONSTRAINT IF EXISTS character_runtime_profiles_character_key_environment_key;
ALTER TABLE public.character_runtime_profiles
  ADD CONSTRAINT character_runtime_profiles_character_key_key UNIQUE (character_key);
ALTER TABLE public.character_runtime_profiles DROP COLUMN IF EXISTS environment_id;

DROP TRIGGER IF EXISTS trace_ava_session_context ON public.sessions;
DROP FUNCTION IF EXISTS private.trace_ava_session_context();
DROP TRIGGER IF EXISTS protect_ava_session_context_update ON public.sessions;
DROP FUNCTION IF EXISTS private.protect_ava_session_context_update();
DROP TRIGGER IF EXISTS enroll_ava_admin_user ON auth.users;
DROP FUNCTION IF EXISTS private.enroll_ava_admin_user();
DROP FUNCTION IF EXISTS public.pin_current_orchestration_version(uuid);
DROP FUNCTION IF EXISTS public.publish_experience_orchestration_version(uuid);

ALTER TABLE public.admin_settings DROP CONSTRAINT IF EXISTS admin_settings_pkey;
ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.admin_settings DROP COLUMN IF EXISTS environment_id;

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS environment_id,
  DROP COLUMN IF EXISTS context_type,
  DROP COLUMN IF EXISTS campaign_id,
  DROP COLUMN IF EXISTS tester_label,
  DROP COLUMN IF EXISTS started_by_user_id;

ALTER TABLE public.turn_latencies DROP COLUMN IF EXISTS environment_id, DROP COLUMN IF EXISTS context_type;
ALTER TABLE public.audio_latencies DROP COLUMN IF EXISTS environment_id, DROP COLUMN IF EXISTS context_type;
ALTER TABLE public.voice_turn_events DROP COLUMN IF EXISTS environment_id, DROP COLUMN IF EXISTS context_type;
ALTER TABLE public.voice_error_events DROP COLUMN IF EXISTS environment_id, DROP COLUMN IF EXISTS context_type;

DROP FUNCTION IF EXISTS private.is_admin_member(uuid);
DROP TABLE IF EXISTS public.admin_users;
DROP TABLE IF EXISTS public.environments;

COMMIT;

-- Finally re-apply the RLS and RPC definitions from
-- 20260712154557_a4a91994-526a-4a72-acb4-5a38461b22bb.sql and
-- 20260807120000_experience_orchestration_foundations.sql in Lovable Cloud.
