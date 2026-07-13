const MINUTE_SECONDS = 60;

function readPositiveMinutes(name: string, fallback: number): number {
  const raw = import.meta.env[name];
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readPositiveMilliseconds(name: string, fallback: number): number {
  const raw = import.meta.env[name];
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

/** Public test target. Can be shortened in preview/E2E without changing the flow. */
export const SESSION_DURATION_SECONDS = Math.round(
  readPositiveMinutes("VITE_SESSION_DURATION_MINUTES", 15) * MINUTE_SECONDS,
);

/** The GM may suggest a natural ending only after this point. Explicit hang-up remains available. */
export const SESSION_MINIMUM_CLOSURE_SECONDS = Math.min(
  SESSION_DURATION_SECONDS,
  Math.round(readPositiveMinutes("VITE_SESSION_MINIMUM_CLOSURE_MINUTES", 12) * MINUTE_SECONDS),
);

/** User-visible response deadline. RAG/LLM must fail soft before this budget expires. */
export const TURN_RESPONSE_DEADLINE_MS = 5_000;

/** Maximum wait before the first audio starts. It must never cap legitimate playback duration. */
export const TURN_FIRST_AUDIO_DEADLINE_MS = readPositiveMilliseconds(
  "VITE_TURN_FIRST_AUDIO_DEADLINE_MS",
  15_000,
);

/** Abort audio only when its playback clock stops progressing for this long. */
export const AUDIO_PLAYBACK_STALL_DEADLINE_MS = 15_000;

/** Recent context sent as chat messages; older exchanges live in the compressed summary. */
export const MAX_RECENT_CONVERSATION_MESSAGES = 10;

/** A RAG miss is preferable to making the user wait for a stalled retrieval. */
export const RAG_DEGRADED_MODE_DEADLINE_MS = 2_000;

/** Summary fetch is parallelized with RAG and must never dominate the live turn. */
export const SUMMARY_FETCH_DEADLINE_MS = 600;
