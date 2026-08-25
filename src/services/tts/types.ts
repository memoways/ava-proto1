/**
 * Multi-provider TTS abstraction.
 *
 * Each provider implements `generate(text, ctx)` and returns a Blob + meta.
 * The façade in `src/services/tts/index.ts` routes calls based on the active provider
 * stored in admin settings (key: `tts_active_provider`).
 *
 * Adding a new provider:
 *   1. Create src/services/tts/providers/<name>.ts implementing TTSProvider
 *   2. Register it in src/services/tts/registry.ts
 *   3. Add a settings panel in TTSConfigTab (or rely on the generic schema renderer)
 *   4. Optionally add a proxy edge function under supabase/functions/proxy-tts-<name>/
 */

export type TTSProviderId = "elevenlabs" | "inworld" | "hume" | "gradium";

/** Stitching context — most providers ignore it, ElevenLabs uses it for prosody continuity. */
export interface TTSGenerateContext {
  /** Sentence played just before this one (≤ 500 chars used) */
  previousText?: string;
  /** Sentence queued after this one (≤ 500 chars used) */
  nextText?: string;
  /** Optional voice override (provider-specific id) */
  voiceId?: string;
  /** Active character key (max, emma, …) so providers can apply per-character tuning. */
  characterKey?: string;
  /** Observability context propagated to PostHog/Supabase telemetry. */
  session_id?: string | null;
  turn_id?: string | null;
  turn_index?: number | null;
  /** Cancels provider generation when the owning conversation turn becomes stale. */
  signal?: AbortSignal;
}

export interface TTSGenerateResult {
  blob: Blob;
  meta: {
    provider: TTSProviderId;
    model?: string;
    statusCode?: number;
    firstByteMs?: number;
    totalMs?: number;
  };
}

/** Generation stats reported by a streaming playback handle (for telemetry). */
export interface TTSStreamGenerationStats {
  provider: TTSProviderId;
  model?: string;
  /** "websocket" when audio streamed live, "rest_fallback" when the blob path took over. */
  transport: "websocket" | "rest_fallback";
  statusCode?: number;
  /** Time to first audio chunk (ms since handle creation). */
  firstByteMs?: number;
  /** Time until all audio was generated/received (ms since handle creation). */
  totalMs?: number;
}

/**
 * Progressive playback of one text segment. Generation starts immediately on
 * creation and buffers behind a closed gate; audio only becomes audible after
 * `open()` — this is how TTSQueue keeps sentences strictly sequential while
 * still generating ahead.
 */
export interface TTSStreamPlaybackHandle {
  /** Opens the playback gate: buffered + future audio gets scheduled from here on. */
  open(): void;
  /** Resolves when audio is audible (requires open()). Rejects on failure before that. */
  started: Promise<void>;
  /** Resolves when playback of all audio has finished. Rejects on error/abort. */
  finished: Promise<{ playbackTotalMs: number }>;
  /** Resolves when generation completed (all audio received/buffered) — before or
   *  after playback ends. Used by TTSQueue to release its concurrency slot. */
  generationDone: Promise<TTSStreamGenerationStats>;
  /** Stops generation and playback immediately. Idempotent. */
  cancel(reason?: unknown): void;
}

export interface TTSProvider {
  id: TTSProviderId;
  label: string;
  description: string;
  /** Generates speech for a single text segment. Throws on error. */
  generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult>;
  /**
   * Optional streaming capability (progressive playback). Returns null when
   * streaming is disabled/unsupported — callers then use `generate()`.
   * Providers without this member always use the blob path.
   */
  createStreamingPlayback?(text: string, ctx?: TTSGenerateContext): TTSStreamPlaybackHandle | null;
}

/** Structured provider failure used for bounded retry decisions. */
export interface TTSProviderRequestError extends Error {
  statusCode?: number;
  providerErrorType?: string;
  providerErrorCode?: string;
  retryCount?: number;
}
