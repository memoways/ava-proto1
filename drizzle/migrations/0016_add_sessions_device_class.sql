-- Screen adaptation, lot 1: record the player's device class on each session.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS device_class text,
  ADD COLUMN IF NOT EXISTS device_info jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_device_class_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_device_class_check
      CHECK (device_class IS NULL OR device_class IN ('smartphone', 'tablet', 'desktop'));
  END IF;
END
$$;

COMMENT ON COLUMN public.sessions.device_class IS
  'Device class frozen at session start: smartphone, tablet or desktop (src/services/deviceClass.ts).';
COMMENT ON COLUMN public.sessions.device_info IS
  'Technical device snapshot (viewport, screen sides, pixel ratio, orientation, pointer, touch). No user agent or address.';