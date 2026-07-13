import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: mocks,
}));

describe("posthogService", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.init.mockClear();
    mocks.capture.mockClear();
  });

  it("keeps explicit telemetry while disabling autocapture and session replay", async () => {
    const { initPostHog, trackEvent } = await import("./posthogService");

    initPostHog();
    trackEvent("voice_turn_completed", { session_id: "session-test" });

    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autocapture: false,
        disable_session_recording: true,
      }),
    );
    expect(mocks.capture).toHaveBeenCalledWith("voice_turn_completed", { session_id: "session-test" });
  });
});
