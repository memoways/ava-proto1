import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithVideoLatency, splitOutputLatency } from "./latency";
import type { ResponseOutput, ResponseOutputResult, ResponseOutputTurnContext, VideoLatencyObservation } from "./types";

const played: ResponseOutputResult = { status: "played", provider: "future-video", model: "actual-avatar",
  firstPlaybackStartMs: 200, playbackTotalMs: 5000, generatedSegments: 1, playedSegments: 1, failedSegments: 0, started: true };
function output(render: (text: string, context?: ResponseOutputTurnContext) => Promise<ResponseOutputResult>, mode: ResponseOutput["mode"] = "streaming_avatar"): ResponseOutput {
  return { mode, provider: "future-video", model: "selected-avatar", externalSessionId: null,
    renderText: render, prepare: vi.fn(), attachMedia: vi.fn(), interrupt: vi.fn(), dispose: vi.fn() };
}

describe("passive video latency", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("uses the actual arbitrary provider and first speech callback, excluding playback duration", async () => {
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const observed = vi.fn(), onPlaybackStart = vi.fn(), service = vi.fn();
    const adapter = output(async (_text, context) => {
      now = 300; context?.onPlaybackStart?.();
      now = 500; context?.onPlaybackStart?.(); // Later segments cannot reset first start.
      now = 5300; return played;
    });
    await expect(renderWithVideoLatency(adapter, "hello", { onPlaybackStart, onServiceObserved: service }, observed)).resolves.toBe(played);
    expect(observed).toHaveBeenCalledExactlyOnceWith({ provider: "future-video", model: "actual-avatar", waitMs: 200,
      status: "started", precision: "provider_speech_event" });
    expect(onPlaybackStart).toHaveBeenCalledTimes(2);
    expect(service).toHaveBeenCalledWith(expect.objectContaining({ service: "video", effective_provider: "future-video", effective_model: "selected-avatar" }));
    expect(adapter.interrupt).not.toHaveBeenCalled();
  });
  it("preserves the original error and measures failed wait before TTS fallback", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const error = new Error("video timeout"), observed = vi.fn();
    await expect(renderWithVideoLatency(output(async () => { now = 1200; throw error; }), "hello", {}, observed)).rejects.toBe(error);
    const video = observed.mock.calls[0][0];
    expect(video).toMatchObject({ waitMs: 1200, status: "failed", model: "selected-avatar" });
    expect(splitOutputLatency(1700, { ...video, fallbackUsed: true })).toEqual({ videoMs: 1200, ttsMs: 500 });
  });
  it("does not invent a first response from a provider result with no callback", async () => {
    const observed = vi.fn();
    await renderWithVideoLatency(output(async () => played), "hello", {}, observed);
    expect(observed.mock.calls[0][0].status).toBe("not_measured");
    expect(splitOutputLatency(undefined, observed.mock.calls[0][0])).toEqual({ videoMs: undefined, ttsMs: undefined });
  });
  it("records cancellation without swallowing aborts or triggering fallback", async () => {
    const controller = new AbortController(), observed = vi.fn();
    const error = new DOMException("aborted", "AbortError");
    await expect(renderWithVideoLatency(output(async () => { controller.abort(); throw error; }), "hello", { signal: controller.signal }, observed)).rejects.toBe(error);
    expect(observed.mock.calls[0][0].status).toBe("cancelled");
  });
  it("leaves local TTS callbacks and results intact and isolates diagnostic exceptions", async () => {
    const context = { onPlaybackStart: vi.fn() }, observed = vi.fn();
    const render = vi.fn(async () => played);
    await expect(renderWithVideoLatency(output(render, "tts"), "hello", context, observed)).resolves.toBe(played);
    expect(render).toHaveBeenCalledExactlyOnceWith("hello", context);
    expect(observed).not.toHaveBeenCalled();
    await expect(renderWithVideoLatency(output(async (_text, ctx) => { ctx?.onPlaybackStart?.(); return played; }), "hello",
      { onServiceObserved: () => { throw new Error("diagnostics"); } }, () => { throw new Error("metrics"); })).resolves.toBe(played);
    expect(splitOutputLatency(420)).toEqual({ ttsMs: 420, videoMs: undefined });
  });
  it("does not charge integrated video voice to local TTS", () => {
    const video: VideoLatencyObservation = { provider: "any", waitMs: 1000, status: "started", precision: "provider_speech_event" };
    expect(splitOutputLatency(1000, video)).toEqual({ videoMs: 1000, ttsMs: undefined });
    expect(splitOutputLatency(undefined, { ...video, status: "failed", fallbackUsed: true })).toEqual({ videoMs: 1000, ttsMs: undefined });
  });
});
