
DROP POLICY IF EXISTS "Anon update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.sessions;
CREATE POLICY "Anon update recent sessions"
  ON public.sessions
  FOR UPDATE
  TO anon, authenticated
  USING (started_at > now() - interval '4 hours')
  WITH CHECK (started_at > now() - interval '4 hours');

DROP POLICY IF EXISTS "Anon update llm_usage" ON public.llm_usage;
CREATE POLICY "Anon update recent llm_usage"
  ON public.llm_usage
  FOR UPDATE
  TO anon, authenticated
  USING (created_at > now() - interval '2 hours')
  WITH CHECK (created_at > now() - interval '2 hours');

DROP POLICY IF EXISTS "Anon update cost_error_logs" ON public.openrouter_cost_error_logs;
CREATE POLICY "Anon update recent cost_error_logs"
  ON public.openrouter_cost_error_logs
  FOR UPDATE
  TO anon, authenticated
  USING (created_at > now() - interval '2 hours')
  WITH CHECK (created_at > now() - interval '2 hours');

DROP POLICY IF EXISTS "Public read admin_settings" ON public.admin_settings;
CREATE POLICY "Anon read runtime settings"
  ON public.admin_settings
  FOR SELECT
  TO anon
  USING (key LIKE 'ava\_%');
CREATE POLICY "Admin read all settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR key LIKE 'ava\_%');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'llm_usage'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.llm_usage';
  END IF;
END $$;
