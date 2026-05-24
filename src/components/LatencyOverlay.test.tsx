import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LatencyOverlay from "@/components/LatencyOverlay";
import { formatLatencyDuration, isLatencyOverlayEnabledFromSearch } from "@/hooks/useLatencyOverlay";
import type { LatencySegment } from "@/hooks/useLatencyOverlay";

describe("LatencyOverlay", () => {
  it("formats durations as M:SS sec", () => {
    expect(formatLatencyDuration(2_000)).toBe("0:02 sec");
    expect(formatLatencyDuration(154_000)).toBe("2:34 sec");
  });

  it("reads the ?latence flag from the URL search string", () => {
    expect(isLatencyOverlayEnabledFromSearch("?latence")).toBe(true);
    expect(isLatencyOverlayEnabledFromSearch("?foo=1&latence")).toBe(true);
    expect(isLatencyOverlayEnabledFromSearch("?foo=1")).toBe(false);
  });

  it("renders nothing when disabled", () => {
    render(<LatencyOverlay enabled={false} segments={[activeSegment()]} nowMs={3_000} />);

    expect(screen.queryByTestId("latency-overlay")).not.toBeInTheDocument();
  });

  it("renders an active segment with a live counter", () => {
    render(<LatencyOverlay enabled segments={[activeSegment()]} nowMs={3_000} />);

    expect(screen.getByTestId("latency-overlay")).toBeInTheDocument();
    expect(screen.getByText("STT")).toBeInTheDocument();
    expect(screen.getByText("Deepgram")).toBeInTheDocument();
    expect(screen.getByText("0:03 sec")).toBeInTheDocument();
  });

  it("renders a finished segment with a frozen duration", () => {
    const segment: LatencySegment = {
      id: "tts-1",
      segment: "TTS",
      service: "ElevenLabs",
      status: "done",
      startedAt: 1_000,
      endedAt: 3_000,
      durationMs: 2_000,
      turnIndex: 1,
    };

    render(<LatencyOverlay enabled segments={[segment]} currentTurn={1} nowMs={30_000} />);

    expect(screen.getByText("TTS")).toBeInTheDocument();
    expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    expect(screen.getByText("0:02 sec")).toBeInTheDocument();
  });
});

function activeSegment(): LatencySegment {
  return {
    id: "stt-1",
    segment: "STT",
    service: "Deepgram",
    status: "active",
    startedAt: 0,
    turnIndex: 1,
  };
}
