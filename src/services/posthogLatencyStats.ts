import { supabase } from "@/integrations/supabase/client";

export type PosthogPeriod = "24h" | "7d" | "30d" | "custom";

export interface PercentileMetric {
  p50: number | null;
  p95: number | null;
  measured: number;
}

export interface PosthogTimelinePoint {
  timestamp: string;
  turns: number;
  responseReadyP50: number | null;
  responseReadyP95: number | null;
  firstSoundP50: number | null;
  firstSoundP95: number | null;
  endToEndP50: number | null;
  endToEndP95: number | null;
}

export interface PosthogSlowTurn {
  turnId: string | null;
  sessionId: string | null;
  timestamp: string;
  turnIndex: number | null;
  character: string | null;
  model: string | null;
  stt: string | null;
  tts: string | null;
  browser: string | null;
  responseReadyMs: number | null;
  firstSoundMs: number | null;
  endToEndMs: number | null;
  sttMs: number | null;
  ragMs: number | null;
  maxMs: number | null;
  ttsMs: number | null;
  blocker: string | null;
  severity: string | null;
  fallback: boolean;
}

export interface PosthogLatencyStats {
  source: "PostHog";
  hasData: boolean;
  freshAt: string;
  period: { key: PosthogPeriod; from: string; to: string };
  dashboardUrl: string;
  totals: {
    sessions: number;
    turns: number;
    errors: number;
    errorRate: number | null;
    fallbacks: number;
    fallbackRate: number | null;
  };
  latency: Record<"responseReady" | "firstSound" | "endToEnd" | "stt" | "rag" | "max" | "tts" | "gmPost", PercentileMetric>;
  blockers: Array<{ key: string; count: number }>;
  providers: Record<"models" | "stt" | "tts" | "browsers" | "characters", Array<{ key: string; count: number }>>;
  actions: {
    cinematics: { recommended: number; played: number; skipped: number };
    handoffs: { proposed: number; accepted: number; refused: number; executed: number; blocked: number };
  };
  timeline: PosthogTimelinePoint[];
  slowestTurns: PosthogSlowTurn[];
  turnIds: string[];
}

export interface InternalLatencyComparison {
  source: "AVA interne";
  turnCount: number;
  sessionCount: number;
  measuredFirstSound: number;
  unmeasuredFirstSound: number;
  firstSoundCoverageRate: number | null;
  errorCount: number;
  errorRate: number | null;
  p50FirstSoundMs: number | null;
  p95FirstSoundMs: number | null;
  p50ResponseReadyMs: number | null;
  p95ResponseReadyMs: number | null;
  persistenceRate: number | null;
  missingInInternal: number;
  onlyInternal: number;
  costPerSessionUsd: number | null;
  providers: PosthogLatencyStats["providers"];
}

interface TurnLatencyRow {
  session_id: string | null;
  metadata_json: {
    turn_id?: string;
  } | null;
}

export interface VoiceEventRow {
  session_id: string | null;
  turn_id: string | null;
  context_type: string | null;
  severity?: string | null;
  metadata_json: {
    character?: string;
    max_model?: string;
    stt_provider?: string;
    tts_provider?: string;
    browser_family?: string;
    first_sound_status?: "measured" | "failed" | "not_measured";
    had_error?: boolean;
    t_turn_voice_ready_ms?: number;
    t_turn_response_ready_ms?: number;
  } | null;
}

interface TraceRow { turn_id: string | null }


interface UsageRow { session_id: string | null; cost_usd: number | string | null }
interface AudioRow { session_id: string | null; tts_text_len: number | null; metadata_json: { provider?: string } | null }

const VOICE_COST_PER_1K: Record<string, number> = {
  elevenlabs: 0.30,
  hume: 0.20,
  inworld: 0.005,
  gradium: 0.15,
  cartesia: 0.15,
};

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function countDimension(values: Array<string | null | undefined>): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export async function loadPosthogLatencyStats(input: {
  period: PosthogPeriod;
  from?: string;
  to?: string;
  filters?: Record<string, string>;
  include_sandbox?: boolean;
}): Promise<PosthogLatencyStats> {
  const { data, error } = await supabase.functions.invoke("posthog-latency-stats", { body: input });
  if (error) throw new Error(error.message);
  if (!data || data.source !== "PostHog") throw new Error(data?.error || "Réponse PostHog invalide");
  return data as PosthogLatencyStats;
}

