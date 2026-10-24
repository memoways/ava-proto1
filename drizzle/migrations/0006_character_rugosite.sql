ALTER TABLE public.character_runtime_profiles
  ADD COLUMN IF NOT EXISTS rugosite smallint NOT NULL DEFAULT 0;
ALTER TABLE public.character_runtime_profiles
  ADD CONSTRAINT character_runtime_profiles_rugosite_check CHECK (rugosite BETWEEN 0 AND 3) NOT VALID;