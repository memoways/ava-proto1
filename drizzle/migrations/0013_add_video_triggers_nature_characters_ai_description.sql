ALTER TABLE public.video_triggers
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS characters text[],
  ADD COLUMN IF NOT EXISTS ai_description text;