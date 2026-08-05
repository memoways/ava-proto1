ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS conversation_memory jsonb NOT NULL DEFAULT '{"version":1,"lastTurn":0,"interlocutor":{"name":null,"role":null,"traits":[]},"userFacts":[],"maxDisclosures":[],"commitments":[],"openThreads":[],"topics":[],"relationship":{"depth":"surface","trust":"neutre","emotionalState":null,"sourceTurn":0},"lastExchange":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory_last_turn integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_expires_at timestamptz;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_memory_last_turn_nonnegative,
  ADD CONSTRAINT sessions_memory_last_turn_nonnegative CHECK (memory_last_turn >= 0);

CREATE INDEX IF NOT EXISTS sessions_owner_resumable_idx
  ON public.sessions (user_id, resume_expires_at DESC)
  WHERE ended_at IS NULL AND resume_expires_at IS NOT NULL;

COMMENT ON COLUMN public.sessions.conversation_memory IS
  'Mémoire conversationnelle structurée et bornée, versionnée par memory_last_turn.';
COMMENT ON COLUMN public.sessions.resume_expires_at IS
  'Fin de la fenêtre de reprise calculée au démarrage (durée configurée + marge).';
