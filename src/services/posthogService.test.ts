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
        persistence: "memory",
        opt_out_capturing_by_default: true,
      }),
    );
    expect(mocks.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(mocks.capture).toHaveBeenCalledWith("voice_turn_completed", { session_id: "session-test" });
  });

  it("removes free text and provider errors from optional analytics", async () => {
    const { enablePostHog, trackEvent } = await import("./posthogService");

    enablePostHog();
    await vi.waitFor(() => expect(mocks.opt_in_capturing).toHaveBeenCalled());
    trackEvent("voice_error", {
      provider: "Deepgram",
      error_message: "token secret leaked by provider",
      nested: { transcript: "contenu dicté", latency_ms: 120 },
    });

    expect(mocks.capture).toHaveBeenCalledWith("voice_error", {
      provider: "Deepgram",
      nested: { latency_ms: 120 },
    });
  });

  it("stops capture immediately after opt-out", async () => {
    const { disablePostHog, enablePostHog, trackEvent } = await import("./posthogService");

    enablePostHog();
    await vi.waitFor(() => expect(mocks.opt_in_capturing).toHaveBeenCalled());
    disablePostHog();
    trackEvent("after_opt_out");

    expect(mocks.opt_out_capturing).toHaveBeenCalledOnce();
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
