-- Add unique constraint on notion_id for upsert support
-- Characters
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_notion_id_key') THEN
    ALTER TABLE public.characters ADD CONSTRAINT characters_notion_id_key UNIQUE (notion_id);
  END IF;
END $$;

-- Storyworld
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storyworld_notion_id_key') THEN
    ALTER TABLE public.storyworld ADD CONSTRAINT storyworld_notion_id_key UNIQUE (notion_id);
  END IF;
END $$;

-- Gameplay steps
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gameplay_steps_notion_id_key') THEN
    ALTER TABLE public.gameplay_steps ADD CONSTRAINT gameplay_steps_notion_id_key UNIQUE (notion_id);
  END IF;
END $$;

-- Video triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_triggers_notion_id_key') THEN
    ALTER TABLE public.video_triggers ADD CONSTRAINT video_triggers_notion_id_key UNIQUE (notion_id);
  END IF;
END $$;

-- Rules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rules_notion_id_key') THEN
    ALTER TABLE public.rules ADD CONSTRAINT rules_notion_id_key UNIQUE (notion_id);
  END IF;
END $$;

-- Allow service role to insert/update embeddings (for sync-notion)
CREATE POLICY "Service role can insert embeddings"
  ON public.embeddings FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update embeddings"
  ON public.embeddings FOR UPDATE
  TO service_role
  USING (true);

-- Allow service role to insert/update narrative tables (for sync-notion)
CREATE POLICY "Service role can insert characters"
  ON public.characters FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update characters"
  ON public.characters FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert storyworld"
  ON public.storyworld FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update storyworld"
  ON public.storyworld FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert gameplay_steps"
  ON public.gameplay_steps FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update gameplay_steps"
  ON public.gameplay_steps FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert video_triggers"
  ON public.video_triggers FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update video_triggers"
  ON public.video_triggers FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert rules"
  ON public.rules FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update rules"
  ON public.rules FOR UPDATE
  TO service_role
  USING (true);