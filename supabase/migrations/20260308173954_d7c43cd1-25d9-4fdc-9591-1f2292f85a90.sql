
-- Settings table for persisting admin configuration (LLM, TTS, Gameplay, GM)
CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settings" ON public.admin_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.admin_settings FOR UPDATE USING (true);
