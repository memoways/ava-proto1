-- Enable pgvector extension
create extension if not exists vector;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Gameplay steps table (created first because video_triggers references it)
create table public.gameplay_steps (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  name text not null,
  step_order integer,
  type text not null check (type in ('intro', 'conversation', 'interlude', 'mid_conversation', 'gate', 'game_over')),
  trigger_condition text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Characters table
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  name text not null,
  system_prompt text,
  backstory text,
  personality text,
  branch text default 'male',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Storyworld table
create table public.storyworld (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  title text not null,
  content text,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Video triggers table
create table public.video_triggers (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  title text not null,
  type text not null check (type in ('intro', 'interlude', 'mid_conversation')),
  themes text[] default '{}',
  video_url text,
  placeholder_text text,
  priority integer default 1,
  transition_style text default 'fade_black',
  post_video_context text,
  gameplay_step_id uuid references public.gameplay_steps(id),
  duration_seconds integer default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rules table
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique,
  title text not null,
  content text,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions table
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  ended_at timestamptz,
  branch text default 'male',
  trust_level integer default 0,
  triggers_activated text[] default '{}',
  game_over_reason text,
  conversation_log jsonb default '[]',
  questionnaire_responses jsonb,
  duration_seconds integer
);

-- Embeddings table (pgvector)
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for similarity search
create index on public.embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Function for similarity search
create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  source_table text,
  source_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    source_table,
    source_id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Enable RLS on all tables
ALTER TABLE public.gameplay_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyworld ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- RLS: Read-only public access for narrative content (no auth needed for prototype)
CREATE POLICY "Public read access" ON public.gameplay_steps FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.storyworld FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.video_triggers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.embeddings FOR SELECT USING (true);

-- Sessions: anyone can create and read (no auth in prototype)
CREATE POLICY "Anyone can create sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can update sessions" ON public.sessions FOR UPDATE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_gameplay_steps_updated_at BEFORE UPDATE ON public.gameplay_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_storyworld_updated_at BEFORE UPDATE ON public.storyworld FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_triggers_updated_at BEFORE UPDATE ON public.video_triggers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();