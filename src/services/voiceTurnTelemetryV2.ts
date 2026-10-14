/** Technical-only, bounded observations. All client offsets use one monotonic clock. */
export const VOICE_MILESTONES = [
  "capture_started", "capture_ready", "last_audio_sent", "turn_decided", "flush_sent", "flush_acknowledged",
  "transcript_final", "voice_end", "context_ready", "llm_request", "llm_headers", "llm_response",
  "first_token", "intent_ready", "safe_phrase", "tts_text_sent", "first_audio_chunk", "audio_blob_ready",
  "audio_scheduled", "output_estimated", "audio_end", "audio_cancelled",
  "acoustic_candidate", "attenuation", "audio_suspended", "interruption_confirmed", "interruption_rejected", "audio_resumed", "output_stop_estimated",
] as const;
export type VoiceMilestone = typeof VOICE_MILESTONES[number];
export type VoiceTurnStatus = "started" | "completed" | "interrupted" | "cancelled" | "timeout" | "failed" | "no_audio";
export interface ServiceObservation {
  service: "stt" | "llm" | "tts" | "rag" | "gm";
  requested_provider: string | null;
  requested_model: string | null;
  resolved_provider: string | null;
  resolved_model: string | null;
  effective_provider: string | null;
  effective_model: string | null;
  transport: string | null;
  character_override?: boolean;
  fallback?: boolean;
  retry_count?: number;
}
export interface ProcessSpan {
  name: string;
  start_ms: number;
  end_ms: number;
  status: "ok" | "failed";
}
export interface ServerObservation {
  request_id: string;
  clock: "edge_monotonic" | "client_monotonic";
  spans: ProcessSpan[];
  client_origin_at?: number;
  client_anchor_ms?: number;
}
export interface VoiceTurnV2 {
  schema_version: 2;
  session_id: string | null;
  turn_id: string;
  attempt_id: string;
  turn_index: number;
  character: string;
  environment_id: string;
  context_type: string;
  input_mode: "push_to_talk" | "hands_free" | "text";
  latency_origin: "capture_start" | "ptt_release" | "app_turn_decision" | "transcript_final" | "text_submitted";
  code_version: string;
  prompt_version: string | null;
  config_version: string | null;
  status: VoiceTurnStatus;
  clock: "client_monotonic";
  milestones: Record<VoiceMilestone, number | null>;
  services: ServiceObservation[];
  server: ServerObservation[];
  durations: {
    origin_to_response_ms: number | null;
    origin_to_output_estimated_ms: number | null;
    t_turn_voice_ready_ms: number | null;
    generation_total_ms: number | null;
    playback_ms: number | null;
  };
  coverage: { state: "complete" | "partial"; observed: number; expected: number; missing: string[] };
  output_precision: "software_estimate" | "unavailable";
  critical_wait: "coverage_incomplete";
  budget_exceeded: string[];
  interruptions?: { interruption_id: string; event: import("./handsFreeVoice").InterruptionEvent; offset_ms: number }[];
  interruptions_capped?: boolean;
  capture_dsp?: { echoCancellation: boolean; noiseSuppression: boolean | null; autoGainControl: boolean | null; trackSampleRate: number | null; contextSampleRate: number };
}
export type VoiceObserver = (name: VoiceMilestone, at?: number) => void;
export function observeVoice(observer: VoiceObserver | undefined, name: VoiceMilestone, at = performance.now()): void {
  try { observer?.(name, at); } catch { /* Measurements never decide a turn. */ }
}
export function observeService(observer: ((value: ServiceObservation) => void) | undefined, value: ServiceObservation): void {
  try { observer?.(value); } catch { /* Attribution is diagnostic only. */ }
}
/** Strip all non-technical upstream fields before collection, not only on MCP reads. */
export function projectServerObservation(input: ServerObservation, clientOrigin?: number): ServerObservation {
  const names = new Set(["control_quota", "rag_profile", "embedding", "vector_search", "rerank", "upstream_headers", "upstream_body", "gm_generation", "gm_validation_json", "gm_validation_relationship", "gm_persistence", "gm_available"]);
  return {
    request_id: String(input.request_id).slice(0, 160),
    ...(input.clock === "client_monotonic" && Number.isFinite(input.client_origin_at) && clientOrigin !== undefined
      ? { client_anchor_ms: Math.round(input.client_origin_at! - clientOrigin) } : {}),
    clock: input.clock === "client_monotonic" ? "client_monotonic" : "edge_monotonic",
    spans: (Array.isArray(input.spans) ? input.spans : []).filter((span) => names.has(span.name)
      && Number.isFinite(span.start_ms) && Number.isFinite(span.end_ms) && span.start_ms >= 0 && span.end_ms >= span.start_ms)
      .slice(0, 32).map((span) => ({ name: span.name, start_ms: span.start_ms, end_ms: span.end_ms, status: span.status === "failed" ? "failed" : "ok" })),
  };
}
export function createVoiceTurnV2(
  context: Pick<VoiceTurnV2, "session_id" | "turn_id" | "turn_index" | "character" | "environment_id" | "context_type" | "input_mode" | "latency_origin">,
  originAt: number,
  emit: (event: "voice_turn_started" | "voice_turn_finished" | "voice_turn_gm", value: VoiceTurnV2) => void,
) {
  const milestones = Object.fromEntries(VOICE_MILESTONES.map((name) => [name, null])) as VoiceTurnV2["milestones"];
  const value: VoiceTurnV2 = {
    ...context, schema_version: 2, attempt_id: crypto.randomUUID(), code_version: "0.26.0+voice-telemetry-v2",
    prompt_version: null, config_version: null, status: "started", clock: "client_monotonic",
    milestones, services: [], server: [],
    durations: { origin_to_response_ms: null, origin_to_output_estimated_ms: null, t_turn_voice_ready_ms: null, generation_total_ms: null, playback_ms: null },
    coverage: { state: "partial", observed: 0, expected: VOICE_MILESTONES.length, missing: [...VOICE_MILESTONES] },
    output_precision: "unavailable", critical_wait: "coverage_incomplete", budget_exceeded: [],
    interruptions: [], interruptions_capped: false,
  };
  let finished = false;
  const send = (event: Parameters<typeof emit>[0]) => {
    value.coverage.missing = VOICE_MILESTONES.filter((name) => milestones[name] === null);
    value.coverage.observed = VOICE_MILESTONES.length - value.coverage.missing.length;
    value.coverage.state = value.coverage.missing.length ? "partial" : "complete";
    try { emit(event, structuredClone(value)); } catch { /* Never block voice. */ }
  };
  send("voice_turn_started");
  const observe: VoiceObserver = (name, at = performance.now()) => {
    if (finished || (milestones[name] !== null && name !== "last_audio_sent") || !Number.isFinite(at)) return;
    // Capture can predate the origin (release / decision). Negative offsets are intentional.
    milestones[name] = Math.round(at - originAt);
  };
  return {
    attemptId: value.attempt_id, observe,
    interruption(event: import("./handsFreeVoice").InterruptionObservation) {
      if (finished) return;
      if (value.interruptions!.length >= 64) { value.interruptions_capped = true; return; }
      value.interruptions!.push({ interruption_id: event.interruption_id, event: event.event, offset_ms: Math.round(event.at - originAt) });
      if (event.event !== "interruption_recovery") observe(event.event, event.at);
    },
    captureDsp(dsp: NonNullable<VoiceTurnV2["capture_dsp"]>) { if (!finished) value.capture_dsp = { ...dsp }; },
    setOrigin(at: number, origin: VoiceTurnV2["latency_origin"]) {
      if (finished || !Number.isFinite(at)) return;
      const shift = Math.round(originAt - at);
      for (const name of VOICE_MILESTONES) if (milestones[name] !== null) milestones[name]! += shift;
      for (const event of value.interruptions ?? []) event.offset_ms += shift;
      originAt = at; value.latency_origin = origin;
    },
    service(service: ServiceObservation) { if (!finished && value.services.length < 16) value.services.push(service); },
    server(server: ServerObservation) { if (!finished && value.server.length < 8) value.server.push(projectServerObservation(server, originAt)); },
    versions(prompt: string | null, config: string | null) { if (!finished) { value.prompt_version = prompt; value.config_version = config; } },
    durations(generation: number | null, playback: number | null) {
      if (!finished) { value.durations.generation_total_ms = generation; value.durations.playback_ms = playback; }
    },
    finish(status: Exclude<VoiceTurnStatus, "started">) {
      if (finished) return;
      if (status === "interrupted" || status === "cancelled" || status === "timeout") observe("audio_cancelled");
      finished = true;
      value.status = status;
      value.durations.origin_to_response_ms = milestones.llm_response;
      value.durations.origin_to_output_estimated_ms = milestones.output_estimated;
      value.durations.t_turn_voice_ready_ms = milestones.voice_end !== null && milestones.output_estimated !== null
        ? Math.max(0, milestones.output_estimated - milestones.voice_end) : null;
      value.output_precision = milestones.output_estimated === null ? "unavailable" : "software_estimate";
      // Budget exceedance is not evidence of a critical path. GM overlaps playback.
      if (milestones.llm_request !== null && milestones.llm_response !== null && milestones.llm_response - milestones.llm_request > 1200) value.budget_exceeded.push("llm");
      send("voice_turn_finished");
    },
    gm(service: ServiceObservation, server: ServerObservation) {
      // Independent post-turn availability, also retained after an interrupted turn.
      const previousServices = value.services;
      const previousServer = value.server;
      value.services = [service]; value.server = [projectServerObservation(server, originAt)];
      send("voice_turn_gm");
      value.services = previousServices; value.server = previousServer;
    },
  };
}

/** Guard the entire error callback, including teardown, before any stale-session effect. */
export function handleVoiceInputError(
  inputRef: { current: ReturnType<typeof createVoiceTurnV2> | null },
  initialCapture: ReturnType<typeof createVoiceTurnV2> | null,
  activeSession: boolean,
  onOwnedError: () => void,
): void {
  if (!activeSession && (!inputRef.current || inputRef.current !== initialCapture)) return;
  inputRef.current?.finish("failed");
  inputRef.current = null;
  onOwnedError();
}
