import { describe, expect, it } from "vitest";
import { summarizeInternalVoiceMetrics } from "@/services/posthogLatencyStats";

describe("AVA internal latency coverage", () => {
  it("counts only a measured playback as first sound and never substitutes a first token", () => {
    const rows = [
      {
        session_id: "s1",
        turn_id: "s1:1",
        context_type: "public",
        metadata_json: {
          first_sound_status: "measured" as const,
          t_turn_response_ready_ms: 1200,
          t_turn_voice_ready_ms: 1800,
        },
      },
      {
        session_id: "s1",
        turn_id: "s1:2",
        context_type: "public",
        metadata_json: {
          t_turn_response_ready_ms: 900,
          // Historical synthetic value: ignored without a measured status.
          t_turn_voice_ready_ms: 900,
          t_max_first_token_ms: 500,
        },
      },
    ];

    expect(summarizeInternalVoiceMetrics(rows)).toEqual({
      firstSound: [1800],
      responseReady: [1200, 900],
    });
  });
});
