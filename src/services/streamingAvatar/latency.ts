import { observeService } from "../voiceTurnTelemetryV2";
import type { ResponseOutput, ResponseOutputTurnContext, VideoLatencyObservation } from "./types";

/** A provider's integrated voice is included in video; local fallback follows it. */
export function splitOutputLatency(outputWaitMs?: number, video?: VideoLatencyObservation) {
  if (!video) return { ttsMs: outputWaitMs, videoMs: undefined };
  return {
    videoMs: video.status === "not_measured" ? undefined : video.waitMs,
    ttsMs: video.fallbackUsed && outputWaitMs != null ? Math.max(0, outputWaitMs - video.waitMs) : undefined,
  };
}

/** Passive: reuse existing speech callbacks, with no timer, request or extra gate. */
export async function renderWithVideoLatency(
  output: ResponseOutput,
  text: string,
  context: ResponseOutputTurnContext,
  onObservation: (value: VideoLatencyObservation) => void,
) {
  if (output.mode !== "streaming_avatar") return output.renderText(text, context);
  const start = performance.now();
  let firstStart: number | undefined;
  observeService(context.onServiceObserved, {
    service: "video", requested_provider: output.provider, requested_model: output.model ?? null,
    resolved_provider: output.provider, resolved_model: output.model ?? null,
    effective_provider: output.provider, effective_model: output.model ?? null,
    transport: "webrtc", fallback: false,
  });
  const report = (status: VideoLatencyObservation["status"], model = output.model) => {
    try {
      onObservation({ provider: output.provider, model,
        waitMs: Math.max(0, Math.round((firstStart ?? performance.now()) - start)),
        status, precision: "provider_speech_event" });
    } catch { /* Telemetry never changes delivery or fallback. */ }
  };
  try {
    const result = await output.renderText(text, {
      ...context,
      onPlaybackStart: () => {
        if (!context.signal?.aborted) firstStart ??= performance.now();
        context.onPlaybackStart?.();
      },
    });
    report(firstStart != null ? "started" : result.status === "cancelled" ? "cancelled"
      : result.status === "failed" ? "failed" : "not_measured", result.model ?? output.model);
    return result;
  } catch (error) {
    report(firstStart != null ? "started" : context.signal?.aborted ? "cancelled" : "failed");
    throw error;
  }
}
