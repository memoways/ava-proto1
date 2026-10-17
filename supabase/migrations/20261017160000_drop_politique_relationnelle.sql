-- The Notion property was empty and is no longer read. Drop it so sync
-- and the editor stop carrying a blank prompt field.
ALTER TABLE public.character_prompts
  DROP COLUMN IF EXISTS politique_relationnelle;
