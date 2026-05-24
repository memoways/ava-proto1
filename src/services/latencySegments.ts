import type { ConversationPipelineTimings } from "@/types";

export type LatencySegmentKey =
  | "stt_ms"
  | "rag_ms"
  | "gm_pre_ms"
  | "max_ms"
  | "validator_ms"
  | "tts_ms"
  | "gm_post_ms"
  | "total_ms";

export interface LatencySegmentContext {
  sessionId?: string | null;
  sessionLabel?: string | null;
  sessionStartedAt?: string | null;
  turnIndex?: number | null;
  correlationId?: string | null;
  scenarioId?: string | null;
  avatarId?: string | null;
  language?: string | null;
  blocked?: boolean;
  blockageReason?: string | null;
}

export interface LatencyServiceInfo {
  serviceProvider?: string;
  serviceName?: string;
  model?: string;
  mode?: string;
  endpointType?: string;
}

export interface LatencySegment extends LatencyServiceInfo {
  key: LatencySegmentKey;
  label: string;
  durationMs: number;
  context?: LatencySegmentContext;
}

export interface SegmentServiceStats {
  segmentKey: LatencySegmentKey;
  segmentLabel: string;
  serviceProvider: string;
  serviceName: string;
  model: string;
  mode: string;
  count: number;
  p50: number;
  p95: number;
  avg: number;
  max: number;
  blockageCount: number;
  blockageRate: number;
  outliers: Array<LatencySegment & { aboveP95: boolean }>;
}

export interface SegmentServiceEvolutionPoint {
  sessionId: string;
  sessionLabel: string;
  sessionStartedAt: string;
  segmentKey: LatencySegmentKey;
  segmentLabel: string;
  serviceKey: string;
  serviceLabel: string;
  serviceProvider: string;
  serviceName: string;
  model: string;
  minMs: number;
  medianMs: number;
  maxMs: number;
  count: number;
}

export const LATENCY_SEGMENT_LABELS: Record<LatencySegmentKey, string> = {
  stt_ms: "STT",
  rag_ms: "RAG",
  gm_pre_ms: "GM pre-turn",
  max_ms: "Max LLM",
  validator_ms: "Validateur",
  tts_ms: "TTS",
  gm_post_ms: "GM post-turn",
  total_ms: "Total",
};

const PIPELINE_KEYS: LatencySegmentKey[] = [
  "rag_ms",
  "gm_pre_ms",
  "max_ms",
  "validator_ms",
  "tts_ms",
  "gm_post_ms",
];

export function percentile(values: number[], p: number): number {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  if (xs.length === 1) return xs[0];
  const clamped = Math.min(1, Math.max(0, p));
  const idx = (xs.length - 1) * clamped;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
}

export function buildLatencySegmentsFromPipeline(input: {
  sessionId?: string | null;
  sessionLabel?: string | null;
  sessionStartedAt?: string | null;
  turnIndex?: number | null;
  correlationId?: string | null;
  scenarioId?: string | null;
  avatarId?: string | null;
  language?: string | null;
  pipeline: ConversationPipelineTimings;
  services?: Partial<Record<LatencySegmentKey, LatencyServiceInfo>>;
  defaultServices?: Partial<Record<LatencySegmentKey, LatencyServiceInfo>>;
}): LatencySegment[] {
  const contextBase: LatencySegmentContext = {
    sessionId: input.sessionId,
    sessionLabel: input.sessionLabel,
    sessionStartedAt: input.sessionStartedAt,
    turnIndex: input.turnIndex,
    correlationId: input.correlationId,
    scenarioId: input.scenarioId,
    avatarId: input.avatarId,
    language: input.language,
  };

  return PIPELINE_KEYS.flatMap((key) => {
    const durationMs = input.pipeline[key];
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) return [];
    const blocked = input.pipeline.blocker === key;
    const service = resolveLatencyServiceInfo(input.defaultServices?.[key], input.services?.[key]);
    return [{
      key,
      label: LATENCY_SEGMENT_LABELS[key],
      durationMs,
      serviceProvider: service.serviceProvider || "Unknown",
      serviceName: service.serviceName || service.serviceProvider || "Unknown",
      model: service.model || "Unknown",
      mode: service.mode,
      endpointType: service.endpointType,
      context: {
        ...contextBase,
        blocked,
        blockageReason: blocked ? key : undefined,
      },
    }];
  });
}

