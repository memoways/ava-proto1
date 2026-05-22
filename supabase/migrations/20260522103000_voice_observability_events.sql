CREATE TABLE IF NOT EXISTS public.voice_turn_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID,
  turn_id TEXT NOT NULL,
  turn_index INTEGER,
  event_name TEXT NOT NULL DEFAULT 'voice_turn_completed',
  severity TEXT,
  blocker_step TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_turn_events_session ON public.voice_turn_events(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_turn_id ON public.voice_turn_events(turn_id);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_created ON public.voice_turn_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_turn_events_blocker ON public.voice_turn_events(blocker_step, severity);

ALTER TABLE public.voice_turn_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert voice turn events" ON public.voice_turn_events;
DROP POLICY IF EXISTS "Anyone can read voice turn events" ON public.voice_turn_events;
CREATE POLICY "Anyone can insert voice turn events" ON public.voice_turn_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read voice turn events" ON public.voice_turn_events FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.voice_error_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID,
  turn_id TEXT,
  turn_index INTEGER,
  component TEXT NOT NULL,
  provider TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT,
  recoverable BOOLEAN DEFAULT true,
  fallback_used TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_voice_error_events_session ON public.voice_error_events(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_error_events_turn_id ON public.voice_error_events(turn_id);
CREATE INDEX IF NOT EXISTS idx_voice_error_events_created ON public.voice_error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_error_events_component ON public.voice_error_events(component, error_type);

ALTER TABLE public.voice_error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert voice error events" ON public.voice_error_events;
DROP POLICY IF EXISTS "Anyone can read voice error events" ON public.voice_error_events;
CREATE POLICY "Anyone can insert voice error events" ON public.voice_error_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read voice error events" ON public.voice_error_events FOR SELECT USING (true);
