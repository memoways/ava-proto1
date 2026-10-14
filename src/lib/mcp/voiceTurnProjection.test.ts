import { describe, expect, it } from "vitest";
import { z } from "zod-mcp";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import getVoiceLatencies from "./tools/get-voice-latencies";
import { createVoiceTurnV2, type VoiceTurnV2 } from "../../services/voiceTurnTelemetryV2";
import { projectVoiceEvents, voiceTurnProjectionSchema, voiceTurnPageSchema } from "./voiceTurnProjection";

export function voiceFixture(status: "completed" | "failed" | "interrupted" = "completed") {
  const rows: Array<{ id: string; created_at: string; event_name: string; metadata_json: VoiceTurnV2 }> = [];
  const turn = createVoiceTurnV2({ session_id: "s1", turn_id: "s1:1", turn_index: 1, character: "max", environment_id: "sandbox-ulrich", context_type: "sandbox", input_mode: "push_to_talk", latency_origin: "ptt_release" }, 1000,
    (event_name, metadata_json) => rows.push({ id: String(rows.length), created_at: "2026-10-12T12:00:00Z", event_name, metadata_json }));
  turn.observe("output_estimated", 1000);
  turn.finish(status);
  return rows;
}
describe("MCP technical projection", () => {
  it("serializes the actual tool output for published MCP discovery", () => {
    const schema = getVoiceLatencies.outputSchema;
    if (!(schema instanceof z.ZodObject)) throw new Error("Voice latency output must be an object schema");
    // SDK declarations use its bundled Zod version; runtime consumes our pinned alias.
    expect(() => toJsonSchemaCompat(schema as unknown as Parameters<typeof toJsonSchemaCompat>[0], {
      target: "draft-2020-12", pipeStrategy: "output",
    })).not.toThrow();
  });
  it("accepts historical V2 events without P2 milestones, keeping missing measures null", () => {
    const value = structuredClone(voiceFixture()[0].metadata_json);
    delete (value.milestones as Partial<typeof value.milestones>).audio_suspended;
    delete value.interruptions;delete value.capture_dsp;
    const projected = voiceTurnProjectionSchema.parse(value);
    expect(projected.milestones.audio_suspended).toBeNull();expect(projected.interruptions).toBeUndefined();
  });
  it("strips private dialogue, prompts and credentials from every projected nesting", () => {
    const rows = voiceFixture();
    const value = { ...rows[1].metadata_json, transcript: "private dialogue", prompt: "private prompt", token: "secret", services: [{ service: "tts", requested_provider: "elevenlabs", requested_model: null, resolved_provider: "gradium", resolved_model: null, effective_provider: "gradium", effective_model: "gradium-tts", transport: "rest_fallback", transcript: "private", secret: "secret" }] };
    const parsed = voiceTurnProjectionSchema.parse(value);
    expect(JSON.stringify(parsed)).not.toMatch(/private|secret/);
    expect(parsed.services[0].effective_provider).toBe("gradium");
    expect(parsed.services[0].transport).toBe("rest_fallback");
  });
  it("keeps failures and interruptions, counts one attempt per lifecycle and excludes GM from denominator", () => {
    const rows = [...voiceFixture("failed"), ...voiceFixture("interrupted")];
    const gm = { ...rows[1], event_name: "voice_turn_gm" };
    const result = projectVoiceEvents([...rows, gm, { id: "v1", created_at: "", event_name: "voice_turn_completed", metadata_json: { t_turn_voice_ready_ms: 99 } }]);
    expect(result.summary.attempts).toBe(2);
    expect(result.summary.statuses).toEqual({ failed: 1, interrupted: 1 });
    expect(result.summary.gmObservations).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.summary.originToOutputEstimatedMs.count).toBe(2);
    expect(result.summary.originToOutputEstimatedMs.p50).toBe(0);
    expect(result.summary.voiceEndToOutputEstimatedMs.count).toBe(0);
    expect(result.summary.voiceEndToOutputEstimatedMs.p95).toBeNull();
  });
  it("keeps started and partial turns visible when no terminal record exists", () => {
    const result = projectVoiceEvents(voiceFixture().slice(0, 1));
    expect(result.summary.statuses).toEqual({ started: 1 });
    expect(result.summary.coverage).toEqual({ partial: 1 });
  });
  it("rejects invalid returned structures rather than inventing data", () => {
    expect(voiceTurnPageSchema.safeParse({ summary: { attempts: 1 } }).success).toBe(false);
  });
});
