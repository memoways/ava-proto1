import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertMock = vi.fn();
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
  buildVoiceTurnCompletedPayload,
  pickVoiceTurnBlocker,
  recordVoiceError,
  recordVoiceTurnCompleted,
} from "@/services/voiceTelemetry";

describe("voiceTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertMock.mockReturnValue({ then: vi.fn() });
  });

  it("identifies the most over-budget latency blocker", () => {
    const blocker = pickVoiceTurnBlocker({
      t_stt_total_ms: 600,
      t_max_llm_ms: 4200,
      t_tts_total_ms: 900,
      t_audio_playback_total_ms: 1200,
    });

    expect(blocker).toEqual({
      blocker_step: "max_llm",
      blocker_reason: "over_budget",
      severity: "critical",
    });
  });

  it("builds an aggregate voice turn payload with computed totals and browser metadata", () => {
    const payload = buildVoiceTurnCompletedPayload({
      session_id: "session-1",
      turn_id: "session-1:2",
      turn_index: 2,
      character: "max",
      variant: "A",
      voice_modality: "push_to_talk",
      user_message_len: 12,
      max_response_len: 42,
      timings: {
        t_stt_total_ms: 300,
        t_rag_total_ms: 100,
        t_max_llm_ms: 850,
        t_validator_ms: 100,
        t_tts_total_ms: 500,
        t_audio_playback_total_ms: 2200,
        t_gm_post_ms: 250,
      },
      models: { max_model: "google/gemini-2.0-flash-001" },
      tts: { provider: "elevenlabs", segments_count: 2, segments_played: 2, segments_failed: 0 },
      browser: { userAgent: "Mozilla/5.0 Chrome/125", selectedMimeType: "audio/webm" },
    });

    expect(payload.t_turn_response_ready_ms).toBe(1350);
    expect(payload.t_turn_voice_ready_ms).toBe(1850);
    expect(payload.t_turn_end_to_end_ms).toBe(4300);
    expect(payload.browser_family).toBe("Chromium");
    expect(payload.blocker_step).toBe("audio_playback");
    expect(payload.severity).toBe("slow");
  });

  it("sends completed voice turns to PostHog and internal storage", () => {
    const payload = buildVoiceTurnCompletedPayload({
      session_id: "session-1",
      turn_id: "session-1:1",
      turn_index: 1,
      character: "max",
      timings: { t_turn_end_to_end_ms: 1200 },
    });

    recordVoiceTurnCompleted(payload);

    expect(mocks.trackEventMock).toHaveBeenCalledWith("voice_turn_completed", payload);
    expect(mocks.fromMock).toHaveBeenCalledWith("voice_turn_events");
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      session_id: "session-1",
      turn_id: "session-1:1",
      turn_index: 1,
      event_name: "voice_turn_completed",
      metadata_json: payload,
    }));
  });

  it("records unified voice errors to PostHog and internal storage", () => {
    recordVoiceError({
      session_id: "session-1",
      turn_id: "session-1:4",
      turn_index: 4,
      component: "tts",
      provider: "elevenlabs",
      error_type: "quota",
      error_message: "quota_exceeded",
      recoverable: true,
      fallback_used: "text_only",
    });

    expect(mocks.trackEventMock).toHaveBeenCalledWith("voice_error", expect.objectContaining({
      component: "tts",
      error_type: "quota",
      fallback_used: "text_only",
    }));
    expect(mocks.fromMock).toHaveBeenCalledWith("voice_error_events");
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      session_id: "session-1",
      turn_id: "session-1:4",
      component: "tts",
      error_type: "quota",
    }));
  });
});
