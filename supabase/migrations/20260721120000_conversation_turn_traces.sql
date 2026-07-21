-- Exact, admin-only causal traces for explicitly launched diagnostic sessions.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS diagnostic_trace_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.conversation_turn_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  turn_id text NOT NULL CHECK (char_length(turn_id) BETWEEN 1 AND 200),
  turn_index integer NOT NULL CHECK (turn_index > 0),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  character_name text NOT NULL DEFAULT 'Max',
  status text NOT NULL DEFAULT 'causal_complete'
    CHECK (status IN ('causal_complete', 'complete', 'error')),
  trace jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_index),
  UNIQUE (session_id, turn_id)
);

CREATE INDEX IF NOT EXISTS conversation_turn_traces_session_turn_idx
  ON public.conversation_turn_traces (session_id, turn_index);

ALTER TABLE public.conversation_turn_traces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.conversation_turn_traces FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_turn_traces TO authenticated;
GRANT ALL ON public.conversation_turn_traces TO service_role;

DROP POLICY IF EXISTS "Admin read conversation traces" ON public.conversation_turn_traces;
CREATE POLICY "Admin read conversation traces"
  ON public.conversation_turn_traces FOR SELECT TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Admin insert conversation traces" ON public.conversation_turn_traces;
CREATE POLICY "Admin insert conversation traces"
  ON public.conversation_turn_traces FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Admin update conversation traces" ON public.conversation_turn_traces;
CREATE POLICY "Admin update conversation traces"
  ON public.conversation_turn_traces FOR UPDATE TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "Admin delete conversation traces" ON public.conversation_turn_traces;
CREATE POLICY "Admin delete conversation traces"
  ON public.conversation_turn_traces FOR DELETE TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE OR REPLACE FUNCTION private.protect_diagnostic_trace_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.diagnostic_trace_enabled IS DISTINCT FROM OLD.diagnostic_trace_enabled THEN
    RAISE EXCEPTION 'diagnostic trace mode is immutable after session creation' USING ERRCODE = '42501';
  END IF;

  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.diagnostic_trace_enabled, false)
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'only admins can enable diagnostic traces' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_diagnostic_trace_flag ON public.sessions;
CREATE TRIGGER protect_diagnostic_trace_flag
  BEFORE INSERT OR UPDATE OF diagnostic_trace_enabled ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.protect_diagnostic_trace_flag();

CREATE OR REPLACE FUNCTION private.validate_conversation_turn_trace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required for diagnostic traces' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE id = NEW.session_id
      AND diagnostic_trace_enabled = true
  ) THEN
    RAISE EXCEPTION 'diagnostic trace is not enabled for this session' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.turn_id IS DISTINCT FROM OLD.turn_id
    OR NEW.turn_index IS DISTINCT FROM OLD.turn_index
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
  ) THEN
    RAISE EXCEPTION 'diagnostic trace identity is immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_conversation_turn_trace ON public.conversation_turn_traces;
CREATE TRIGGER validate_conversation_turn_trace
  BEFORE INSERT OR UPDATE ON public.conversation_turn_traces
  FOR EACH ROW EXECUTE FUNCTION private.validate_conversation_turn_trace();

CREATE OR REPLACE FUNCTION private.touch_conversation_turn_trace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_turn_traces_updated_at ON public.conversation_turn_traces;
CREATE TRIGGER update_conversation_turn_traces_updated_at
  BEFORE UPDATE ON public.conversation_turn_traces
  FOR EACH ROW EXECUTE FUNCTION private.touch_conversation_turn_trace();

-- Atomic nested patching prevents the parallel GM label and post-turn passes
-- from overwriting each other's diagnostic data.
CREATE OR REPLACE FUNCTION public.patch_conversation_turn_trace(
  p_session_id uuid,
  p_turn_index integer,
  p_path text[],
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(cardinality(p_path), 0) = 0 THEN
    RAISE EXCEPTION 'trace patch path is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.conversation_turn_traces
  SET trace = jsonb_set(trace, p_path, p_value, true)
  WHERE session_id = p_session_id
    AND turn_index = p_turn_index;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation trace not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_conversation_turn_trace(uuid, integer, text[], jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_conversation_turn_trace(uuid, integer, text[], jsonb)
  TO authenticated, service_role;
