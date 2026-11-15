ALTER TABLE public.character_prompts
  ADD COLUMN IF NOT EXISTS ce_que_tu_sais_aujourdhui text;

COMMENT ON COLUMN public.character_prompts.ce_que_tu_sais_aujourdhui IS
  'Champ Notion optionnel « Ce que tu sais aujourd''hui » : faits établis au moment de l''appel.';