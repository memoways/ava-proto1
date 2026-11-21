-- Film extracts lot 1: transcription and dialogue synced from Notion "🎬 Vidéos AVA".
-- transcription: what is actually said (distinct from description / ai_description);
-- dialogue: 'spoken' | 'silent' | NULL (not filled in); transcription_verified: human check.
-- Nullable, additive, no backfill: sync-notion fills them on its next run.
ALTER TABLE public.video_triggers
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS dialogue text,
  ADD COLUMN IF NOT EXISTS transcription_verified boolean NOT NULL DEFAULT false;
