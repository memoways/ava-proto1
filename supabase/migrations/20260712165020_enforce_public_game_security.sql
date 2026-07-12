-- Phase 1 contract step. Apply only after:
--   1. Anonymous Sign-Ins are enabled in Supabase Auth;
--   2. the frontend is deployed with VITE_GAME_SECURITY_ENABLED=true;
--   3. authenticated session creation has passed the smoke test.
--
-- The preceding expand migration deliberately keeps these legacy policies so
-- the Lovable deployment can be rolled out without interrupting active tests.

DROP POLICY IF EXISTS "Anon insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anon update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anon update recent sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can update recent sessions" ON public.sessions;

REVOKE ALL ON public.sessions FROM anon;
