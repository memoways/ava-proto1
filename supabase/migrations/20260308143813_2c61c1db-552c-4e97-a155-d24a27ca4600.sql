
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Public read access" ON public.characters;
DROP POLICY IF EXISTS "Service role can insert characters" ON public.characters;
DROP POLICY IF EXISTS "Service role can update characters" ON public.characters;

CREATE POLICY "Anyone can read characters"
ON public.characters FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert characters"
ON public.characters FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update characters"
ON public.characters FOR UPDATE
TO anon, authenticated
USING (true);