export function resolveLatencyServiceInfo(
  fallback: LatencyServiceInfo | undefined,
  explicit: LatencyServiceInfo | undefined,
): LatencyServiceInfo {
  return {
    serviceProvider: preferKnown(explicit?.serviceProvider, fallback?.serviceProvider),
    serviceName: preferKnown(explicit?.serviceName, fallback?.serviceName),
    model: preferKnown(explicit?.model, fallback?.model),
    mode: preferKnown(explicit?.mode, fallback?.mode),
    endpointType: preferKnown(explicit?.endpointType, fallback?.endpointType),
  };
}

function preferKnown(primary?: string, fallback?: string) {
  if (primary && primary !== "Unknown") return primary;
  if (fallback && fallback !== "Unknown") return fallback;
  return primary || fallback;
}

export function computeSegmentServiceStats(segments: LatencySegment[]): SegmentServiceStats[] {
  const groups = new Map<string, LatencySegment[]>();
  for (const segment of segments) {
    const provider = segment.serviceProvider || "Unknown";
    const serviceName = segment.serviceName || provider || "Unknown";
    const model = segment.model || "Unknown";
    const mode = segment.mode || "";
    const id = [segment.key, provider, serviceName, model, mode].join("\u0001");
    groups.set(id, [...(groups.get(id) ?? []), segment]);
  }

  return [...groups.values()]
    .map((items) => {
      const first = items[0];
      const durations = items.map((s) => s.durationMs);
      const p95 = percentile(durations, 0.95);
      const blockageCount = items.filter((s) => s.context?.blocked).length;
      return {
        segmentKey: first.key,
        segmentLabel: first.label,
        serviceProvider: first.serviceProvider || "Unknown",
        serviceName: first.serviceName || first.serviceProvider || "Unknown",
        model: first.model || "Unknown",
        mode: first.mode || "",
        count: items.length,
        p50: percentile(durations, 0.5),
        p95,
        avg: durations.reduce((sum, v) => sum + v, 0) / durations.length,
        max: Math.max(...durations),
        blockageCount,
        blockageRate: items.length > 0 ? blockageCount / items.length : 0,
        outliers: [...items]
          .sort((a, b) => b.durationMs - a.durationMs)
          .slice(0, 5)
          .map((s) => ({ ...s, aboveP95: s.durationMs > p95 })),
      };
    })
    .sort((a, b) => a.segmentLabel.localeCompare(b.segmentLabel) || b.p50 - a.p50);
}

export function serviceKeyForSegment(segment: Pick<LatencySegment, "serviceProvider" | "serviceName" | "model" | "mode">): string {
  return [
    segment.serviceProvider || "Unknown",
    segment.serviceName || segment.serviceProvider || "Unknown",
    segment.model || "Unknown",
    segment.mode || "",
  ].join("\u0001");
}

export function serviceLabelForSegment(segment: Pick<LatencySegment, "serviceProvider" | "serviceName" | "model">): string {
  const provider = segment.serviceProvider || segment.serviceName || "Unknown";
  const model = segment.model || "Unknown";
  return model === "Unknown" ? provider : `${provider} · ${model}`;
}

export function computeSegmentServiceEvolution(segments: LatencySegment[]): SegmentServiceEvolutionPoint[] {
  const groups = new Map<string, LatencySegment[]>();
  for (const segment of segments) {
    const sessionId = segment.context?.sessionId || "unknown-session";
    const serviceKey = serviceKeyForSegment(segment);
    const id = [segment.key, serviceKey, sessionId].join("\u0002");
    groups.set(id, [...(groups.get(id) ?? []), segment]);
  }

  return [...groups.values()]
    .map((items) => {
      const first = items[0];
      const durations = items.map((s) => s.durationMs);
      const sessionId = first.context?.sessionId || "unknown-session";
      return {
        sessionId,
        sessionLabel: first.context?.sessionLabel || sessionId.slice(0, 8),
        sessionStartedAt: first.context?.sessionStartedAt || "",
        segmentKey: first.key,
        segmentLabel: first.label,
        serviceKey: serviceKeyForSegment(first),
        serviceLabel: serviceLabelForSegment(first),
        serviceProvider: first.serviceProvider || "Unknown",
        serviceName: first.serviceName || first.serviceProvider || "Unknown",
        model: first.model || "Unknown",
        minMs: Math.min(...durations),
        medianMs: percentile(durations, 0.5),
        maxMs: Math.max(...durations),
        count: items.length,
      };
    })
    .sort((a, b) => {
      const at = a.sessionStartedAt ? new Date(a.sessionStartedAt).getTime() : 0;
      const bt = b.sessionStartedAt ? new Date(b.sessionStartedAt).getTime() : 0;
      return at - bt || a.sessionLabel.localeCompare(b.sessionLabel) || a.serviceLabel.localeCompare(b.serviceLabel);
    });
}
