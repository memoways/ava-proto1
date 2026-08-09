import { supabase } from "@/integrations/supabase/client";

export type PosthogPeriod = "24h" | "7d" | "30d" | "custom";

export interface PercentileMetric {
  p50: number | null;
  p95: number | null;
  measured: number;
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
  turnIds: string[];
}

export interface InternalLatencyComparison {
  source: "Supabase interne";
  turnCount: number;
  sessionCount: number;
  p50FirstSoundMs: number | null;
  p95FirstSoundMs: number | null;
  p50ResponseReadyMs: number | null;
  p95ResponseReadyMs: number | null;
  persistenceRate: number | null;
  missingInInternal: number;
  onlyInternal: number;
  costPerSessionUsd: number | null;
}

interface TurnLatencyRow {
  session_id: string | null;
  t_turn_total_ms: number | null;
  t_max_first_token_ms: number | null;
  metadata_json: {
    turn_id?: string;
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
};

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export async function loadPosthogLatencyStats(input: {
  period: PosthogPeriod;
  from?: string;
  to?: string;
  filters?: Record<string, string>;
}): Promise<PosthogLatencyStats> {
  const { data, error } = await supabase.functions.invoke("posthog-latency-stats", { body: input });
  if (error) throw new Error(error.message);
  if (!data || data.source !== "PostHog") throw new Error(data?.error || "Réponse PostHog invalide");
  return data as PosthogLatencyStats;
}

export async function loadInternalLatencyComparison(posthog: PosthogLatencyStats): Promise<InternalLatencyComparison> {
  const [voiceResult, usageResult, audioResult, traceResult] = await Promise.all([
    supabase.from("turn_latencies" as never).select("session_id, t_turn_total_ms, t_max_first_token_ms, metadata_json").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("llm_usage" as never).select("session_id, cost_usd").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("audio_latencies" as never).select("session_id, tts_text_len, metadata_json").eq("direction", "out").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
    supabase.from("conversation_turn_traces" as never).select("turn_id").gte("created_at", posthog.period.from).lt("created_at", posthog.period.to),
  ]);
  const queryError = voiceResult.error ?? usageResult.error ?? audioResult.error ?? traceResult.error;
  if (queryError) throw queryError;
  const voice = (voiceResult.data ?? []) as unknown as TurnLatencyRow[];
  const usage = (usageResult.data ?? []) as unknown as UsageRow[];
  const audio = (audioResult.data ?? []) as unknown as AudioRow[];
  const traces = (traceResult.data ?? []) as unknown as TraceRow[];
  const internalIds = new Set(
    [...voice.map((row) => row.metadata_json?.turn_id), ...traces.map((row) => row.turn_id)].filter((value): value is string => Boolean(value)),
  );
  const posthogIds = new Set(posthog.turnIds);
  const persisted = [...posthogIds].filter((id) => internalIds.has(id)).length;
  const missingInInternal = [...posthogIds].filter((id) => !internalIds.has(id)).length;
  const onlyInternal = [...internalIds].filter((id) => !posthogIds.has(id)).length;
  const sessions = new Set(voice.map((row) => row.session_id).filter(Boolean));
  const responseReady = voice.map((row) => row.metadata_json?.t_turn_response_ready_ms ?? row.t_turn_total_ms).filter((value): value is number => typeof value === "number");
  const firstSound = voice.map((row) => row.metadata_json?.t_turn_voice_ready_ms ?? row.t_max_first_token_ms).filter((value): value is number => typeof value === "number");

  const llmCost = usage.reduce((sum, row) => sum + (Number(row.cost_usd) || 0), 0);
  const voiceCost = audio.reduce((sum, row) => {
    const provider = row.metadata_json?.provider?.toLowerCase() ?? "";
    return sum + ((row.tts_text_len ?? 0) / 1000) * (VOICE_COST_PER_1K[provider] ?? 0);
  }, 0);
  const costSessions = new Set([
    ...usage.map((row) => row.session_id),
    ...audio.map((row) => row.session_id),
  ].filter((value): value is string => Boolean(value)));
  return {
    source: "Supabase interne",
    turnCount: voice.length,
    sessionCount: sessions.size,
    p50FirstSoundMs: percentile(firstSound, 50),
    p95FirstSoundMs: percentile(firstSound, 95),
    p50ResponseReadyMs: percentile(responseReady, 50),
    p95ResponseReadyMs: percentile(responseReady, 95),
    persistenceRate: posthogIds.size ? persisted / posthogIds.size : null,
    missingInInternal,
    onlyInternal,
    costPerSessionUsd: costSessions.size ? (llmCost + voiceCost) / costSessions.size : null,
  };
}
