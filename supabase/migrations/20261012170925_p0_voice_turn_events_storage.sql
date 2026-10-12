-- P0 storage prerequisite, confirmed missing in Lovable Cloud iralfqlslqndgvexixis.
-- Apply only through Lovable Cloud after approval of this additive correction.
-- No session, runtime setting, prompt, provider or historical row is changed.
CREATE TABLE IF NOT EXISTS public.voice_turn_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid,
  turn_id text NOT NULL,
  turn_index integer,
  event_name text NOT NULL DEFAULT 'voice_turn_completed',
  severity text,
  blocker_step text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Also supports environments where the historical table was created previously.
ALTER TABLE public.voice_turn_events
  ADD COLUMN IF NOT EXISTS environment_id text NOT NULL DEFAULT 'prod'
    REFERENCES public.environments(id),
  ADD COLUMN IF NOT EXISTS context_type text NOT NULL DEFAULT 'public'
    CHECK (context_type IN ('public', 'user_test', 'sandbox', 'internal'));

CREATE INDEX IF NOT EXISTS idx_voice_turn_events_session ON public.voice_turn_events(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_turn_id ON public.voice_turn_events(turn_id);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_created ON public.voice_turn_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_environment_page
  ON public.voice_turn_events(environment_id, created_at DESC, id DESC);

ALTER TABLE public.voice_turn_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_turn_events FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON public.voice_turn_events TO authenticated;
GRANT ALL ON public.voice_turn_events TO service_role;

-- Do not restore the public read/write policies of the unapplied legacy migration.
DROP POLICY IF EXISTS "Anyone can insert voice turn events" ON public.voice_turn_events;
DROP POLICY IF EXISTS "Anyone can read voice turn events" ON public.voice_turn_events;
DROP POLICY IF EXISTS "Named members full access" ON public.voice_turn_events;
DROP POLICY IF EXISTS "Participant inserts telemetry for own session" ON public.voice_turn_events;
DROP POLICY IF EXISTS "Admins read voice telemetry" ON public.voice_turn_events;

CREATE POLICY "Participant inserts telemetry for own session"
  ON public.voice_turn_events FOR INSERT TO authenticated
  WITH CHECK (
    session_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions AS session
      WHERE session.id = voice_turn_events.session_id
        AND session.user_id = (SELECT auth.uid())
        AND session.started_at > now() - interval '4 hours'
        AND session.environment_id = voice_turn_events.environment_id
        AND session.context_type = voice_turn_events.context_type
    )
  );

-- Auth anonymous participants also use authenticated, so require actual membership.
CREATE POLICY "Admins read voice telemetry"
  ON public.voice_turn_events FOR SELECT TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))));

NOTIFY pgrst, 'reload schema';
