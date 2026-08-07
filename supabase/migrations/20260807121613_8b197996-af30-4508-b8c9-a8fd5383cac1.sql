ALTER TABLE public.character_runtime_profiles
  DROP CONSTRAINT IF EXISTS character_runtime_profiles_character_key_check;

ALTER TABLE public.character_runtime_profiles
  ADD CONSTRAINT character_runtime_profiles_character_key_check
  CHECK (character_key IN ('max', 'emma', 'ava', 'leo'));

INSERT INTO public.character_runtime_profiles (character_key, display_name, enabled)
VALUES ('ava', 'Ava', false), ('leo', 'Léo', false)
ON CONFLICT (character_key) DO NOTHING;