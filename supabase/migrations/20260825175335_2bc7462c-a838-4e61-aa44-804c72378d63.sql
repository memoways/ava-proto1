-- AVA — LLM as judge (lot 1, tours isolés).
-- Target: the Supabase project managed by Lovable Cloud only.
-- Admin-only: anonymous clients must not read eval corpora or scores.

CREATE TABLE IF NOT EXISTS public.eval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL UNIQUE,
  question text NOT NULL,
  gold_answer text NOT NULL DEFAULT '',
  must_include text NOT NULL DEFAULT '',
  must_not text NOT NULL DEFAULT '',
  tone text,
  max_length integer,
  category text,
  active boolean NOT NULL DEFAULT true,
  character_name text NOT NULL DEFAULT 'Max',
  sort_order integer NOT NULL DEFAULT 0,
  judge_notes text NOT NULL DEFAULT '',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eval_items_active_order_idx
  ON public.eval_items (active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'paused', 'done', 'failed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  ofat_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  judge_model text NOT NULL,
  repeats integer NOT NULL DEFAULT 3 CHECK (repeats >= 1 AND repeats <= 5),
  estimated_turns integer,
  estimated_cost_usd numeric,
  actual_cost_usd numeric,
  current_index integer NOT NULL DEFAULT 0,
  total_turns integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eval_runs_created_at_idx
  ON public.eval_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.eval_runs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.eval_items(id) ON DELETE CASCADE,
  config_label text NOT NULL,
  factor text NOT NULL,
  repeat_index integer NOT NULL CHECK (repeat_index >= 1 AND repeat_index <= 5),
  max_response text,
  judge_json jsonb,
  overall_score numeric,
  rag_matches jsonb,
  gm_brief jsonb,
  validator jsonb,
  latencies jsonb,
  tokens jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, item_id, config_label, repeat_index)
);

CREATE INDEX IF NOT EXISTS eval_results_run_id_idx
  ON public.eval_results (run_id, config_label);

ALTER TABLE public.eval_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.eval_items FROM PUBLIC, anon;
REVOKE ALL ON public.eval_runs FROM PUBLIC, anon;
REVOKE ALL ON public.eval_results FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eval_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eval_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eval_results TO authenticated;
GRANT ALL ON public.eval_items TO service_role;
GRANT ALL ON public.eval_runs TO service_role;
GRANT ALL ON public.eval_results TO service_role;

DROP POLICY IF EXISTS "Admins manage eval items" ON public.eval_items;
CREATE POLICY "Admins manage eval items"
  ON public.eval_items FOR ALL TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))));

DROP POLICY IF EXISTS "Admins manage eval runs" ON public.eval_runs;
CREATE POLICY "Admins manage eval runs"
  ON public.eval_runs FOR ALL TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))));

DROP POLICY IF EXISTS "Admins manage eval results" ON public.eval_results;
CREATE POLICY "Admins manage eval results"
  ON public.eval_results FOR ALL TO authenticated
  USING ((SELECT private.is_admin_member((SELECT auth.uid()))))
  WITH CHECK ((SELECT private.is_admin_member((SELECT auth.uid()))));