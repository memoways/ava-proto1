import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/services/posthogService";
import type { BrowserDiagnostics } from "@/services/browserCapabilities";
import type { OnboardingVariant, VoiceModality } from "@/types";

export type VoiceBlockerStep =
  | "stt"
  | "rag"
  | "knowledge_build"
  | "gm_pre"
  | "max_llm"
  | "validator"
  | "tts_generation"
  | "audio_playback"
  | "gm_post"
  | "unknown";

export type VoiceSeverity = "ok" | "slow" | "critical" | "failed";

export interface VoiceTurnTimings {
  t_stt_total_ms?: number;
  t_rag_rewrite_ms?: number;
  t_rag_query_ms?: number;
  t_rag_total_ms?: number;
  t_knowledge_build_ms?: number;
  t_gm_pre_ms?: number;
  t_max_llm_ms?: number;
  t_validator_ms?: number;
  t_tts_first_byte_ms?: number;
  t_tts_total_ms?: number;
  t_audio_playback_start_ms?: number;
  t_audio_playback_total_ms?: number;
  t_gm_post_ms?: number;
  t_turn_response_ready_ms?: number;
  t_turn_voice_ready_ms?: number;
  t_turn_end_to_end_ms?: number;
}

export interface VoiceTurnCompletedInput {
  session_id?: string | null;
  turn_id: string;
  turn_index: number;
  character: string;
  variant?: OnboardingVariant | null;
  voice_modality?: VoiceModality | null;
  user_message_len?: number;
  max_response_len?: number;
  timings: VoiceTurnTimings;
  models?: {
    max_model?: string;
    gm_model?: string;
    validator_model?: string;
  };
  stt?: {
    provider?: string;
    model?: string;
    mode?: string;
  };
  rag?: {
    matches_count?: number;
    top_similarity?: number;
  };
  tts?: {
    provider?: string;
    model?: string;
    segments_count?: number;
    segments_played?: number;
    segments_failed?: number;
  };
  browser?: Partial<BrowserDiagnostics>;
  audio_unlocked?: boolean;
  stt_trigger?: "silence" | "ptt_flush" | "manual" | "unknown";
  had_fallback?: boolean;
  had_error?: boolean;
  error_type?: string | null;
}

export type VoiceTurnCompletedPayload = VoiceTurnCompletedInput &
  Required<Pick<VoiceTurnCompletedInput, "turn_id" | "turn_index" | "character">> &
  VoiceTurnTimings & {
    browser_family: string;
    browser_name: string;
    media_recorder_mime: string;
    tts_provider?: string;
    tts_model?: string;
    stt_provider?: string;
    stt_model?: string;
    stt_mode?: string;
    tts_segments_count?: number;
    tts_segments_played?: number;
    tts_segments_failed?: number;
    max_model?: string;
    gm_model?: string;
    validator_model?: string;
    rag_matches_count?: number;
    rag_top_similarity?: number;
    blocker_step: VoiceBlockerStep;
    blocker_reason: string;
    severity: VoiceSeverity;
  };

export interface VoiceErrorRecord {
  session_id?: string | null;
  turn_id?: string | null;
  turn_index?: number | null;
  component: "stt" | "tts" | "audio_playback" | "llm" | "rag" | "gm" | "browser" | "orchestrator";
  provider?: string | null;
  error_type: string;
  error_message?: string;
  recoverable?: boolean;
  fallback_used?: string | null;
  browser?: Partial<BrowserDiagnostics>;
  metadata?: Record<string, unknown>;
}

const STEP_BUDGET_MS: Record<VoiceBlockerStep, number> = {
  stt: 900,
  rag: 350,
  knowledge_build: 50,
  gm_pre: 100,
  max_llm: 1200,
  validator: 400,
  tts_generation: 800,
  audio_playback: 1800,
  gm_post: 800,
  unknown: Number.POSITIVE_INFINITY,
};

function safe(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn("[voiceTelemetry]", err);
  }
}

function firstNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function serviceNameFromProvider(provider?: string | null): string {
  if (!provider) return "unknown";
  return provider.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

export function createVoiceTurnId(sessionId: string | null | undefined, turnIndex: number): string {
  const prefix = sessionId || "local";
  return `${prefix}:${turnIndex}`;
}

export function detectBrowserFamily(userAgent = globalThis.navigator?.userAgent || ""): { browser_family: string; browser_name: string } {
  if (/Firefox\//i.test(userAgent)) return { browser_family: "Firefox", browser_name: "Firefox" };
  if (/Edg\//i.test(userAgent)) return { browser_family: "Chromium", browser_name: "Edge" };
  if (/OPR\//i.test(userAgent)) return { browser_family: "Chromium", browser_name: "Opera" };
  if (/Brave/i.test(userAgent)) return { browser_family: "Chromium", browser_name: "Brave" };
  if (/Chrome\//i.test(userAgent) || /Chromium\//i.test(userAgent)) return { browser_family: "Chromium", browser_name: "Chrome" };
  if (/Safari\//i.test(userAgent)) return { browser_family: "WebKit", browser_name: "Safari" };
  return { browser_family: "Unknown", browser_name: "Unknown" };
}

export function pickVoiceTurnBlocker(timings: VoiceTurnTimings, hadError = false): {
  blocker_step: VoiceBlockerStep;
  blocker_reason: string;
  severity: VoiceSeverity;
} {
  const candidates: Array<{ step: VoiceBlockerStep; value?: number }> = [
    { step: "stt", value: timings.t_stt_total_ms },
    { step: "rag", value: timings.t_rag_total_ms },
    { step: "knowledge_build", value: timings.t_knowledge_build_ms },
    { step: "gm_pre", value: timings.t_gm_pre_ms },
    { step: "max_llm", value: timings.t_max_llm_ms },
    { step: "validator", value: timings.t_validator_ms },
    { step: "tts_generation", value: timings.t_tts_total_ms },
    { step: "gm_post", value: timings.t_gm_post_ms },
  ];

  let worst: { step: VoiceBlockerStep; ratio: number } | null = null;
  for (const candidate of candidates) {
    if (candidate.value == null || candidate.value <= 0) continue;
    const ratio = candidate.value / STEP_BUDGET_MS[candidate.step];
    if (!worst || ratio > worst.ratio) worst = { step: candidate.step, ratio };
  }

  if (hadError) {
    return {
      blocker_step: worst?.step ?? "unknown",
      blocker_reason: "error",
      severity: "failed",
    };
  }

  if (!worst || worst.ratio < 1) {
    return { blocker_step: "unknown", blocker_reason: "within_budget", severity: "ok" };
  }

  return {
    blocker_step: worst.step,
    blocker_reason: "over_budget",
    severity: worst.ratio >= 2 ? "critical" : "slow",
  };
}

export function buildVoiceTurnCompletedPayload(input: VoiceTurnCompletedInput): VoiceTurnCompletedPayload {
  const timings = { ...input.timings };
  const responseReady = firstNumber(
    timings.t_turn_response_ready_ms,
    (timings.t_stt_total_ms ?? 0) +
      (timings.t_rag_total_ms ?? 0) +
      (timings.t_gm_pre_ms ?? 0) +
      (timings.t_max_llm_ms ?? 0) +
      (timings.t_validator_ms ?? 0),
  );
  const voiceReady = firstNumber(
    timings.t_turn_voice_ready_ms,
    responseReady == null ? undefined : responseReady + (timings.t_tts_total_ms ?? 0),
  );
  const endToEnd = firstNumber(
    timings.t_turn_end_to_end_ms,
    voiceReady == null ? undefined : voiceReady + (timings.t_audio_playback_total_ms ?? 0) + (timings.t_gm_post_ms ?? 0),
  );
  const browser = detectBrowserFamily(input.browser?.userAgent);
  const blocker = pickVoiceTurnBlocker(
    {
      ...timings,
      t_turn_response_ready_ms: responseReady,
      t_turn_voice_ready_ms: voiceReady,
      t_turn_end_to_end_ms: endToEnd,
    },
    !!input.had_error,
  );

  return {
    ...input,
    ...timings,
    t_turn_response_ready_ms: responseReady,
    t_turn_voice_ready_ms: voiceReady,
    t_turn_end_to_end_ms: endToEnd,
    browser_family: browser.browser_family,
    browser_name: browser.browser_name,
    media_recorder_mime: input.browser?.selectedMimeType || "",
    tts_provider: input.tts?.provider,
    tts_model: input.tts?.model,
    stt_provider: input.stt?.provider,
    stt_model: input.stt?.model,
    stt_mode: input.stt?.mode,
    tts_segments_count: input.tts?.segments_count,
    tts_segments_played: input.tts?.segments_played,
    tts_segments_failed: input.tts?.segments_failed,
    max_model: input.models?.max_model,
    gm_model: input.models?.gm_model,
    validator_model: input.models?.validator_model,
    rag_matches_count: input.rag?.matches_count,
    rag_top_similarity: input.rag?.top_similarity,
    blocker_step: blocker.blocker_step,
    blocker_reason: blocker.blocker_reason,
    severity: blocker.severity,
  };
}

export function recordVoiceTurnCompleted(payload: VoiceTurnCompletedPayload): void {
  safe(() => trackEvent("voice_turn_completed", payload as unknown as Record<string, unknown>));
  safe(() => recordAvaLatencyEvents(payload));
  safe(() => {
    void supabase
      .from("voice_turn_events" as never)
      .insert({
        session_id: payload.session_id ?? null,
        turn_id: payload.turn_id,
        turn_index: payload.turn_index,
        event_name: "voice_turn_completed",
        severity: payload.severity,
        blocker_step: payload.blocker_step,
        metadata_json: payload,
      } as never)
      .then(({ error }) => {
        if (error) console.warn("[voiceTelemetry] insert voice_turn_events", error.message);
      });
  });
}

function recordAvaLatencyEvents(payload: VoiceTurnCompletedPayload): void {
  const blocked = payload.severity === "slow" || payload.severity === "critical" || payload.severity === "failed";
  const blockageReason = blocked ? payload.blocker_step || payload.blocker_reason : null;
  const segments = [
    {
      key: "stt_ms",
      label: "STT",
      duration: payload.t_stt_total_ms,
      provider: payload.stt_provider || payload.stt?.provider || "Unknown",
      serviceName: serviceNameFromProvider(payload.stt_provider || payload.stt?.provider),
      model: payload.stt_model || payload.stt?.model || "Unknown",
      mode: payload.stt_mode || payload.stt?.mode || "realtime",
    },
    {
      key: "rag_ms",
      label: "RAG",
      duration: payload.t_rag_total_ms,
      provider: "Unknown",
      serviceName: "rag",
      model: "Unknown",
      mode: "",
    },
    {
      key: "gm_pre_ms",
      label: "GM pre-turn",
      duration: payload.t_gm_pre_ms,
      provider: "OpenRouter",
      serviceName: "openrouter",
      model: payload.gm_model || "Unknown",
      mode: "",
    },
    {
      key: "max_ms",
      label: "Max LLM",
      duration: payload.t_max_llm_ms,
      provider: "OpenRouter",
      serviceName: "openrouter",
      model: payload.max_model || "Unknown",
      mode: "",
    },
    {
      key: "validator_ms",
      label: "Validateur",
      duration: payload.t_validator_ms,
      provider: "OpenRouter",
      serviceName: "openrouter",
      model: payload.validator_model || payload.gm_model || "Unknown",
      mode: "",
    },
    {
      key: "tts_ms",
      label: "TTS",
      duration: payload.t_tts_total_ms,
      provider: payload.tts_provider || "Unknown",
      serviceName: payload.tts_provider || "Unknown",
      model: payload.tts_model || "Unknown",
      mode: "realtime",
    },
    {
      key: "gm_post_ms",
      label: "GM post-turn",
      duration: payload.t_gm_post_ms,
      provider: "OpenRouter",
      serviceName: "openrouter",
      model: payload.gm_model || "Unknown",
      mode: "",
    },
  ].filter((segment) => typeof segment.duration === "number" && Number.isFinite(segment.duration) && segment.duration > 0);

  trackEvent("ava_turn_latency_summary", {
    session_id: payload.session_id ?? null,
    turn_index: payload.turn_index,
    correlation_id: payload.turn_id,
    total_latency_ms: payload.t_turn_voice_ready_ms ?? payload.t_turn_response_ready_ms ?? null,
    blocked,
    blockage_reason: blockageReason,
    segment_count: segments.length,
    stt_provider: payload.stt_provider || payload.stt?.provider || "Unknown",
    stt_model: payload.stt_model || payload.stt?.model || "Unknown",
    llm_provider: "OpenRouter",
    llm_model: payload.max_model || "Unknown",
    tts_provider: payload.tts_provider || "Unknown",
    tts_model: payload.tts_model || "Unknown",
  });

  for (const segment of segments) {
    trackEvent("ava_latency_segment", {
      session_id: payload.session_id ?? null,
      turn_index: payload.turn_index,
      correlation_id: payload.turn_id,
      segment_key: segment.key,
      segment_label: segment.label,
      duration_ms: segment.duration,
      provider: segment.provider,
      service_name: segment.serviceName,
      model: segment.model,
      mode: segment.mode,
      blocked: blocked && payload.blocker_step === segment.key.replace("_ms", "").replace("max", "max_llm").replace("tts", "tts_generation"),
      blockage_reason: blockageReason,
      scenario_id: payload.variant ?? null,
      avatar_id: payload.character,
      language: null,
    });
  }
}

export function recordVoiceError(record: VoiceErrorRecord): void {
  const browser = detectBrowserFamily(record.browser?.userAgent);
  const payload = {
    ...record,
    browser_family: browser.browser_family,
    browser_name: browser.browser_name,
    media_recorder_mime: record.browser?.selectedMimeType || "",
    error_message: record.error_message?.slice(0, 500),
  };

  safe(() => trackEvent("voice_error", payload as Record<string, unknown>));
  safe(() => {
    void supabase
      .from("voice_error_events" as never)
      .insert({
        session_id: record.session_id ?? null,
        turn_id: record.turn_id ?? null,
        turn_index: record.turn_index ?? null,
        component: record.component,
        provider: record.provider ?? null,
        error_type: record.error_type,
        error_message: record.error_message?.slice(0, 500) ?? null,
        recoverable: record.recoverable ?? true,
        fallback_used: record.fallback_used ?? null,
        metadata_json: payload,
      } as never)
      .then(({ error }) => {
        if (error) console.warn("[voiceTelemetry] insert voice_error_events", error.message);
      });
  });
}
