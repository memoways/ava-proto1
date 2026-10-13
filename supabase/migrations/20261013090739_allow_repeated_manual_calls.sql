-- The player can call the other character repeatedly within the same session.
-- Keep the counter, existing rows, NOT NULL/default, grants and RLS unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_handoff_count_check,
  ADD CONSTRAINT sessions_handoff_count_check CHECK (handoff_count >= 0);
COMMIT;
