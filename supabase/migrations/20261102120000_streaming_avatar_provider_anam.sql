-- Streaming avatar AV2 (Ulrich's decision, 2 November 2026): the provider binding accepts the
-- known providers of the multi-provider plan. Constraint only, no data touched; the Edge Function
-- still refuses providers that are not selectable yet (LemonSlice until AV3).
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_streaming_avatar_provider_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_streaming_avatar_provider_check
    CHECK (
      streaming_avatar_provider IS NULL
      OR streaming_avatar_provider IN ('heygen', 'tavus', 'anam', 'lemonslice')
    );
