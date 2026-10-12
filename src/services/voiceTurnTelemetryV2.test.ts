import { describe, expect, it, vi } from "vitest";
import { createVoiceTurnV2, handleVoiceInputError, observeVoice, projectServerObservation, type VoiceTurnV2 } from "./voiceTurnTelemetryV2";
import { numberOrNull } from "../../supabase/functions/_shared/telemetryNumbers";
import { createMonotonicSpans } from "../../supabase/functions/_shared/monotonicSpans";

const context = { session_id: "s1", turn_id: "s1:1", turn_index: 1, character: "emma", environment_id: "sandbox-ulrich", context_type: "sandbox", input_mode: "hands_free" as const, latency_origin: "app_turn_decision" as const };
function attempt() {
  const events: Array<{ event: string; value: VoiceTurnV2 }> = [];
  const turn = createVoiceTurnV2(context, 1000, (event, value) => events.push({ event, value }));
  return { turn, events };
}
describe("V2 observations without changing voice decisions", () => {
  it("retains missing physical speech end and batch first token, with explicit origin and measured zero", () => {
    const { turn, events } = attempt();
    turn.observe("capture_started", 200);
    turn.observe("llm_response", 1000);
    turn.observe("output_estimated", 1800);
    turn.finish("completed");
    const value = events[1].value;
    expect(value.milestones.capture_started).toBe(-800);
    expect(value.milestones.first_token).toBeNull();
    expect(value.durations.origin_to_response_ms).toBe(0);
    expect(value.durations.t_turn_voice_ready_ms).toBeNull();
    expect(value.durations.origin_to_output_estimated_ms).toBe(800);
    expect(value.output_precision).toBe("software_estimate");
    expect(value.coverage.state).toBe("partial");
    expect(value.critical_wait).toBe("coverage_incomplete");
  });
  it("finalizes cancellation once and ignores delayed playback and provider callbacks", () => {
    const { turn, events } = attempt();
    turn.finish("interrupted");
    turn.observe("output_estimated", 5000);
    turn.finish("completed");
    turn.service({ service: "tts", requested_provider: null, requested_model: null, resolved_provider: null, resolved_model: null, effective_provider: "gradium", effective_model: null, transport: "websocket" });
    expect(events.map((event) => event.event)).toEqual(["voice_turn_started", "voice_turn_finished"]);
    expect(events[1].value.status).toBe("interrupted");
    expect(events[1].value.milestones.output_estimated).toBeNull();
    expect(events[1].value.services).toEqual([]);
    expect(events[0].value.status).toBe("started");
  });
  it("rebases a capture attempt to the release origin without losing its identity or input tail", () => {
    const { turn, events } = attempt();
    turn.observe("capture_started", 1000);
    turn.observe("last_audio_sent", 1200);
    turn.observe("last_audio_sent", 1400);
    turn.setOrigin(1500, "ptt_release");
    turn.observe("output_estimated", 2000);
    turn.finish("completed");
    expect(events[1].value.attempt_id).toBe(events[0].value.attempt_id);
    expect(events[1].value.milestones.capture_started).toBe(-500);
    expect(events[1].value.milestones.last_audio_sent).toBe(-100);
    expect(events[1].value.durations.origin_to_output_estimated_ms).toBe(500);
  });
  it("anchors client GM spans to the same turn clock and leaves Edge spans isolated", () => {
    const { turn, events } = attempt();
    turn.gm({ service: "gm", requested_provider: null, requested_model: null, resolved_provider: null, resolved_model: null, effective_provider: null, effective_model: null, transport: "http_batch" },
      { request_id: "gm1", clock: "client_monotonic", client_origin_at: 1500, spans: [{ name: "gm_available", start_ms: 50, end_ms: 50, status: "ok" }] });
    expect(events[1].value.server[0].client_anchor_ms).toBe(500);
    expect(projectServerObservation({ request_id: "edge1", clock: "edge_monotonic", client_origin_at: 1500, spans: [] }, 1000).client_anchor_ms).toBeUndefined();
  });
  it("keeps a reused hands-free STT failure scoped to input, after transfer and on the next turn", () => {
    const initial = attempt();
    // First capture transferred to playback; no current input remains.
    const teardown = vi.fn();
    handleVoiceInputError({ current: null }, initial.turn, true, teardown);
    expect(teardown).toHaveBeenCalledOnce();
    initial.turn.observe("output_estimated", 1800);
    initial.turn.finish("completed");
    expect(initial.events[1].value.status).toBe("completed");
    const next = attempt();
    const nextRef = { current: next.turn as typeof next.turn | null };
    handleVoiceInputError(nextRef, initial.turn, true, () => {
      teardown();
      nextRef.current?.finish("cancelled");
    });
    expect(nextRef.current).toBeNull();
    expect(next.events[1].value.status).toBe("failed");
    const newest = attempt();
    handleVoiceInputError({ current: newest.turn }, initial.turn, false, teardown);
    expect(teardown).toHaveBeenCalledTimes(2);
    expect(newest.events).toHaveLength(1);
  });
  it("assigns a fresh attempt ID to retries of the same causal turn", () => {
    const a = attempt(); const b = attempt();
    expect(a.turn.attemptId).not.toBe(b.turn.attemptId);
    expect(a.events[0].value.turn_id).toBe(b.events[0].value.turn_id);
  });
  it("does not block on a thrown collector or observer", () => {
    const turn = createVoiceTurnV2(context, 1000, () => { throw new Error("offline"); });
    expect(() => turn.finish("failed")).not.toThrow();
    expect(() => observeVoice(() => { throw new Error("offline"); }, "llm_request")).not.toThrow();
  });
  it("bounds service data and keeps GM as an independent late availability observation", () => {
    const { turn, events } = attempt();
    const service = { service: "gm" as const, requested_provider: null, requested_model: null, resolved_provider: null, resolved_model: null, effective_provider: null, effective_model: null, transport: "http_batch" };
    for (let n = 0; n < 100; n++) turn.service(service);
    turn.finish("timeout");
    turn.gm(service, { request_id: "gm1", clock: "client_monotonic", spans: [] });
    expect(events[1].value.services).toHaveLength(16);
    expect(events[2].event).toBe("voice_turn_gm");
    expect(events[2].value.attempt_id).toBe(turn.attemptId);
    expect(events[1].value.status).toBe("timeout");
  });
  it.each([null, undefined, "", "  ", false, [], {}, -1, Infinity])("does not coerce absent or invalid measurement %j into zero", (value) => {
    expect(numberOrNull(value)).toBeNull();
  });
  it("preserves real zero in proxy statistics", () => { expect(numberOrNull(0)).toBe(0); expect(numberOrNull("0")).toBe(0); });
  it("removes private upstream fields and invalid spans before collection", () => {
    const observation = projectServerObservation({ request_id: "edge1", clock: "edge_monotonic", prompt: "private", spans: [
      { name: "embedding", start_ms: 1, end_ms: 2, status: "ok", transcript: "private" },
      { name: "upstream_body", start_ms: 5, end_ms: 1, status: "ok" },
    ] } as unknown as Parameters<typeof projectServerObservation>[0]);
    expect(observation.spans).toHaveLength(1);
    expect(JSON.stringify(observation)).not.toContain("private");
  });
  it("marks returned database errors and invalid validation as failed spans", async () => {
    const spans = createMonotonicSpans("edge1");
    await spans.run("vector_search", async () => ({ data: null, error: { message: "unavailable" } }));
    spans.runSync("gm_validation_json", () => null);
    expect(spans.snapshot().spans.every((span) => span.status === "failed")).toBe(true);
  });
  it("isolates process spans, including failed steps", async () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValueOnce(10).mockReturnValueOnce(20).mockReturnValueOnce(35);
    const spans = createMonotonicSpans("edge1");
    await expect(spans.run("embedding", async () => { throw new Error("unavailable"); })).rejects.toThrow("unavailable");
    expect(spans.snapshot()).toEqual({ request_id: "edge1", clock: "edge_monotonic", spans: [{ name: "embedding", start_ms: 10, end_ms: 25, status: "failed" }] });
    clock.mockRestore();
  });
  it("preserves quota decisions while recording allowed null and HTTP refusals accurately", async () => {
    const spans = createMonotonicSpans("quota");
    const quotaFailed = (denied: Response | null) => denied !== null;
    expect(await spans.run("control_quota", async () => null, quotaFailed)).toBeNull();
    for (const status of [401, 429, 503]) {
      const denied = new Response(null, { status });
      expect(await spans.run("control_quota", async () => denied, quotaFailed)).toBe(denied);
      expect(denied.status).toBe(status);
    }
    await expect(spans.run("control_quota", async () => { throw new Error("quota unavailable"); }, quotaFailed))
      .rejects.toThrow("quota unavailable");
    expect(spans.snapshot().spans.map((span) => span.status)).toEqual(["ok", "failed", "failed", "failed", "failed"]);
  });
});
