CREATE TABLE public.openrouter_cost_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NULL,
  generation_id TEXT NULL,
  error_type TEXT NOT NULL,
  status_code INTEGER NULL,
  error_message TEXT NULL,
  source TEXT NOT NULL DEFAULT 'cost_fetch',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.openrouter_cost_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read openrouter cost error logs"
ON public.openrouter_cost_error_logs
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert openrouter cost error logs"
ON public.openrouter_cost_error_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update openrouter cost error logs"
ON public.openrouter_cost_error_logs
FOR UPDATE
USING (true);

CREATE INDEX idx_openrouter_cost_error_logs_occurred_at
ON public.openrouter_cost_error_logs (occurred_at DESC);

CREATE INDEX idx_openrouter_cost_error_logs_generation_id
ON public.openrouter_cost_error_logs (generation_id);

CREATE INDEX idx_openrouter_cost_error_logs_error_type
ON public.openrouter_cost_error_logs (error_type);