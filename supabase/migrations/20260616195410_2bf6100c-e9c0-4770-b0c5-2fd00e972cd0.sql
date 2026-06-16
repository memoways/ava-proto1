ALTER TABLE public.video_triggers ADD COLUMN IF NOT EXISTS context text;
ALTER TABLE public.video_triggers ADD COLUMN IF NOT EXISTS description text;
-- Purge legacy fake triggers (those that never came from Notion)
DELETE FROM public.video_triggers WHERE notion_id IS NULL;