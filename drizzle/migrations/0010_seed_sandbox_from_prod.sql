CREATE OR REPLACE FUNCTION private.seed_sandbox_from_prod(p_env text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $$
DECLARE v_cols text;
BEGIN
  IF p_env = 'prod' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.character_runtime_profiles WHERE environment_id = p_env) THEN
    SELECT string_agg(quote_ident(column_name), ',') INTO v_cols FROM information_schema.columns
    WHERE table_schema='public' AND table_name='character_runtime_profiles'
      AND column_name NOT IN ('id','environment_id','created_at','updated_at') AND is_generated='NEVER';
    EXECUTE format('INSERT INTO public.character_runtime_profiles (environment_id,%1$s) SELECT %2$L,%1$s FROM public.character_runtime_profiles WHERE environment_id=''prod''', v_cols, p_env);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.experience_orchestration_versions WHERE environment_id = p_env AND status='published') THEN
    LOCK TABLE public.experience_orchestration_versions IN SHARE ROW EXCLUSIVE MODE;
    SELECT string_agg(quote_ident(column_name), ',') INTO v_cols FROM information_schema.columns
    WHERE table_schema='public' AND table_name='experience_orchestration_versions'
      AND column_name NOT IN ('id','environment_id','created_at','updated_at','version_number') AND is_generated='NEVER';
    EXECUTE format('INSERT INTO public.experience_orchestration_versions (environment_id,version_number,%1$s) SELECT %2$L,(SELECT COALESCE(MAX(version_number),0)+1 FROM public.experience_orchestration_versions),%1$s FROM public.experience_orchestration_versions WHERE environment_id=''prod'' AND status=''published'' LIMIT 1', v_cols, p_env);
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.seed_sandbox_from_prod(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.seed_new_sandbox_environment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $$
BEGIN
  IF NEW.type = 'sandbox' THEN PERFORM private.seed_sandbox_from_prod(NEW.id); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS seed_new_sandbox_environment ON public.environments;
CREATE TRIGGER seed_new_sandbox_environment AFTER INSERT ON public.environments
FOR EACH ROW EXECUTE FUNCTION private.seed_new_sandbox_environment();

SELECT private.seed_sandbox_from_prod('sandbox-julien');