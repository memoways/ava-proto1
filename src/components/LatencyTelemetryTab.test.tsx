import type { PropsWithChildren } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PosthogLatencyStats } from "@/services/posthogLatencyStats";
const mocks = vi.hoisted(() => ({ chart: vi.fn() }));
vi.mock("@/services/posthogLatencyStats", () => ({
  loadPosthogLatencyStats: vi.fn(), loadInternalLatencyComparison: vi.fn(async () => ({
    source: "AVA interne", turnCount: 0, sessionCount: 0, measuredFirstSound: 0, unmeasuredFirstSound: 0,
    firstSoundCoverageRate: null, errorCount: 0, errorRate: null, p50FirstSoundMs: null, p95FirstSoundMs: null,
    p50ResponseReadyMs: null, p95ResponseReadyMs: null, persistenceRate: null, missingInInternal: 0, onlyInternal: 0,
    costPerSessionUsd: null, providers: { models: [], stt: [], tts: [], browsers: [], characters: [] },
  })),
}));
vi.mock("./VoiceTurnDiagnostics", () => ({ VoiceTurnDiagnostics: () => null }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  BarChart: ({ children, data }: PropsWithChildren<{ data: unknown }>) => { mocks.chart(data); return <div>{children}</div>; },
  AreaChart: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Area: () => null, Bar: () => null, CartesianGrid: () => null, Cell: () => null, Legend: () => null,
  Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
import LatencyTelemetryTab from "./LatencyTelemetryTab";
function stats(): PosthogLatencyStats {
  const metric = { p50: 800, p95: 1000, measured: 1 };
  return { source: "PostHog", hasData: true, freshAt: "2026-10-19T12:00:00Z",
    period: { key: "24h", from: "2026-10-18T12:00:00Z", to: "2026-10-19T12:00:00Z" }, dashboardUrl: "https://eu.posthog.com/project/137897/dashboard",
    totals: { sessions: 1, turns: 1, errors: 0, errorRate: 0, fallbacks: 0, fallbackRate: 0 },
    latency: { responseReady: metric, firstSound: metric, endToEnd: metric, stt: metric, rag: metric, max: metric, tts: metric, gmPost: metric },
    blockers: [], providers: { models: [], stt: [], tts: [], browsers: [], characters: [] },
    actions: { cinematics: { recommended: 0, played: 0, skipped: 0 }, handoffs: { proposed: 0, accepted: 0, refused: 0, executed: 0, blocked: 0 } },
    timeline: [], slowestTurns: [], turnIds: ["s:1"],
  };
}
describe("PostHog video latency panel", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("supports an older Cloud response with no video fields and leaves them unmeasured", async () => {
    render(<LatencyTelemetryTab initialStats={stats()} />);
    await waitFor(() => expect(mocks.chart).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ label: "Vidéo (voix intégrée)", p50: null, p95: null, measured: 0 }),
    ])));
    expect(screen.getByLabelText("Filtre Service vidéo")).toBeInTheDocument();
  });
  it("shows video percentiles, provider, actual avatar and slow-turn wait separately from TTS", async () => {
    const data = stats();
    data.latency.video = { p50: 1200, p95: 1600, measured: 1 };
    data.providers.video = [{ key: "future-video", count: 1 }];
    data.slowestTurns = [{ turnId: "s:1", sessionId: "s", timestamp: data.freshAt, turnIndex: 1,
      character: "max", model: "llm", stt: "stt", tts: null, browser: "Chromium",
      video: "future-video", videoModel: "actual-avatar", videoStatus: "started", videoMs: 1200,
      responseReadyMs: 500, firstSoundMs: 1800, endToEndMs: 5000, sttMs: 100, ragMs: 100, maxMs: 300,
      ttsMs: null, blocker: "video", severity: "slow", fallback: false }];
    render(<LatencyTelemetryTab initialStats={data} />);
    await waitFor(() => expect(mocks.chart).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ label: "Vidéo (voix intégrée)", p50: 1200, p95: 1600, measured: 1 }),
    ])));
    fireEvent.click(screen.getByRole("button", { name: /future-video/ }));
    expect(screen.getByText(/actual-avatar/)).toBeInTheDocument();
    expect(screen.getByText("1.20 s")).toBeInTheDocument();
  });
});
