-- Lovable Cloud / Supabase: keep archived V1 traces readable while allowing
-- compact, asynchronously synchronized V2 traces.
ALTER TABLE public.conversation_turn_traces
  DROP CONSTRAINT IF EXISTS conversation_turn_traces_schema_version_check;

ALTER TABLE public.conversation_turn_traces
  ADD CONSTRAINT conversation_turn_traces_schema_version_check
  CHECK (schema_version IN (1, 2));
