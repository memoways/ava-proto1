-- Lot "socle commun" — PRODUCTION (apply only after Ulrich's explicit go).
-- Gives production the shared voice catalogue (Voice IDs per character and provider)
-- that every sandbox inherits. Only fills missing slots; never replaces an ID that
-- production already has. Inert for the game until a device profile asks for a provider.
INSERT INTO public.admin_settings (key, value, environment_id)
SELECT 'ava_tts_character_voices', src.value, 'prod'
FROM public.admin_settings src
WHERE src.environment_id = 'sandbox-ulrich' AND src.key = 'ava_tts_character_voices'
ON CONFLICT (key, environment_id) DO UPDATE
SET value = (
  SELECT COALESCE(jsonb_object_agg(c.key, c.value), '{}'::jsonb) FROM (
    SELECT k.key, COALESCE(EXCLUDED.value -> k.key, '{}'::jsonb) || COALESCE(public.admin_settings.value -> k.key, '{}'::jsonb) AS value
    FROM (SELECT jsonb_object_keys(EXCLUDED.value) AS key UNION SELECT jsonb_object_keys(public.admin_settings.value)) k
  ) c
), updated_at = now();
