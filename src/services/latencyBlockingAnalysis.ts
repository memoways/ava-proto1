import type { ConversationMessage, ConversationPipelineTimings, PRD4PostTurnEvaluation } from "@/types";
import { assignPipelineLatency, getPipelineServiceLatency, getPlayerWaitLatencyTotal, percentile, PLAYER_WAIT_SEGMENT_KEYS, type LatencySegmentKey } from "./latencySegments";
import { messageCharacter } from "./sessionCharacters";

export const STEP_BUDGET_MS: Record<NumericTimingKey, number> = {
  stt_ms: 900, rag_ms: 250, gm_pre_ms: 400, max_ms: 800, validator_ms: 300,
  tts_ms: 600, gm_post_ms: 200, total_ms: 2000,
};
const STEP_LABELS = [...PLAYER_WAIT_SEGMENT_KEYS, "gm_post_ms" as const].map(key => ({ key }));
const serviceLatency = getPipelineServiceLatency;
const serviceLatencyTotal = getPlayerWaitLatencyTotal;

/** Different clock origins are not comparable samples of the same wait. */
export function observedWaitStats(turns: ConversationPipelineTimings[]) {
  const byOrigin = new Map<string, number[]>();
  for (const turn of turns) {
    if (!turn.latency_origin || turn.latency_origin === "legacy_service_sum" || turn.first_sound_status !== "measured") continue;
    const wait = serviceLatencyTotal(turn);
    if (wait <= 0) continue;
    const values = byOrigin.get(turn.latency_origin) ?? [];
    values.push(wait);
    byOrigin.set(turn.latency_origin, values);
  }
  return [...byOrigin].map(([origin, values]) => ({ origin, count: values.length,
    p50: percentile(values, 0.5), p95: percentile(values, 0.95) }));
}

/** A budget exceedance, not proof that a service blocked playback. */
export function serviceBlocker(values: ConversationPipelineTimings): string | null {
  let worst: { key: LatencySegmentKey; ratio: number } | null = null;
  for (const key of PLAYER_WAIT_SEGMENT_KEYS) {
    const ratio = (serviceLatency(values, key) ?? 0) / STEP_BUDGET_MS[key];
    if (ratio > 1 && (!worst || ratio > worst.ratio)) worst = { key, ratio };
  }
  return worst?.key ?? null;
}

export interface SessionRow {
  id: string;
  name: string | null;
  started_at: string | null;
  ended_at: string | null;
  conversation_log: ConversationMessage[] | null;
  game_over_reason: string | null;
  context_type: string;
  environment_id: string | null;
  duration_seconds: number | null;
  tester_label: string | null;
  test_invitation_id: string | null;
  personnage_appele?: string | null;
  active_character: string | null;
  gm_post_turn_log: PRD4PostTurnEvaluation[] | null;
}

export interface TurnTiming extends ConversationPipelineTimings {
  index: number;
  sessionId: string;
  timestamp: number;
  preview: string;
  character: string;
  gmPostStatus: NonNullable<ConversationPipelineTimings["gm_post_status"]>;
}

export interface SessionAggregate {
  session: SessionRow;
  turnCount: number;
  avg: ConversationPipelineTimings;
  max: ConversationPipelineTimings;
  blockerCount: number;
  topBlocker: string | null;
  lastBlocker: { step: string | null; turnIndex: number; preview: string } | null;
  turns: TurnTiming[];
}

export type NumericTimingKey = "stt_ms" | "rag_ms" | "gm_pre_ms" | "max_ms" | "validator_ms" | "tts_ms" | "gm_post_ms" | "total_ms";

