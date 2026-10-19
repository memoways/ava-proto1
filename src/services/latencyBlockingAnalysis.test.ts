import { describe, expect, it } from "vitest";
import { aggregateLatencySession, aggregateLatencySessions, observedWaitStats, type SessionRow } from "./latencyBlockingAnalysis";
import { getPlayerWaitLatencyTotal } from "./latencySegments";

function session(): SessionRow {
  return { id: "s", name: null, started_at: null, ended_at: null, game_over_reason: null,
    environment_id: "prod", context_type: "public", active_character: "max", duration_seconds: null,
    tester_label: null, test_invitation_id: null, gm_post_turn_log: [], conversation_log: [
      { role: "user", content: "a", timestamp: 1 },
      { role: "max", content: "b", timestamp: 2, pipeline: { rag_ms: 500, max_ms: 1200,
        tts_first_playback_ms: 600, total_ms: 1850, latency_origin: "ptt_finalized", first_sound_status: "measured" } },
      { role: "user", spokenWith: "emma", content: "c", timestamp: 3 },
      { role: "emma", spokenWith: "emma", content: "d", timestamp: 4, pipeline: {
        max_ms: 300, total_ms: 900, latency_origin: "transcript_final", first_sound_status: "measured" } },
    ] };
}

describe("latency view aggregates", () => {
  it("filters turns inside mixed sessions using the message character", () => {
    const emma = aggregateLatencySession(session(), "emma");
    expect(emma.turns.map(turn => turn.index)).toEqual([2]);
    expect(getPlayerWaitLatencyTotal(emma.avg)).toBe(900);
    expect(emma.blockerCount).toBe(0);
  });

  it("preserves observed totals in averages and weights comparison by turns", () => {
    const all = aggregateLatencySession(session());
    expect(getPlayerWaitLatencyTotal(all.avg)).toBe(1375);
    expect(getPlayerWaitLatencyTotal(all.max)).toBe(1850);
    const maxOnly = aggregateLatencySession(session(), "max");
    const comparison = aggregateLatencySessions([all, maxOnly]);
    expect(comparison?.turnCount).toBe(3);
    expect(getPlayerWaitLatencyTotal(comparison!.avg)).toBeCloseTo((1850 + 900 + 1850) / 3);
  });

  it("keeps an unmeasured first sound unavailable despite existing service timings", () => {
    const input = session();
    input.conversation_log = input.conversation_log!.slice(0, 2);
    input.conversation_log[1].pipeline!.first_sound_status = "failed";
    expect(getPlayerWaitLatencyTotal(aggregateLatencySession(input).avg)).toBe(0);
  });

  it("separates clock origins and excludes legacy estimates from measured percentiles", () => {
    const turns = aggregateLatencySession(session()).turns;
    const stats = observedWaitStats([...turns, { max_ms: 9000, total_ms: 9000 }, {
      latency_origin: "ptt_finalized", total_ms: 12000, first_sound_status: "not_measured",
    }]);
    expect(stats).toEqual([
      { origin: "ptt_finalized", count: 1, p50: 1850, p95: 1850 },
      { origin: "transcript_final", count: 1, p50: 900, p95: 900 },
    ]);
  });
});

describe("video aggregates", () => {
  it("aggregates video and TTS fallback separately and preserves measured wait", () => {
    const row = session();
    row.conversation_log![1].pipeline = { video_ms: 1600, video_status: "failed", tts_first_playback_ms: 400,
      max_ms: 300, total_ms: 2400, latency_origin: "text_submitted", first_sound_status: "measured" };
    const aggregate = aggregateLatencySession(row, "max");
    expect(aggregate.avg.video_ms).toBe(1600);
    expect(aggregate.avg.tts_first_playback_ms).toBe(400);
    expect(aggregate.topBlocker).toBe("video_ms");
    expect(getPlayerWaitLatencyTotal(aggregate.avg)).toBe(2400);
  });
});
