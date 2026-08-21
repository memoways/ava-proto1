import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: mocks,
}));

describe("posthogService", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.init.mockClear();
    mocks.capture.mockClear();
    mocks.identify.mockClear();
    mocks.opt_in_capturing.mockClear();
    mocks.opt_out_capturing.mockClear();
  });

  it("does not initialize or capture before explicit opt-in", async () => {
    const { trackEvent } = await import("./posthogService");

    trackEvent("voice_turn_completed", { session_id: "session-test" });

    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("keeps explicit telemetry while disabling persistence, autocapture and replay", async () => {
    const { enablePostHog, trackEvent } = await import("./posthogService");

    enablePostHog();
    await vi.waitFor(() => expect(mocks.opt_in_capturing).toHaveBeenCalled());
    trackEvent("voice_turn_completed", { session_id: "session-test" });

    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autocapture: false,
        disable_session_recording: true,
        capture_pageleave: true,
        persistence: "memory",
        opt_out_capturing_by_default: false,
      }),
    );
    expect(mocks.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(mocks.capture).toHaveBeenCalledWith("$pageview", expect.objectContaining({
      $current_url: expect.any(String),
    }));
    expect(mocks.capture).toHaveBeenCalledWith("voice_turn_completed", expect.objectContaining({
      session_id: "session-test",
      environment: "prod",
      context_type: "public",
      campaign: null,
      started_by: "public",
    }));
  });

  it("keeps redacted technical errors while removing free text", async () => {
    const { enablePostHog, trackEvent } = await import("./posthogService");

    enablePostHog();
    await vi.waitFor(() => expect(mocks.opt_in_capturing).toHaveBeenCalled());
    trackEvent("voice_error", {
      provider: "Deepgram",
      error_message: "Request failed with Bearer very-secret-token",
      nested: { transcript: "contenu dicté", latency_ms: 120 },
    });

    expect(mocks.capture).toHaveBeenCalledWith("voice_error", expect.objectContaining({
      provider: "Deepgram",
      error_message: "Request failed with Bearer [REDACTED]",
      nested: { latency_ms: 120 },
      environment: "prod",
      context_type: "public",
    }));
  });

  it("queues early telemetry until the asynchronously loaded SDK is ready", async () => {
    const { enablePostHog, identifyUser, trackEvent } = await import("./posthogService");

    enablePostHog();
    trackEvent("prd4_phase_changed", { phase: "welcome" });
    identifyUser("session-early", { variant: "prd4" });

    await vi.waitFor(() => {
      expect(mocks.capture).toHaveBeenCalledWith("prd4_phase_changed", expect.objectContaining({
        phase: "welcome",
        environment: "prod",
        context_type: "public",
      }));
      expect(mocks.identify).toHaveBeenCalledWith("session-early", { variant: "prd4" });
    });
  });

  it("stops capture immediately after opt-out", async () => {
    const { disablePostHog, enablePostHog, trackEvent } = await import("./posthogService");

    enablePostHog();
    await vi.waitFor(() => expect(mocks.opt_in_capturing).toHaveBeenCalled());
    mocks.capture.mockClear();
    disablePostHog();
    trackEvent("after_opt_out");

    expect(mocks.opt_out_capturing).toHaveBeenCalledOnce();
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
