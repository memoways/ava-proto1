import { describe, expect, it } from "vitest";
import {
  buildServiceTimeline,
  buildStageTimeline,
  compareServices,
  halfPeriodTrend,
  OTHER_SERVICE,
  pickBucket,
  toLatencySample,
  type LatencySample,
} from "@/services/latencyAnalytics";

const FROM = "2026-11-01T00:00:00.000Z";
const TO = "2026-11-02T00:00:00.000Z";

function sample(hour: number, values: LatencySample["values"], dims: Partial<LatencySample> = {}): LatencySample {
  return {
    createdAt: new Date(Date.parse(FROM) + hour * 3_600_000).toISOString(),
    stt: null, model: null, tts: null, video: null, character: null, browser: null,
    values, ...dims,
  };
}

describe("latency analytics", () => {
  it("projects V1 turns, skips V2 events and keeps first sound only when measured", () => {
    expect(toLatencySample({ created_at: FROM, event_name: "voice_turn_finished", metadata_json: { t_stt_total_ms: 100 } })).toBeNull();
    const projected = toLatencySample({
      created_at: FROM,
      event_name: "voice_turn_completed",
      metadata_json: { t_stt_total_ms: 300, t_max_llm_ms: 0, t_turn_voice_ready_ms: 900, max_model: " gpt ", tts_provider: "Gradium" },
    });
    expect(projected?.values).toMatchObject({ stt: 300, llm: undefined, firstSound: undefined });
    expect(projected).toMatchObject({ model: "gpt", tts: "Gradium" });
    expect(toLatencySample({ created_at: FROM, metadata_json: { first_sound_status: "measured", t_turn_voice_ready_ms: 900 } })?.values.firstSound).toBe(900);
  });

  it("buckets a 24 h period by the hour, empty hours included", () => {
    expect(pickBucket(FROM, TO).label).toBe("par heure");
    expect(pickBucket(FROM, "2026-11-08T00:00:00.000Z").label).toBe("par 6 heures");
    expect(pickBucket(FROM, "2026-12-01T00:00:00.000Z").label).toBe("par jour");
    const timeline = buildStageTimeline([sample(0.5, { stt: 100 }), sample(0.7, { stt: 300 }), sample(5, { stt: 500 })], FROM, TO, 3_600_000);
    expect(timeline).toHaveLength(24);
    expect(timeline[0]).toMatchObject({ turns: 2, stages: { stt: { p50: 100, p95: 300, count: 2 } } });
    expect(timeline[1].stages.stt.p50).toBeNull();
    expect(timeline[5].stages.stt.p50).toBe(500);
  });

  it("compares services on one stage and ignores turns without it", () => {
    const rows = [
      sample(1, { llm: 1000 }, { model: "a" }),
      sample(2, { llm: 3000 }, { model: "a" }),
      sample(3, { llm: 500 }, { model: "b" }),
      sample(4, { stt: 200 }, { model: "b" }),
    ];
    expect(compareServices(rows, "llm", "model")).toEqual([
      { key: "a", p50: 1000, p95: 3000, mean: 2000, count: 2 },
      { key: "b", p50: 500, p95: 500, mean: 500, count: 1 },
    ]);
  });

  it("folds services outside the kept list into Autres", () => {
    const rows = [sample(1, { tts: 100 }, { tts: "x" }), sample(1, { tts: 400 }, { tts: "y" })];
    const timeline = buildServiceTimeline(rows, "tts", "tts", ["x"], FROM, TO, 3_600_000);
    expect(timeline[1].values).toEqual({
      x: { p50: 100, p95: 100, mean: 100, count: 1 },
      [OTHER_SERVICE]: { p50: 400, p95: 400, mean: 400, count: 1 },
    });
  });

  it("reports a trend only when both halves of the period are measured", () => {
    expect(halfPeriodTrend([sample(1, { rag: 1000 }), sample(20, { rag: 1500 })], "rag", FROM, TO).deltaRate).toBeCloseTo(0.5);
    expect(halfPeriodTrend([sample(20, { rag: 1500 })], "rag", FROM, TO).deltaRate).toBeNull();
  });
});
