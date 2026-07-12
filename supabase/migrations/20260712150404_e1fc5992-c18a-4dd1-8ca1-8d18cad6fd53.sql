
-- ============================================
-- 1. ROLE SYSTEM
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- 2. DROP EXISTING PERMISSIVE POLICIES
-- ============================================

-- admin_settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.admin_settings;

-- audio_latencies
DROP POLICY IF EXISTS "Anyone can read audio latencies" ON public.audio_latencies;
DROP POLICY IF EXISTS "Anyone can insert audio latencies" ON public.audio_latencies;

-- character_prompts
DROP POLICY IF EXISTS "character_prompts_read_all" ON public.character_prompts;

-- characters
DROP POLICY IF EXISTS "Anyone can read characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can insert characters" ON public.characters;
DROP POLICY IF EXISTS "Anyone can update characters" ON public.characters;

-- llm_usage
DROP POLICY IF EXISTS "Anyone can read llm_usage" ON public.llm_usage;
DROP POLICY IF EXISTS "Anyone can insert llm_usage" ON public.llm_usage;
DROP POLICY IF EXISTS "Anyone can update llm_usage" ON public.llm_usage;
DROP POLICY IF EXISTS "Anyone can delete llm_usage" ON public.llm_usage;

-- openrouter_cost_error_logs
DROP POLICY IF EXISTS "Anyone can read openrouter cost error logs" ON public.openrouter_cost_error_logs;
DROP POLICY IF EXISTS "Anyone can insert openrouter cost error logs" ON public.openrouter_cost_error_logs;
DROP POLICY IF EXISTS "Anyone can update openrouter cost error logs" ON public.openrouter_cost_error_logs;

-- session_summaries
DROP POLICY IF EXISTS "Anyone can read session summaries" ON public.session_summaries;
DROP POLICY IF EXISTS "Anyone can insert session summaries" ON public.session_summaries;
DROP POLICY IF EXISTS "Anyone can update session summaries" ON public.session_summaries;
DROP POLICY IF EXISTS "Anyone can delete session summaries" ON public.session_summaries;

-- sessions
DROP POLICY IF EXISTS "Anyone can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can delete sessions" ON public.sessions;

-- turn_latencies
DROP POLICY IF EXISTS "Anyone can read turn latencies" ON public.turn_latencies;
DROP POLICY IF EXISTS "Anyone can insert turn latencies" ON public.turn_latencies;

-- video_triggers
DROP POLICY IF EXISTS "Anyone can read video triggers" ON public.video_triggers;
DROP POLICY IF EXISTS "Anyone can insert video triggers" ON public.video_triggers;
DROP POLICY IF EXISTS "Anyone can update video triggers" ON public.video_triggers;
DROP POLICY IF EXISTS "Anyone can delete video triggers" ON public.video_triggers;

-- ============================================
-- 3. NEW POLICIES
-- ============================================

-- admin_settings: public read (needed by runtime for STT/TTS/LLM config), admin write
CREATE POLICY "Public read admin_settings"
  ON public.admin_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert admin_settings"
  ON public.admin_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update admin_settings"
  ON public.admin_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete admin_settings"
  ON public.admin_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- audio_latencies: anon insert (telemetry), admin read only
CREATE POLICY "Anon insert audio_latencies"
  ON public.audio_latencies FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admin read audio_latencies"
  ON public.audio_latencies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- character_prompts: public read (runtime needs prompts), admin write kept via service_role
CREATE POLICY "Public read character_prompts"
  ON public.character_prompts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write character_prompts"
  ON public.character_prompts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- characters: public read, admin write
CREATE POLICY "Public read characters"
  ON public.characters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write characters"
  ON public.characters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- llm_usage: anon insert + update (tracker updates cost async), admin read/delete
CREATE POLICY "Anon insert llm_usage"
  ON public.llm_usage FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon update llm_usage"
  ON public.llm_usage FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Admin read llm_usage"
  ON public.llm_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete llm_usage"
  ON public.llm_usage FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- openrouter_cost_error_logs: anon insert + update (retry loop), admin read
CREATE POLICY "Anon insert cost_error_logs"
  ON public.openrouter_cost_error_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon update cost_error_logs"
  ON public.openrouter_cost_error_logs FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Admin read cost_error_logs"
  ON public.openrouter_cost_error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- session_summaries: anon insert (runtime creates summary at end of session), admin read/update/delete
CREATE POLICY "Anon insert session_summaries"
  ON public.session_summaries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admin read session_summaries"
  ON public.session_summaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update session_summaries"
  ON public.session_summaries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete session_summaries"
  ON public.session_summaries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- sessions: anon insert + update (runtime needs to create/update session in progress), admin read/delete
CREATE POLICY "Anon insert sessions"
  ON public.sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon update sessions"
  ON public.sessions FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Admin read sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- turn_latencies: anon insert (telemetry), admin read
CREATE POLICY "Anon insert turn_latencies"
  ON public.turn_latencies FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admin read turn_latencies"
  ON public.turn_latencies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- video_triggers: public read (runtime needs triggers), admin write
CREATE POLICY "Public read video_triggers"
  ON public.video_triggers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write video_triggers"
  ON public.video_triggers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
