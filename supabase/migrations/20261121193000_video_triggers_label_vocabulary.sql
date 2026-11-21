-- Video decisions lot 2: shared vocabulary for videos and the Game Master.
-- emotions / stakes / on_screen are Notion multi-selects (who is visible is not
-- who may speak: `characters` keeps that meaning).
-- video_label_vocabulary is replaced on each sync with the current Notion options
-- (or the union of values when a property has no options). Nullable-free arrays,
-- no backfill: sync-notion fills them on its next run.
-- Additive. Until this is applied, sync-notion retries without the new columns
-- and without the snapshot table.
ALTER TABLE public.video_triggers
  ADD COLUMN IF NOT EXISTS emotions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stakes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS on_screen text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.video_label_vocabulary (
  id text PRIMARY KEY DEFAULT 'current',
  themes text[] NOT NULL DEFAULT '{}',
  emotions text[] NOT NULL DEFAULT '{}',
  stakes text[] NOT NULL DEFAULT '{}',
  on_screen text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_label_vocabulary_singleton CHECK (id = 'current')
);

ALTER TABLE public.video_label_vocabulary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_label_vocabulary FROM PUBLIC;
GRANT SELECT ON public.video_label_vocabulary TO anon, authenticated;
GRANT ALL ON public.video_label_vocabulary TO service_role;

DROP POLICY IF EXISTS "Public read video_label_vocabulary" ON public.video_label_vocabulary;
CREATE POLICY "Public read video_label_vocabulary"
  ON public.video_label_vocabulary FOR SELECT
  TO anon, authenticated
  USING (true);
