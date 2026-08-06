function readPositiveMilliseconds(name: string, fallback: number): number {
  const raw = import.meta.env[name];
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export const MIN_SESSION_DURATION_SECONDS = 120;
export const MAX_SESSION_DURATION_SECONDS = 1_800;
export const FALLBACK_SESSION_DURATION_SECONDS = 600;
export const SESSION_MINIMUM_CLOSURE_RATIO = 0.8;

/** Treat DB/localStorage settings as untrusted and keep them inside the admin slider contract. */
export function normalizeSessionDurationSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return FALLBACK_SESSION_DURATION_SECONDS;
  return Math.min(MAX_SESSION_DURATION_SECONDS, Math.max(MIN_SESSION_DURATION_SECONDS, Math.round(parsed)));
}

/** Preserve the Phase 2 12/15 closure ratio for any duration chosen in the admin. */
export function getSessionMinimumClosureSeconds(durationSeconds: unknown): number {
  return Math.floor(normalizeSessionDurationSeconds(durationSeconds) * SESSION_MINIMUM_CLOSURE_RATIO);
}

/**
 * User-visible response deadline. RAG may consume two seconds, so Max must keep
 * a real generation window instead of inheriting the small remainder.
 */
export const TURN_RESPONSE_DEADLINE_MS = 11_000;

/** A normal Max generation must not be mistaken for an STT/network failure. */
export const MAX_LLM_RESPONSE_DEADLINE_MS = 8_000;

/** Maximum wait before the first audio starts. It must never cap legitimate playback duration. */
export const TURN_FIRST_AUDIO_DEADLINE_MS = readPositiveMilliseconds(
  "VITE_TURN_FIRST_AUDIO_DEADLINE_MS",
  15_000,
);

/** Abort audio only when its playback clock stops progressing for this long. */
export const AUDIO_PLAYBACK_STALL_DEADLINE_MS = 15_000;

/** Recent context sent as chat messages; older exchanges live in the compressed summary. */
export const MAX_RECENT_CONVERSATION_MESSAGES = 10;

/**
 * A RAG miss is preferable to making the user wait for a stalled retrieval,
 * mais 2 000 ms coupait un tour sur trois (p90 mesuré : 2 441 ms) alors que la
 * requête Voyage était encore en vol. 3 500 ms couvre le p90 observé.
 */
export const RAG_DEGRADED_MODE_DEADLINE_MS = 3_500;

/** Nombre de chunks récupérés avant rerank : 16 poussait le RAG au-delà du délai. */
export const RAG_DEFAULT_RETRIEVE_K = 10;


/** Summary fetch is parallelized with RAG and must never dominate the live turn. */
export const SUMMARY_FETCH_DEADLINE_MS = 600;
