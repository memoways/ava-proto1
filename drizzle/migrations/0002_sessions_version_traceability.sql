ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS character_prompt_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS gm_code_version text;
COMMENT ON COLUMN public.sessions.character_prompt_versions IS 'Map character_key -> prompt updated_at used during the session';
COMMENT ON COLUMN public.sessions.gm_code_version IS 'Version of the Game Master code (prompt builder + frame) used by the session';