-- Nuance Live joins the streaming avatar providers. Constraint only: no row is rewritten.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_streaming_avatar_provider_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_streaming_avatar_provider_check
    CHECK (
      streaming_avatar_provider IS NULL
      OR streaming_avatar_provider IN ('heygen', 'tavus', 'anam', 'lemonslice', 'nuance')
    );