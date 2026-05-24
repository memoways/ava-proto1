import { describe, expect, it } from "vitest";
import {
  buildLatencySegmentsFromPipeline,
  computeSegmentServiceEvolution,
  computeSegmentServiceStats,
  percentile,
} from "@/services/latencySegments";

describe("latencySegments", () => {
  it("computes P50 and P95 with interpolation", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(percentile([100, 200, 300, 400], 0.95)).toBeCloseTo(385);
    expect(percentile([], 0.5)).toBe(0);
  });

  it("enriches missing provider and model as Unknown", () => {
    const [segment] = buildLatencySegmentsFromPipeline({
      sessionId: "s1",
      turnIndex: 1,
      pipeline: { tts_ms: 7750 },
    });

    expect(segment).toMatchObject({
      key: "tts_ms",
      label: "TTS",
      durationMs: 7750,
      serviceProvider: "Unknown",
      model: "Unknown",
      context: {
        sessionId: "s1",
        turnIndex: 1,
      },
    });
  });

  it("uses configured default services when per-turn metadata is missing", () => {
    const segments = buildLatencySegmentsFromPipeline({
      sessionId: "s1",
      turnIndex: 1,
      pipeline: { max_ms: 1200, tts_ms: 800 },
      defaultServices: {
        max_ms: { serviceProvider: "OpenRouter", serviceName: "openrouter", model: "google/gemini-2.0-flash-001" },
        tts_ms: { serviceProvider: "ElevenLabs", serviceName: "elevenlabs", model: "eleven_multilingual_v2" },
      },
    });

    expect(segments).toEqual([
      expect.objectContaining({
        key: "max_ms",
        serviceProvider: "OpenRouter",
        serviceName: "openrouter",
        model: "google/gemini-2.0-flash-001",
      }),
      expect.objectContaining({
        key: "tts_ms",
        serviceProvider: "ElevenLabs",
        serviceName: "elevenlabs",
        model: "eleven_multilingual_v2",
      }),
    ]);
  });

  it("fills Unknown fields from configured defaults without replacing explicit known fields", () => {
    const [segment] = buildLatencySegmentsFromPipeline({
      pipeline: {
        max_ms: 1200,
        segmentServices: {
          max_ms: { serviceProvider: "OpenRouter", serviceName: "openrouter", model: "Unknown" },
        },
      },
      services: {
        max_ms: { serviceProvider: "OpenRouter", serviceName: "openrouter", model: "Unknown" },
      },
      defaultServices: {
        max_ms: { serviceProvider: "OpenRouter", serviceName: "openrouter", model: "google/gemini-2.0-flash-001" },
      },
    });

    expect(segment).toMatchObject({
      serviceProvider: "OpenRouter",
      serviceName: "openrouter",
      model: "google/gemini-2.0-flash-001",
    });
  });

  it("groups stats by segment, provider, service and model", () => {
    const stats = computeSegmentServiceStats([
      {
        key: "tts_ms",
        label: "TTS",
        durationMs: 100,
        serviceProvider: "Inworld",
        serviceName: "inworld",
        model: "inworld-tts-2",
        context: { sessionId: "s1", turnIndex: 1 },
      },
      {
        key: "tts_ms",
        label: "TTS",
        durationMs: 300,
        serviceProvider: "Inworld",
        serviceName: "inworld",
        model: "inworld-tts-2",
        context: { sessionId: "s1", turnIndex: 2, blocked: true },
      },
      {
        key: "max_ms",
        label: "Max LLM",
        durationMs: 200,
        serviceProvider: "OpenRouter",
        model: "openai/gpt-4o-mini",
        context: { sessionId: "s1", turnIndex: 3 },
      },
    ]);

    const tts = stats.find((s) => s.segmentLabel === "TTS");
    expect(tts).toMatchObject({
      count: 2,
      p50: 200,
      p95: 290,
      avg: 200,
      max: 300,
      blockageCount: 1,
      blockageRate: 0.5,
      serviceProvider: "Inworld",
      serviceName: "inworld",
      model: "inworld-tts-2",
    });
  });

  it("returns top 5 outliers and flags values above P95", () => {
    const durations = [100, 120, 140, 160, 180, 200, 800];
    const stats = computeSegmentServiceStats(
      durations.map((durationMs, i) => ({
        key: "max_ms",
        label: "Max LLM",
        durationMs,
        serviceProvider: "OpenRouter",
        model: "google/gemini-2.0-flash-001",
        context: { sessionId: "s1", turnIndex: i + 1 },
      })),
    );

    expect(stats[0].outliers).toHaveLength(5);
    expect(stats[0].outliers[0]).toMatchObject({ durationMs: 800, aboveP95: true });
    expect(stats[0].outliers.filter((o) => o.aboveP95)).toHaveLength(1);
  });

  it("builds session evolution with min median and max per service", () => {
    const evolution = computeSegmentServiceEvolution([
      {
        key: "tts_ms",
        label: "TTS",
        durationMs: 1000,
        serviceProvider: "Inworld",
        model: "inworld-tts-2",
        context: { sessionId: "s1", sessionLabel: "Alpha", sessionStartedAt: "2026-05-01T10:00:00Z" },
      },
      {
        key: "tts_ms",
        label: "TTS",
        durationMs: 3000,
        serviceProvider: "Inworld",
        model: "inworld-tts-2",
        context: { sessionId: "s1", sessionLabel: "Alpha", sessionStartedAt: "2026-05-01T10:00:00Z" },
      },
      {
        key: "tts_ms",
        label: "TTS",
        durationMs: 2000,
        serviceProvider: "ElevenLabs",
        model: "eleven_multilingual_v2",
        context: { sessionId: "s2", sessionLabel: "Beta", sessionStartedAt: "2026-05-02T10:00:00Z" },
      },
    ]);

    expect(evolution).toEqual([
      expect.objectContaining({
        sessionId: "s1",
        sessionLabel: "Alpha",
        segmentLabel: "TTS",
        serviceLabel: "Inworld · inworld-tts-2",
        minMs: 1000,
        medianMs: 2000,
        maxMs: 3000,
        count: 2,
      }),
      expect.objectContaining({
        sessionId: "s2",
        sessionLabel: "Beta",
        serviceLabel: "ElevenLabs · eleven_multilingual_v2",
        minMs: 2000,
        medianMs: 2000,
        maxMs: 2000,
        count: 1,
      }),
    ]);
  });
});
