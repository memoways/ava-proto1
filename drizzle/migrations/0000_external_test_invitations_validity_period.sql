ALTER TABLE public.external_test_invitations ADD COLUMN IF NOT EXISTS valid_from timestamptz NOT NULL DEFAULT now();
UPDATE public.external_test_invitations SET valid_from = created_at WHERE valid_from > created_at;

CREATE OR REPLACE FUNCTION public.redeem_external_test_invitation(p_invitation_id uuid, p_code_hash text, p_anonymous_user_id uuid)
 RETURNS TABLE(invitation_id uuid, environment_id text, tester_label text, creator_display_name text, access_expires_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_invitation public.external_test_invitations%ROWTYPE;
  v_creator_display_name text;
  v_access_expires_at timestamptz;
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_anonymous_user_id AND COALESCE(is_anonymous, false)) THEN RETURN; END IF;

  SELECT * INTO v_invitation FROM public.external_test_invitations WHERE id = p_invitation_id FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.valid_from > clock_timestamp()
     OR v_invitation.expires_at <= clock_timestamp()
     OR v_invitation.code_hash <> p_code_hash
     OR (v_invitation.redeemed_by_user_id IS NOT NULL AND v_invitation.redeemed_by_user_id <> p_anonymous_user_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.external_test_access_grants g
    WHERE g.anonymous_user_id = p_anonymous_user_id AND g.invitation_id <> v_invitation.id AND g.expires_at > clock_timestamp()
  ) THEN RETURN; END IF;

  IF v_invitation.redeemed_by_user_id IS NULL THEN
    UPDATE public.external_test_invitations
    SET redeemed_at = clock_timestamp(), redeemed_by_user_id = p_anonymous_user_id
    WHERE id = v_invitation.id RETURNING * INTO v_invitation;
  END IF;

  -- Access lasts until the end of the validity period chosen by the admin.
  v_access_expires_at := v_invitation.expires_at;

  INSERT INTO public.external_test_access_grants (anonymous_user_id, invitation_id, created_at, expires_at)
  VALUES (p_anonymous_user_id, v_invitation.id, v_invitation.redeemed_at, v_access_expires_at)
  ON CONFLICT (anonymous_user_id) DO UPDATE SET
    invitation_id = EXCLUDED.invitation_id, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at;

  SELECT display_name INTO v_creator_display_name FROM public.admin_users WHERE user_id = v_invitation.created_by_user_id;

  RETURN QUERY SELECT v_invitation.id, v_invitation.environment_id, v_invitation.tester_label, v_creator_display_name, v_access_expires_at;
END;
$function$;
REVOKE ALL ON FUNCTION public.redeem_external_test_invitation(uuid, text, uuid) FROM PUBLIC, anon, authenticated;