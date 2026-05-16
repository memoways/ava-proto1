
CREATE TABLE public.turn_latencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID,
  turn_index INTEGER,
  character TEXT,
  voice_modality TEXT,
  user_message_len INTEGER,
  max_response_len INTEGER,
  t_rag_rewrite_ms INTEGER,
  t_rag_query_ms INTEGER,
  t_rag_total_ms INTEGER,
  t_knowledge_build_ms INTEGER,
  t_gm_pre_ms INTEGER,
  t_max_llm_ms INTEGER,
  t_max_first_token_ms INTEGER,
  t_validator_ms INTEGER,
  t_gm_post_ms INTEGER,
  t_turn_total_ms INTEGER,
  rag_matches_count INTEGER,
  rag_top_similarity NUMERIC,
  max_model TEXT,
  gm_model TEXT,
  validator_model TEXT,
  usage_total_tokens INTEGER,
  had_fallback BOOLEAN DEFAULT false,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_turn_latencies_session ON public.turn_latencies(session_id);
CREATE INDEX idx_turn_latencies_created ON public.turn_latencies(created_at DESC);

ALTER TABLE public.turn_latencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert turn latencies" ON public.turn_latencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read turn latencies" ON public.turn_latencies FOR SELECT USING (true);

CREATE TABLE public.audio_latencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id UUID,
  turn_index INTEGER,
  direction TEXT NOT NULL,
  t_stt_ms INTEGER,
  t_tts_first_byte_ms INTEGER,
  t_tts_total_ms INTEGER,
  t_audio_playback_ms INTEGER,
  stt_text_len INTEGER,
  tts_text_len INTEGER,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audio_latencies_session ON public.audio_latencies(session_id);
CREATE INDEX idx_audio_latencies_created ON public.audio_latencies(created_at DESC);

ALTER TABLE public.audio_latencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert audio latencies" ON public.audio_latencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read audio latencies" ON public.audio_latencies FOR SELECT USING (true);
