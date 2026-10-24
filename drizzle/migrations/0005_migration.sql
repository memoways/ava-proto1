ALTER TABLE public.character_prompts
  ADD COLUMN IF NOT EXISTS maniere_de_parler text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS speech_states jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.character_prompts.speech_states IS 'Parsed from the "Tes états de parole" list of maniere_de_parler at Notion sync: [{name, description}]';