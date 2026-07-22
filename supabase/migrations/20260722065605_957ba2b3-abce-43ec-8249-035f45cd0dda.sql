
-- Migration 1: rag_lab_pinned_questions
CREATE TABLE IF NOT EXISTS public.rag_lab_pinned_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  message_index integer NOT NULL CHECK (message_index >= 0),
  question text NOT NULL CHECK (char_length(btrim(question)) BETWEEN 1 AND 600),
  character_name text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, message_index)
);
CREATE INDEX IF NOT EXISTS rag_lab_pinned_questions_created_at_idx
  ON public.rag_lab_pinned_questions (created_at DESC);
ALTER TABLE public.rag_lab_pinned_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rag_lab_pinned_questions FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.rag_lab_pinned_questions TO authenticated;
GRANT ALL ON public.rag_lab_pinned_questions TO service_role;
DROP POLICY IF EXISTS "Admin read RAG lab pinned questions" ON public.rag_lab_pinned_questions;
CREATE POLICY "Admin read RAG lab pinned questions"
  ON public.rag_lab_pinned_questions FOR SELECT TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
DROP POLICY IF EXISTS "Admin insert RAG lab pinned questions" ON public.rag_lab_pinned_questions;
CREATE POLICY "Admin insert RAG lab pinned questions"
  ON public.rag_lab_pinned_questions FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));
DROP POLICY IF EXISTS "Admin delete RAG lab pinned questions" ON public.rag_lab_pinned_questions;
CREATE POLICY "Admin delete RAG lab pinned questions"
  ON public.rag_lab_pinned_questions FOR DELETE TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

-- Migration 2: rag_lab_question_corpus_cache
CREATE TABLE IF NOT EXISTS public.rag_lab_question_corpus_cache (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_question_count integer NOT NULL DEFAULT 0 CHECK (source_question_count >= 0),
  excluded_question_count integer NOT NULL DEFAULT 0 CHECK (excluded_question_count >= 0),
  user_turn_count integer NOT NULL DEFAULT 0 CHECK (user_turn_count >= 0),
  unique_question_count integer NOT NULL DEFAULT 0 CHECK (unique_question_count >= 0),
  session_count integer NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  source_revision bigint NOT NULL DEFAULT 0,
  built_revision bigint NOT NULL DEFAULT -1,
  status text NOT NULL DEFAULT 'stale' CHECK (status IN ('stale', 'refreshing', 'ready', 'error')),
  generation_model text,
  generated_at timestamptz,
  refresh_started_at timestamptz,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.rag_lab_question_corpus_cache (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.rag_lab_question_corpus_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rag_lab_question_corpus_cache FROM PUBLIC, anon;
GRANT SELECT ON public.rag_lab_question_corpus_cache TO authenticated;
GRANT ALL ON public.rag_lab_question_corpus_cache TO service_role;
DROP POLICY IF EXISTS "Admin read RAG lab question corpus" ON public.rag_lab_question_corpus_cache;
CREATE POLICY "Admin read RAG lab question corpus"
  ON public.rag_lab_question_corpus_cache FOR SELECT TO authenticated
  USING ((SELECT private.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

CREATE OR REPLACE FUNCTION private.mark_rag_lab_question_corpus_stale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.rag_lab_question_corpus_cache
     SET source_revision = source_revision + 1,
         status = CASE WHEN status = 'refreshing' THEN status ELSE 'stale' END,
         updated_at = now()
   WHERE id = true;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.mark_rag_lab_question_corpus_stale() FROM PUBLIC;

DROP TRIGGER IF EXISTS mark_rag_lab_corpus_stale_from_sessions ON public.sessions;
CREATE TRIGGER mark_rag_lab_corpus_stale_from_sessions
AFTER INSERT OR DELETE OR UPDATE OF conversation_log, personnage_appele
ON public.sessions FOR EACH STATEMENT
EXECUTE FUNCTION private.mark_rag_lab_question_corpus_stale();

DROP TRIGGER IF EXISTS mark_rag_lab_corpus_stale_from_pins ON public.rag_lab_pinned_questions;
CREATE TRIGGER mark_rag_lab_corpus_stale_from_pins
AFTER INSERT OR UPDATE OR DELETE
ON public.rag_lab_pinned_questions FOR EACH STATEMENT
EXECUTE FUNCTION private.mark_rag_lab_question_corpus_stale();
