ALTER TABLE public.external_test_invitations
  DROP CONSTRAINT IF EXISTS external_test_invitations_check1;
ALTER TABLE public.external_test_invitations
  ADD CONSTRAINT external_test_invitations_redemption_binding_check CHECK (
    (redeemed_at IS NULL AND redeemed_by_user_id IS NULL)
    OR (redeemed_at IS NOT NULL AND (multi_use OR redeemed_by_user_id IS NOT NULL))
  );

ALTER TABLE public.external_test_access_grants
  DROP CONSTRAINT IF EXISTS external_test_access_grants_invitation_id_key;
CREATE INDEX IF NOT EXISTS external_test_access_grants_invitation_id_idx
  ON public.external_test_access_grants (invitation_id);

CREATE OR REPLACE FUNCTION private.current_external_test_access()
 RETURNS TABLE(invitation_id uuid, environment_id text, created_by_user_id uuid, tester_label text, creator_display_name text, access_expires_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT
    invitation.id,
    invitation.environment_id,
    invitation.created_by_user_id,
    invitation.tester_label,
    creator.display_name,
    access_grant.expires_at
  FROM public.external_test_access_grants access_grant
  JOIN public.external_test_invitations invitation
    ON invitation.id = access_grant.invitation_id
  JOIN public.admin_users creator
    ON creator.user_id = invitation.created_by_user_id
  WHERE access_grant.anonymous_user_id = auth.uid()
    AND access_grant.expires_at > now()
    AND (invitation.multi_use OR invitation.redeemed_by_user_id = auth.uid())
    AND invitation.redeemed_at IS NOT NULL
    AND invitation.revoked_at IS NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false)
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION private.current_external_test_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_external_test_access() TO authenticated, service_role;
