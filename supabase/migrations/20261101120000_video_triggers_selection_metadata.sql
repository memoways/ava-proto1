-- Video selection lot 1: additive metadata synced from Notion "🎬 Vidéos AVA".
-- nature: 'extract' | 'transformed'; characters: character ids or {'all'};
-- ai_description: automatic factual description, never overwrites description.
-- Nullable, no backfill: sync-notion fills them on its next run.
ALTER TABLE public.video_triggers
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS characters text[],
  ADD COLUMN IF NOT EXISTS ai_description text;
