-- Lot K1: optional editorial field « Ce que tu sais aujourd'hui » (Notion, base Caractères).
-- Additive, nullable, no policy change: character_prompts keeps its existing RLS.
-- Empty until Romed and Ulrich create and fill the Notion property; sync-notion
-- writes it only when that property exists.
ALTER TABLE public.character_prompts
  ADD COLUMN IF NOT EXISTS ce_que_tu_sais_aujourdhui text;

COMMENT ON COLUMN public.character_prompts.ce_que_tu_sais_aujourdhui IS
  'Optional Notion field « Ce que tu sais aujourd''hui »: established facts at call time, protected in the optimized_v3 core (src/services/establishedFacts.ts).';