export function aggregateLatencySession(session: SessionRow, characterFilter: string = "all"): SessionAggregate {
  const log = Array.isArray(session.conversation_log) ? session.conversation_log : [];
  const gmLog = Array.isArray(session.gm_post_turn_log) ? session.gm_post_turn_log : [];
  const turns: TurnTiming[] = [];
  let turnIndex = 0;
  log.forEach((msg) => {
    if (msg.role === "user") {
      turnIndex += 1;
      return;
    }
    if (!msg.pipeline || turnIndex === 0) return;
    const character = messageCharacter(msg);
    if (!character) return;
    if (characterFilter !== "all" && character !== characterFilter) return;
    const gmEntry = [...gmLog].reverse().find((entry) =>
      entry.turn_index === turnIndex && entry.character_key === character,
    );
    const gmStatus = gmEntry?.execution_status ?? (gmEntry ? "executed" : "not_measured");
    turns.push({
      ...msg.pipeline,
      ...(typeof gmEntry?.latency_ms === "number" && gmEntry.latency_ms > 0
        ? { gm_post_ms: gmEntry.latency_ms }
        : {}),
      gm_post_status: gmStatus,
      index: turnIndex,
      sessionId: session.id,
      timestamp: msg.timestamp,
      preview: msg.content.slice(0, 80),
      character,
      gmPostStatus: gmStatus,
    });
  });

  for (const turn of turns) turn.blocker = serviceBlocker(turn);

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const maxes: Record<string, number> = {};
  const blockerCounter: Record<string, number> = {};
  let blockerCount = 0;
  let lastBlocker: SessionAggregate["lastBlocker"] = null;

  for (const t of turns) {
    for (const { key } of STEP_LABELS) {
      const v = serviceLatency(t, key);
      if (typeof v === "number" && v > 0) {
        sums[key] = (sums[key] ?? 0) + v;
        counts[key] = (counts[key] ?? 0) + 1;
        maxes[key] = Math.max(maxes[key] ?? 0, v);
      }
    }
    const tot = serviceLatencyTotal(t);
    if (tot > 0) {
      sums["total_ms"] = (sums["total_ms"] ?? 0) + tot;
      counts["total_ms"] = (counts["total_ms"] ?? 0) + 1;
      maxes["total_ms"] = Math.max(maxes["total_ms"] ?? 0, tot);
    }
    const blocker = serviceBlocker(t);
    if (blocker) {
      blockerCount++;
      blockerCounter[blocker] = (blockerCounter[blocker] ?? 0) + 1;
      lastBlocker = { step: blocker, turnIndex: t.index, preview: t.preview };
    }
  }

  const avg: ConversationPipelineTimings = { latency_origin: "legacy_service_sum", first_sound_status: "not_measured" };
  const max: ConversationPipelineTimings = { latency_origin: "legacy_service_sum", first_sound_status: "not_measured" };
  for (const key of Object.keys(sums)) {
    assignPipelineLatency(avg, key as LatencySegmentKey, sums[key] / counts[key]);
    assignPipelineLatency(max, key as LatencySegmentKey, maxes[key]);
  }

  if (avg.total_ms) delete avg.first_sound_status;
  if (max.total_ms) delete max.first_sound_status;

  const topBlocker = Object.entries(blockerCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    session,
    turnCount: turns.length,
    avg,
    max,
    blockerCount,
    topBlocker,
    lastBlocker,
    turns,
  };
}

export interface ComparisonAggregate {
  turnCount: number;
  sessionCount: number;
  avg: ConversationPipelineTimings;
  max: ConversationPipelineTimings;
  turns: TurnTiming[];
  blockerCount: number;
  topBlocker: string | null;
}

export function aggregateLatencySessions(aggs: SessionAggregate[]): ComparisonAggregate | null {
  const allTurns = aggs.flatMap((a) => a.turns);
  if (!allTurns.length) return null;
  const sums: Record<string, { sum: number; count: number; max: number }> = {};
  let blockers = 0;
  const blockerCounter: Record<string, number> = {};
  const allKeys: NumericTimingKey[] = [...STEP_LABELS.map((s) => s.key), "total_ms"];
  for (const t of allTurns) {
    for (const key of allKeys) {
      const v = key === "total_ms" ? serviceLatencyTotal(t) : serviceLatency(t, key);
      if (typeof v === "number" && v > 0) {
        sums[key] ??= { sum: 0, count: 0, max: 0 };
        sums[key].sum += v;
        sums[key].count++;
        sums[key].max = Math.max(sums[key].max, v);
      }
    }
    const blocker = serviceBlocker(t);
    if (blocker) {
      blockers++;
      blockerCounter[blocker] = (blockerCounter[blocker] ?? 0) + 1;
    }
  }
  const avg: ConversationPipelineTimings = { latency_origin: "legacy_service_sum", first_sound_status: "not_measured" };
  const max: ConversationPipelineTimings = { latency_origin: "legacy_service_sum", first_sound_status: "not_measured" };
  for (const k of Object.keys(sums)) {
    assignPipelineLatency(avg, k as LatencySegmentKey, sums[k].sum / sums[k].count);
    assignPipelineLatency(max, k as LatencySegmentKey, sums[k].max);
  }
  if (avg.total_ms) delete avg.first_sound_status;
  if (max.total_ms) delete max.first_sound_status;
  return {
    turnCount: allTurns.length,
    sessionCount: aggs.length,
    avg,
    max,
    turns: allTurns,
    blockerCount: blockers,
    topBlocker: Object.entries(blockerCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

