// Read-only analytics over AVA internal voice turns (voice_turn_events,
// event "voice_turn_completed"). Nothing here writes or changes telemetry:
// it only reshapes rows already persisted by recordVoiceTurnCompleted.

export type LatencyStageKey =
  | "stt"
  | "rag"
  | "llm"
  | "tts"
  | "video"
  | "playback"
  | "responseReady"
  | "firstSound"
  | "endToEnd";

export type LatencyDimensionKey = "stt" | "model" | "tts" | "video" | "character" | "browser" | "device";

export interface LatencySample {
  createdAt: string;
  stt: string | null;
  model: string | null;
  tts: string | null;
  video: string | null;
  character: string | null;
  browser: string | null;
  /** Device class (smartphone, tablet, desktop); absent on turns recorded before lot 1. */
  device?: string | null;
  values: Partial<Record<LatencyStageKey, number>>;
}

export interface StageStats {
  p50: number | null;
  p95: number | null;
  mean: number | null;
  count: number;
}

export const LATENCY_STAGES: Array<{
  key: LatencyStageKey;
  label: string;
  /** Dimension that names the service measured by this stage. */
  service: LatencyDimensionKey | null;
  /** Stages that add up to the wait before the character speaks. */
  pipeline: boolean;
}> = [
  { key: "stt", label: "STT", service: "stt", pipeline: true },
  { key: "rag", label: "RAG", service: null, pipeline: true },
  { key: "llm", label: "LLM personnage", service: "model", pipeline: true },
  { key: "tts", label: "TTS", service: "tts", pipeline: true },
  { key: "video", label: "Vidéo", service: "video", pipeline: true },
  { key: "responseReady", label: "Texte prêt", service: null, pipeline: false },
  { key: "firstSound", label: "Premier son", service: null, pipeline: false },
  { key: "endToEnd", label: "End-to-end", service: null, pipeline: false },
  { key: "playback", label: "Lecture audio", service: null, pipeline: false },
];

export const LATENCY_DIMENSIONS: Array<{ key: LatencyDimensionKey; label: string }> = [
  { key: "stt", label: "Service STT" },
  { key: "model", label: "Modèle LLM" },
  { key: "tts", label: "Service TTS" },
  { key: "video", label: "Service vidéo" },
  { key: "character", label: "Personnage" },
  { key: "browser", label: "Navigateur" },
  { key: "device", label: "Appareil" },
];

