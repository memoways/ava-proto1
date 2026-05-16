/**
 * Latency telemetry — capture du temps de chaque étape du pipeline conversationnel
 * et envoi vers PostHog + persistance Supabase (table turn_latencies / audio_latencies).
 *
 * Garde-fous régression :
 *  - Toutes les fonctions sont fire-and-forget. JAMAIS d'`await` côté hot path.
 *  - Toute exception interne est silenced (warn console au pire).
 *  - Les inserts Supabase sont lancés sans `await` et catch().
 *  - Désactivable via `disableTelemetry()` (toggle global, ex. en cas de bug).
 */

import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/services/posthogService";

let enabled = true;

export function disableTelemetry() { enabled = false; }
export function enableTelemetry() { enabled = true; }
export function isTelemetryEnabled() { return enabled; }

export interface TurnLatencyRecord {
  session_id?: string;
  turn_index?: number;
  character?: string;
  voice_modality?: "voice" | "text" | "mixed";
  user_message_len?: number;
  max_response_len?: number;
  t_rag_rewrite_ms?: number;
  t_rag_query_ms?: number;
  t_rag_total_ms?: number;
  t_knowledge_build_ms?: number;
  t_gm_pre_ms?: number;
  t_max_llm_ms?: number;
  t_max_first_token_ms?: number;
  t_validator_ms?: number;
  t_gm_post_ms?: number;
  t_turn_total_ms?: number;
  rag_matches_count?: number;
  rag_top_similarity?: number;
  max_model?: string;
  gm_model?: string;
  validator_model?: string;
  usage_total_tokens?: number;
  had_fallback?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AudioLatencyRecord {
  session_id?: string;
  turn_index?: number;
  direction: "in" | "out";
  t_stt_ms?: number;
  t_tts_first_byte_ms?: number;
  t_tts_total_ms?: number;
  t_audio_playback_ms?: number;
  stt_text_len?: number;
  tts_text_len?: number;
  metadata?: Record<string, unknown>;
}

function safe<T>(fn: () => T): T | undefined {
  try { return fn(); } catch (err) { console.warn("[latencyTelemetry]", err); return undefined; }
}

/**
 * Crée un timer de tour qui collecte les sous-mesures puis émet l'événement.
 * À appeler en entrée de `processConversationTurn`. Les setters sont no-op safe.
 */
export function createTurnTimer(initial?: Partial<TurnLatencyRecord>) {
  const record: TurnLatencyRecord = { ...initial };
  const t0 = performance.now();
  let emitted = false;

  return {
    set(patch: Partial<TurnLatencyRecord>) {
      Object.assign(record, patch);
    },
    mergeMetadata(extra: Record<string, unknown>) {
      record.metadata = { ...(record.metadata || {}), ...extra };
    },
    /** Émet l'événement (PostHog + insert DB). Idempotent. */
    emit(finalPatch?: Partial<TurnLatencyRecord>) {
      if (emitted || !enabled) return;
      emitted = true;
      if (finalPatch) Object.assign(record, finalPatch);
      if (record.t_turn_total_ms == null) {
        record.t_turn_total_ms = Math.round(performance.now() - t0);
      }
      safe(() => trackEvent("turn_latency", record as unknown as Record<string, unknown>));
      safe(() => {
        void supabase.from("turn_latencies" as never).insert(record as never).then(({ error }) => {
          if (error) console.warn("[latencyTelemetry] insert turn_latencies", error.message);
        });
      });
    },
    elapsed() { return Math.round(performance.now() - t0); },
  };
}

export type TurnTimer = ReturnType<typeof createTurnTimer>;

/** Enregistre une mesure audio (STT entrante ou TTS sortante). Fire-and-forget. */
export function recordAudioLatency(record: AudioLatencyRecord) {
  if (!enabled) return;
  safe(() => trackEvent("audio_latency", record as unknown as Record<string, unknown>));
  safe(() => {
    void supabase.from("audio_latencies" as never).insert(record as never).then(({ error }) => {
      if (error) console.warn("[latencyTelemetry] insert audio_latencies", error.message);
    });
  });
}
