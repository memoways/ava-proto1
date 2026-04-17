ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS variante_onboarding text,
  ADD COLUMN IF NOT EXISTS modalite_voix text,
  ADD COLUMN IF NOT EXISTS personnage_appele text DEFAULT 'max',
  ADD COLUMN IF NOT EXISTS player_role jsonb,
  ADD COLUMN IF NOT EXISTS narrative_end boolean DEFAULT false;