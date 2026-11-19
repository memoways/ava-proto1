-- Lot "socle commun" — Romed, Benoît and Julien start from Ulrich's sandbox settings.
-- Additive and safe to replay. A sandbox keeps anything it tuned itself:
--   * a key missing from the target sandbox is copied from sandbox-ulrich;
--   * a key whose value still equals production (an untouched seed) is replaced
--     by Ulrich's value;
--   * a key that already differs from production is never overwritten.
-- Production rows are not touched here (see the separate prod migration).
INSERT INTO public.admin_settings (key, value, environment_id)
SELECT src.key, src.value, target.id
FROM public.admin_settings src
CROSS JOIN (VALUES ('sandbox-romed'), ('sandbox-benoit'), ('sandbox-julien')) AS target(id)
WHERE src.environment_id = 'sandbox-ulrich'
  AND src.key LIKE 'ava\_%'
  AND EXISTS (SELECT 1 FROM public.environments e WHERE e.id = target.id)
ON CONFLICT (key, environment_id) DO NOTHING;

UPDATE public.admin_settings dst
SET value = src.value, updated_at = now()
FROM public.admin_settings src, public.admin_settings shared
WHERE src.environment_id = 'sandbox-ulrich'
  AND dst.environment_id IN ('sandbox-romed', 'sandbox-benoit', 'sandbox-julien')
  AND dst.key = src.key
  AND shared.environment_id = 'prod' AND shared.key = src.key
  AND src.key LIKE 'ava\_%'
  AND dst.value = shared.value
  AND dst.value IS DISTINCT FROM src.value;

-- Character runtime voices (provider + Voice ID used by the game): same rule.
UPDATE public.character_runtime_profiles dst
SET tts_provider = src.tts_provider, tts_voice_id = src.tts_voice_id
FROM public.character_runtime_profiles src, public.character_runtime_profiles shared
WHERE src.environment_id = 'sandbox-ulrich'
  AND dst.environment_id IN ('sandbox-romed', 'sandbox-benoit', 'sandbox-julien')
  AND dst.character_key = src.character_key
  AND shared.environment_id = 'prod' AND shared.character_key = src.character_key
  AND dst.tts_provider IS NOT DISTINCT FROM shared.tts_provider
  AND dst.tts_voice_id IS NOT DISTINCT FROM shared.tts_voice_id;
