import { z } from "zod-mcp";
import { VOICE_MILESTONES } from "../../services/voiceTurnTelemetryV2";
import { latencyStats, tally } from "./stats";

const label = z.string().max(160).nullable();
const duration = z.number().finite().nonnegative().nullable();
const serviceSchema = z.object({
  service: z.enum(["stt", "llm", "tts", "rag", "gm"]),
  requested_provider: label, requested_model: label,
  resolved_provider: label, resolved_model: label,
  effective_provider: label, effective_model: label, transport: label,
  character_override: z.boolean().optional(), fallback: z.boolean().optional(), retry_count: z.number().int().nonnegative().optional(),
});
const spanSchema = z.object({
  request_id: z.string().max(160), clock: z.enum(["edge_monotonic", "client_monotonic"]),
  spans: z.array(z.object({ name: z.string().max(80), start_ms: z.number().finite().nonnegative(), end_ms: z.number().finite().nonnegative(), status: z.enum(["ok", "failed"]) })).max(32),
});
export const voiceTurnProjectionSchema = z.object({
  schema_version: z.literal(2), session_id: label, turn_id: z.string().max(160), attempt_id: z.string().max(160),
  turn_index: z.number().int().nonnegative(), character: z.string().max(80), environment_id: z.string().max(80), context_type: z.string().max(80),
  input_mode: z.enum(["push_to_talk", "hands_free", "text"]),
  latency_origin: z.enum(["ptt_release", "app_turn_decision", "transcript_final", "text_submitted"]),
  code_version: z.string().max(160), prompt_version: label, config_version: label,
  status: z.enum(["started", "completed", "interrupted", "cancelled", "timeout", "failed", "no_audio"]), clock: z.literal("client_monotonic"),
  milestones: z.object(Object.fromEntries(VOICE_MILESTONES.map((name) => [name, z.number().finite().nullable()]))),
  services: z.array(serviceSchema).max(16), server: z.array(spanSchema).max(8),
  durations: z.object({ origin_to_response_ms: duration, origin_to_output_estimated_ms: duration, t_turn_voice_ready_ms: duration, generation_total_ms: duration, playback_ms: duration }),
  coverage: z.object({ state: z.enum(["complete", "partial"]), observed: z.number().int().nonnegative(), expected: z.number().int().nonnegative(), missing: z.array(z.enum(VOICE_MILESTONES)).max(VOICE_MILESTONES.length) }),
  output_precision: z.enum(["software_estimate", "unavailable"]), critical_wait: z.literal("coverage_incomplete"), budget_exceeded: z.array(z.string().max(80)).max(16),
});
export type VoiceTurnProjection = z.infer<typeof voiceTurnProjectionSchema>;
export interface VoiceEventRow { id: string; created_at: string; event_name: string; metadata_json: unknown }
export function projectVoiceEvents(rows: VoiceEventRow[]) {
  const events = rows.flatMap((row) => {
    const parsed = voiceTurnProjectionSchema.safeParse(row.metadata_json);
    return parsed.success ? [{ id: row.id, created_at: row.created_at, event_name: row.event_name, turn: parsed.data }] : [];
  });
  // GM is a separate availability observation, never another turn in the denominator.
  const attempts = new Map<string, VoiceTurnProjection>();
  for (const event of events) {
    if (event.event_name === "voice_turn_gm") continue;
    const key = event.turn.attempt_id;
    const previous = attempts.get(key);
    if (!previous || previous.status === "started") attempts.set(key, event.turn);
  }
  const turns = [...attempts.values()];
  return {
    events, invalidRows: rows.length - events.length,
    summary: {
      byOrigin: Object.fromEntries([...new Set(turns.map((turn) => turn.latency_origin))].map((origin) => {
        const cohort = turns.filter((turn) => turn.latency_origin === origin);
        return [origin, { attempts: cohort.length, outputEstimatedMs: latencyStats(cohort.map((turn) => turn.durations.origin_to_output_estimated_ms)) }];
      })),
      attempts: turns.length, statuses: tally(turns, (turn) => turn.status),
      coverage: tally(turns, (turn) => turn.coverage.state),
      originToResponseMs: latencyStats(turns.map((turn) => turn.durations.origin_to_response_ms)),
      originToOutputEstimatedMs: latencyStats(turns.map((turn) => turn.durations.origin_to_output_estimated_ms)),
      voiceEndToOutputEstimatedMs: latencyStats(turns.map((turn) => turn.durations.t_turn_voice_ready_ms)),
      generationTotalMs: latencyStats(turns.map((turn) => turn.durations.generation_total_ms)),
      playbackMs: latencyStats(turns.map((turn) => turn.durations.playback_ms)),
      gmObservations: events.filter((event) => event.event_name === "voice_turn_gm").length,
    },
  };
}

const countsSchema = z.record(z.string(), z.number().int().nonnegative());
export const latencyStatsSchema = z.object({ count: z.number().int().nonnegative(), min: duration, mean: duration, p50: duration, p90: duration, p95: duration, max: duration });
export const voiceTurnPageSchema = z.object({
  events: z.array(z.object({ id: z.string(), created_at: z.string(), event_name: z.enum(["voice_turn_started", "voice_turn_finished", "voice_turn_gm"]), turn: voiceTurnProjectionSchema })).max(300),
  invalidRows: z.number().int().nonnegative(),
  summary: z.object({
    byOrigin: z.record(z.string(), z.object({ attempts: z.number().int().nonnegative(), outputEstimatedMs: latencyStatsSchema })),
    attempts: z.number().int().nonnegative(), statuses: countsSchema, coverage: countsSchema,
    originToResponseMs: latencyStatsSchema, originToOutputEstimatedMs: latencyStatsSchema, voiceEndToOutputEstimatedMs: latencyStatsSchema,
    generationTotalMs: latencyStatsSchema, playbackMs: latencyStatsSchema, gmObservations: z.number().int().nonnegative(),
  }),
  page: z.object({ offset: z.number().int().nonnegative(), limit: z.number().int().nonnegative(), nextOffset: z.number().int().nullable(), cappedAt: z.literal(3000), capped: z.boolean() }),
  window: z.object({ from: z.string(), to: z.string() }), summaryScope: z.literal("returned_page_not_full_cohort"),
  percentileMethod: z.literal("linear_interpolation_(n-1)*p_rounded_ms"), source: z.literal("voice_turn_events"), schemaVersion: z.literal(2),
});
