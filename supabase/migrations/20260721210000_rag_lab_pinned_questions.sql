-- Admin-curated conversation questions surfaced in the RAG laboratory.

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
