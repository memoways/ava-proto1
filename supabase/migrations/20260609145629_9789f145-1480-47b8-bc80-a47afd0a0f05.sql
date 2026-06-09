
CREATE TABLE IF NOT EXISTS public.character_prompts (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  identite_fondamentale text NOT NULL DEFAULT '',
  qui_tu_es text NOT NULL DEFAULT '',
  ce_que_tu_ne_fais_jamais text NOT NULL DEFAULT '',
  ce_que_tu_sais_utilisateur text NOT NULL DEFAULT '',
  dynamique_conversation text NOT NULL DEFAULT '',
  sujets_sensibles text NOT NULL DEFAULT '',
  profondeur_par_niveau text NOT NULL DEFAULT '',
  situation_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_prompts TO authenticated;
GRANT SELECT ON public.character_prompts TO anon;
GRANT ALL ON public.character_prompts TO service_role;

ALTER TABLE public.character_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "character_prompts_read_all"
  ON public.character_prompts FOR SELECT
  USING (true);

CREATE POLICY "character_prompts_service_write"
  ON public.character_prompts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_character_prompts_updated_at
  BEFORE UPDATE ON public.character_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
