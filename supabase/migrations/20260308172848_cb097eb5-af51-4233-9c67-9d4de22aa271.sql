
-- LLM Usage tracking table
CREATE TABLE public.llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  feature_key text NOT NULL DEFAULT 'chat',
  request_type text NOT NULL DEFAULT 'chat_completion',
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  generation_id text,
  cost_usd numeric(12, 8) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  metadata_json jsonb DEFAULT '{}'::jsonb,
  error_message text
);

-- Indexes for efficient queries
CREATE INDEX idx_llm_usage_created_at ON public.llm_usage(created_at DESC);
CREATE INDEX idx_llm_usage_model ON public.llm_usage(model);
CREATE INDEX idx_llm_usage_feature_key ON public.llm_usage(feature_key);
CREATE INDEX idx_llm_usage_session_id ON public.llm_usage(session_id);
CREATE INDEX idx_llm_usage_status ON public.llm_usage(status);

-- RLS
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read llm_usage" ON public.llm_usage FOR SELECT USING (true);
CREATE POLICY "Anyone can insert llm_usage" ON public.llm_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update llm_usage" ON public.llm_usage FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete llm_usage" ON public.llm_usage FOR DELETE USING (true);

-- Enable realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.llm_usage;
