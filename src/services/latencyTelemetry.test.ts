import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertMock = vi.fn(() => ({ then: vi.fn() }));
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const trackEventMock = vi.fn();
  return { insertMock, fromMock, trackEventMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.fromMock },
}));

vi.mock("@/services/posthogService", () => ({
  trackEvent: mocks.trackEventMock,
}));

import {
  createTurnTimer,
  enableTelemetry,
  recordAudioLatency,
} from "@/services/latencyTelemetry";

describe("latencyTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableTelemetry();
  });

  it("records every turn latency in PostHog and internal storage", () => {
    const timer = createTurnTimer({ session_id: "session-1", turn_index: 2 });

    timer.emit({ t_max_llm_ms: 810, metadata: { provider: "OpenRouter" } });

    expect(mocks.trackEventMock).toHaveBeenCalledWith("turn_latency", expect.objectContaining({
      session_id: "session-1",
      turn_index: 2,
      t_max_llm_ms: 810,
      t_turn_total_ms: expect.any(Number),
    }));
    expect(mocks.fromMock).toHaveBeenCalledWith("turn_latencies");
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      session_id: "session-1",
      turn_index: 2,
      t_max_llm_ms: 810,
      metadata_json: { provider: "OpenRouter" },
    }));
  });

  it("records every STT/TTS latency in PostHog and internal storage", () => {
    recordAudioLatency({
      session_id: "session-1",
      turn_index: 2,
      direction: "out",
      t_tts_total_ms: 460,
      metadata: { provider: "elevenlabs", retry_count: 0 },
    });

    expect(mocks.trackEventMock).toHaveBeenCalledWith("audio_latency", expect.objectContaining({
      direction: "out",
      t_tts_total_ms: 460,
    }));
    expect(mocks.fromMock).toHaveBeenCalledWith("audio_latencies");
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      direction: "out",
      t_tts_total_ms: 460,
      metadata_json: { provider: "elevenlabs", retry_count: 0 },
    }));
  });
});
