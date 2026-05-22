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

export type TTSProviderId = "elevenlabs" | "inworld" | "hume";

/** Stitching context — most providers ignore it, ElevenLabs uses it for prosody continuity. */
export interface TTSGenerateContext {
  /** Sentence played just before this one (≤ 500 chars used) */
  previousText?: string;
  /** Sentence queued after this one (≤ 500 chars used) */
  nextText?: string;
  /** Optional voice override (provider-specific id) */
  voiceId?: string;
  /** Observability context propagated to PostHog/Supabase telemetry. */
  session_id?: string | null;
  turn_id?: string | null;
  turn_index?: number | null;
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

export interface TTSProvider {
  id: TTSProviderId;
  label: string;
  description: string;
  /** Generates speech for a single text segment. Throws on error. */
  generate(text: string, ctx?: TTSGenerateContext): Promise<TTSGenerateResult>;
}
