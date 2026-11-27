-- Latency lot 3: additive columns, nullable, no row rewritten.
-- latency_ms: first token for a streamed call, whole call otherwise (metadata_json.latency_kind).
-- cached_tokens: OpenRouter usage.prompt_tokens_details.cached_tokens.
ALTER TABLE public.llm_usage
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS cached_tokens integer;