export async function loadInternalLatencyComparison(
  posthog: Pick<PosthogLatencyStats, "period" | "turnIds">,
  options: { filters?: Record<string, string>; includeSandbox?: boolean } = {},
): Promise<InternalLatencyComparison> {
  const [voiceResult, legacyTurnResult, usageResult, audioResult, traceResult] = await Promise.all([
    supabase.from("voice_turn_events" as never).select("session_id, turn_id, context_type, severity, metadata_json").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("turn_latencies" as never).select("session_id, metadata_json").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("llm_usage" as never).select("session_id, cost_usd").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("audio_latencies" as never).select("session_id, tts_text_len, metadata_json").eq("direction", "out").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("conversation_turn_traces" as never).select("turn_id").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
  ]);
  // La mesure voix AVA est la source principale. Les tables historiques,
  // coûts et traces enrichissent la comparaison mais ne doivent pas rendre la
  // mesure interne indisponible si l'une d'elles manque ou échoue.
  if (voiceResult.error) throw voiceResult.error;
  const allVoice = (voiceResult.data ?? []) as unknown as VoiceEventRow[];
  const legacyTurns = (legacyTurnResult.error ? [] : legacyTurnResult.data ?? []) as unknown as TurnLatencyRow[];
  const usage = (usageResult.error ? [] : usageResult.data ?? []) as unknown as UsageRow[];
  const audio = (audioResult.error ? [] : audioResult.data ?? []) as unknown as AudioRow[];
  const traces = (traceResult.error ? [] : traceResult.data ?? []) as unknown as TraceRow[];
  const voiceInEnvironment = allVoice.filter((row) => options.includeSandbox || row.context_type !== "sandbox");
  const providers: PosthogLatencyStats["providers"] = {
    characters: countDimension(voiceInEnvironment.map((row) => row.metadata_json?.character)),
    models: countDimension(voiceInEnvironment.map((row) => row.metadata_json?.max_model)),
    stt: countDimension(voiceInEnvironment.map((row) => row.metadata_json?.stt_provider)),
    tts: countDimension(voiceInEnvironment.map((row) => row.metadata_json?.tts_provider)),
    browsers: countDimension(voiceInEnvironment.map((row) => row.metadata_json?.browser_family)),
  };
  const voice = voiceInEnvironment.filter((row) => {
    const metadata = row.metadata_json ?? {};
    const dimensions: Record<string, string | undefined> = {
      character: metadata.character,
      model: metadata.max_model,
      stt: metadata.stt_provider,
      tts: metadata.tts_provider,
      browser: metadata.browser_family,
    };
    return Object.entries(options.filters ?? {}).every(([key, expected]) => !expected || dimensions[key] === expected);
  });
  const voiceIds = voice.map((row) => row.turn_id).filter((value): value is string => Boolean(value));
  const selectedSessions = new Set(voice.map((row) => row.session_id).filter((value): value is string => Boolean(value)));
  const internalIds = new Set([
    ...voiceIds,
    ...legacyTurns
      .filter((row) => posthog.turnIds.includes(row.metadata_json?.turn_id ?? ""))
      .map((row) => row.metadata_json?.turn_id),
    ...traces
      .filter((row) => posthog.turnIds.includes(row.turn_id ?? ""))
      .map((row) => row.turn_id),
  ].filter((value): value is string => Boolean(value)));
  const posthogIds = new Set(posthog.turnIds);
  const persisted = [...posthogIds].filter((id) => internalIds.has(id)).length;
  const missingInInternal = [...posthogIds].filter((id) => !internalIds.has(id)).length;
  const onlyInternal = [...internalIds].filter((id) => !posthogIds.has(id)).length;
  const sessions = new Set(voice.map((row) => row.session_id).filter(Boolean));
  const metrics = summarizeInternalVoiceMetrics(voice);
  const errorCount = voice.filter((row) => row.severity === "failed" || row.metadata_json?.had_error === true).length;

  const hasFilters = Object.values(options.filters ?? {}).some(Boolean);
  const scopedUsage = selectedSessions.size
    ? usage.filter((row) => row.session_id && selectedSessions.has(row.session_id))
    : hasFilters ? [] : usage;
  const scopedAudio = selectedSessions.size
    ? audio.filter((row) => row.session_id && selectedSessions.has(row.session_id))
    : hasFilters ? [] : audio;
  const scopedLlmCost = scopedUsage.reduce((sum, row) => sum + (Number(row.cost_usd) || 0), 0);
  const scopedVoiceCost = scopedAudio.reduce((sum, row) => {
    const provider = row.metadata_json?.provider?.toLowerCase() ?? "";
    return sum + ((row.tts_text_len ?? 0) / 1000) * (VOICE_COST_PER_1K[provider] ?? 0);
  }, 0);
  const costSessions = new Set([
    ...scopedUsage.map((row) => row.session_id),
    ...scopedAudio.map((row) => row.session_id),
  ].filter((value): value is string => Boolean(value)));
  return {
    source: "AVA interne",
    turnCount: voice.length,
    sessionCount: sessions.size,
    measuredFirstSound: metrics.firstSound.length,
    unmeasuredFirstSound: voice.length - metrics.firstSound.length,
    firstSoundCoverageRate: voice.length ? metrics.firstSound.length / voice.length : null,
    errorCount,
    errorRate: voice.length ? errorCount / voice.length : null,
    p50FirstSoundMs: percentile(metrics.firstSound, 50),
    p95FirstSoundMs: percentile(metrics.firstSound, 95),
    p50ResponseReadyMs: percentile(metrics.responseReady, 50),
    p95ResponseReadyMs: percentile(metrics.responseReady, 95),
    persistenceRate: posthogIds.size ? persisted / posthogIds.size : null,
    missingInInternal,
    onlyInternal,
    costPerSessionUsd: costSessions.size ? (scopedLlmCost + scopedVoiceCost) / costSessions.size : null,
    providers,
  };
}

export function summarizeInternalVoiceMetrics(rows: VoiceEventRow[]): {
  firstSound: number[];
  responseReady: number[];
} {
  return {
    firstSound: rows
      .filter((row) => row.metadata_json?.first_sound_status === "measured")
      .map((row) => row.metadata_json?.t_turn_voice_ready_ms)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
    responseReady: rows
      .map((row) => row.metadata_json?.t_turn_response_ready_ms)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0),
  };
}
