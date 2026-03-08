
-- Add name and admin_note columns to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS admin_note text;

-- Allow deleting sessions
CREATE POLICY "Anyone can delete sessions" ON public.sessions FOR DELETE USING (true);
