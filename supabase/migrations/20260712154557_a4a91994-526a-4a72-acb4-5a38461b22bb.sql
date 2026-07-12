
-- 1) Move has_role SECURITY DEFINER helper out of the exposed public schema.
--    Policies keep working because they reference the function by OID.
CREATE SCHEMA IF NOT EXISTS private;
-- Grant USAGE so RLS-triggered function resolution works for callers.
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Move the function to the private (non-API-exposed) schema.
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;

-- Lock down direct EXECUTE — RLS still works because Postgres resolves the
-- function via the stored OID inside policies; but the API cannot invoke it.
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2) embeddings: remove permissive DELETE policy applied to public role.
--    service_role bypasses RLS anyway, so no replacement is needed for
--    server-side sync/wipe flows (which use the service role key).
DROP POLICY IF EXISTS "Service role can delete embeddings" ON public.embeddings;

-- 3) admin_settings: remove the ava_% read policy for authenticated users.
--    Anonymous game clients keep read access to ava_% runtime keys.
--    Admins keep full read access via the has_role admin policy.
DROP POLICY IF EXISTS "Admin read all settings" ON public.admin_settings;
CREATE POLICY "Admin read all settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
