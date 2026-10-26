INSERT INTO public.environments (id, label, type) VALUES ('sandbox-julien', 'Julien', 'sandbox')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type;

CREATE OR REPLACE FUNCTION private.enroll_ava_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_display_name text;
  v_environment_id text;
BEGIN
  SELECT mapping.display_name, mapping.environment_id
  INTO v_display_name, v_environment_id
  FROM (VALUES
    ('info@memoways.com', 'Production', 'prod'),
    ('ulrich.fischer@memoways.com', 'Ulrich', 'sandbox-ulrich'),
    ('romed@paradigmafilms.ch', 'Romed', 'sandbox-romed'),
    ('benoitperrincreate@gmail.com', 'Benoît', 'sandbox-benoit'),
    ('julien.reichel@bluewin.ch', 'Julien', 'sandbox-julien')
  ) AS mapping(email, display_name, environment_id)
  WHERE mapping.email = lower(NEW.email);

  IF v_environment_id IS NOT NULL THEN
    INSERT INTO public.admin_users (user_id, display_name, default_environment_id)
    VALUES (NEW.id, v_display_name, v_environment_id)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      default_environment_id = EXCLUDED.default_environment_id;
    IF to_regclass('public.user_roles') IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enroll_ava_admin_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.admin_users (user_id, display_name, default_environment_id)
SELECT id, 'Julien', 'sandbox-julien' FROM auth.users WHERE lower(email) = 'julien.reichel@bluewin.ch'
ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, default_environment_id = EXCLUDED.default_environment_id;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'julien.reichel@bluewin.ch'
ON CONFLICT (user_id, role) DO NOTHING;