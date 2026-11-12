DROP POLICY IF EXISTS "Anon insert session_summaries" ON public.session_summaries;
DROP POLICY IF EXISTS "Public read character_prompts" ON public.character_prompts;
DROP POLICY IF EXISTS "Public read access" ON public.gameplay_steps;
CREATE POLICY "Admins read gameplay_steps" ON public.gameplay_steps FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR (SELECT private.is_admin_member((SELECT auth.uid()))));
DROP POLICY IF EXISTS "Public read access" ON public.embeddings;
CREATE POLICY "Admins read embeddings" ON public.embeddings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));