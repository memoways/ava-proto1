ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS ava_start_variant TEXT,
  ADD COLUMN IF NOT EXISTS has_seen_film TEXT,
  ADD COLUMN IF NOT EXISTS teaser_shown BOOLEAN,
  ADD COLUMN IF NOT EXISTS user_posture_raw TEXT,
  ADD COLUMN IF NOT EXISTS user_posture_mode TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_max_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_duration_ms INTEGER;