interface RawVoiceRow {
  created_at?: string | null;
  event_name?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function label(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Projects a V1 voice_turn_completed row; V2 rows (other event names) are skipped. */
export function toLatencySample(row: RawVoiceRow): LatencySample | null {
  if (row.event_name && row.event_name !== "voice_turn_completed") return null;
  const metadata = row.metadata_json ?? {};
  if (!row.created_at || !Number.isFinite(Date.parse(row.created_at))) return null;
  const voiceReady = metadata.first_sound_status === "measured" ? positive(metadata.t_turn_voice_ready_ms) : undefined;
  const values: LatencySample["values"] = {
    stt: positive(metadata.t_stt_total_ms),
    rag: positive(metadata.t_rag_total_ms),
    llm: positive(metadata.t_max_llm_ms),
    tts: positive(metadata.t_tts_total_ms),
    video: positive(metadata.t_video_wait_ms),
    playback: positive(metadata.t_audio_playback_total_ms),
    responseReady: positive(metadata.t_turn_response_ready_ms),
    firstSound: voiceReady,
    endToEnd: positive(metadata.t_turn_end_to_end_ms),
  };
  return {
    createdAt: row.created_at,
    stt: label(metadata.stt_provider),
    model: label(metadata.max_model),
    tts: label(metadata.tts_provider),
    video: label(metadata.video_provider),
    character: label(metadata.character),
    browser: label(metadata.browser_family),
    device: label(metadata.device_class),
    values,
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export function stageStats(values: number[]): StageStats {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    count: sorted.length,
  };
}

function valuesOf(samples: LatencySample[], stage: LatencyStageKey): number[] {
  return samples.map((sample) => sample.values[stage]).filter((value): value is number => value != null);
}

const HOUR = 3_600_000;
const BUCKETS = [
  { ms: HOUR, label: "par heure" },
  { ms: 3 * HOUR, label: "par 3 heures" },
  { ms: 6 * HOUR, label: "par 6 heures" },
  { ms: 12 * HOUR, label: "par 12 heures" },
  { ms: 24 * HOUR, label: "par jour" },
  { ms: 7 * 24 * HOUR, label: "par semaine" },
];

/** Smallest bucket that keeps the time axis at 48 points or fewer. */
export function pickBucket(from: string, to: string): { ms: number; label: string } {
  const span = Math.max(HOUR, Date.parse(to) - Date.parse(from));
  return BUCKETS.find((bucket) => span / bucket.ms <= 48) ?? BUCKETS[BUCKETS.length - 1];
}

export interface TimelineBucket {
  start: number;
  turns: number;
  stages: Record<LatencyStageKey, StageStats>;
}

function bucketize(samples: LatencySample[], from: string, to: string, bucketMs: number): Array<{ start: number; samples: LatencySample[] }> {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const count = Math.max(1, Math.ceil((end - start) / bucketMs));
  const buckets = Array.from({ length: count }, (_, index) => ({ start: start + index * bucketMs, samples: [] as LatencySample[] }));
  for (const sample of samples) {
    const index = Math.floor((Date.parse(sample.createdAt) - start) / bucketMs);
    if (index >= 0 && index < count) buckets[index].samples.push(sample);
  }
  return buckets;
}

export function buildStageTimeline(samples: LatencySample[], from: string, to: string, bucketMs: number): TimelineBucket[] {
  return bucketize(samples, from, to, bucketMs).map((bucket) => ({
    start: bucket.start,
    turns: bucket.samples.length,
    stages: Object.fromEntries(LATENCY_STAGES.map((stage) => [stage.key, stageStats(valuesOf(bucket.samples, stage.key))])) as Record<LatencyStageKey, StageStats>,
  }));
}

export function summarizeStages(samples: LatencySample[]): Record<LatencyStageKey, StageStats> {
  return Object.fromEntries(LATENCY_STAGES.map((stage) => [stage.key, stageStats(valuesOf(samples, stage.key))])) as Record<LatencyStageKey, StageStats>;
}

/**
 * Median of the most recent half of the period against the older half.
 * Returns null when either half has no measurement: no invented trend.
 */
export function halfPeriodTrend(samples: LatencySample[], stage: LatencyStageKey, from: string, to: string): { before: number | null; after: number | null; deltaRate: number | null } {
  const middle = (Date.parse(from) + Date.parse(to)) / 2;
  const before = stageStats(valuesOf(samples.filter((sample) => Date.parse(sample.createdAt) < middle), stage)).p50;
  const after = stageStats(valuesOf(samples.filter((sample) => Date.parse(sample.createdAt) >= middle), stage)).p50;
  return { before, after, deltaRate: before && after != null ? (after - before) / before : null };
}

export const OTHER_SERVICE = "Autres";

export interface ServiceStats extends StageStats {
  key: string;
}

/** Latency of one stage grouped by service; turns without the stage are ignored. */
export function compareServices(samples: LatencySample[], stage: LatencyStageKey, dimension: LatencyDimensionKey): ServiceStats[] {
  const groups = new Map<string, number[]>();
  for (const sample of samples) {
    const value = sample.values[stage];
    if (value == null) continue;
    const key = sample[dimension] ?? "non renseigné";
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return [...groups.entries()]
    .map(([key, values]) => ({ key, ...stageStats(values) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

/** Services kept as their own line; the rest fold into "Autres". */
export function topServices(services: ServiceStats[], limit = 5): string[] {
  return services.slice(0, limit).map((service) => service.key);
}

export function buildServiceTimeline(
  samples: LatencySample[],
  stage: LatencyStageKey,
  dimension: LatencyDimensionKey,
  kept: string[],
  from: string,
  to: string,
  bucketMs: number,
): Array<{ start: number; values: Record<string, StageStats> }> {
  const keptSet = new Set(kept);
  return bucketize(samples, from, to, bucketMs).map((bucket) => {
    const groups = new Map<string, number[]>();
    for (const sample of bucket.samples) {
      const value = sample.values[stage];
      if (value == null) continue;
      const raw = sample[dimension] ?? "non renseigné";
      const key = keptSet.has(raw) ? raw : OTHER_SERVICE;
      groups.set(key, [...(groups.get(key) ?? []), value]);
    }
    return { start: bucket.start, values: Object.fromEntries([...groups.entries()].map(([key, values]) => [key, stageStats(values)])) };
  });
}

/** Share of turns carrying each measurement, to make gaps visible. */
export function stageCoverage(samples: LatencySample[]): Record<LatencyStageKey, number | null> {
  return Object.fromEntries(LATENCY_STAGES.map((stage) => [
    stage.key,
    samples.length ? valuesOf(samples, stage.key).length / samples.length : null,
  ])) as Record<LatencyStageKey, number | null>;
}
