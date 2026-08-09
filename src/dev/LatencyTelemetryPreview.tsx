import LatencyTelemetryTab from "@/components/LatencyTelemetryTab";
import type { PosthogLatencyStats } from "@/services/posthogLatencyStats";

const timeline = [
  ["2026-08-08T09:00:00.000Z", 7, 3120, 4980, 4720, 7290, 17400, 23800],
  ["2026-08-08T13:00:00.000Z", 8, 3380, 5220, 5010, 8120, 18100, 26700],
  ["2026-08-08T17:00:00.000Z", 5, 2960, 4600, 4490, 6930, 16800, 22400],
  ["2026-08-08T21:00:00.000Z", 6, 3650, 5790, 5480, 8840, 20100, 30900],
  ["2026-08-09T01:00:00.000Z", 4, 3210, 4910, 4860, 7610, 18700, 25100],
  ["2026-08-09T05:00:00.000Z", 7, 3890, 6690, 5480, 8360, 20340, 30760],
] as const;

const MOCK_STATS: PosthogLatencyStats = {
  source: "PostHog",
  hasData: true,
  freshAt: "2026-08-09T09:40:16.000Z",
  period: { key: "24h", from: "2026-08-08T09:40:16.000Z", to: "2026-08-09T09:40:16.000Z" },
  dashboardUrl: "https://eu.posthog.com/project/137897/dashboard",
  totals: { sessions: 7, turns: 37, errors: 1, errorRate: 1 / 37, fallbacks: 2, fallbackRate: 2 / 37 },
  latency: {
    responseReady: { p50: 3890, p95: 6690, measured: 37 },
    firstSound: { p50: 5480, p95: 8360, measured: 37 },
    endToEnd: { p50: 20340, p95: 30760, measured: 37 },
    stt: { p50: 620, p95: 2640, measured: 37 },
    rag: { p50: 1110, p95: 2890, measured: 37 },
    max: { p50: 2760, p95: 5630, measured: 37 },
    tts: { p50: 1390, p95: 2360, measured: 37 },
    gmPost: { p50: 2710, p95: 4070, measured: 37 },
  },
  blockers: [{ key: "rag", count: 11 }, { key: "max_llm", count: 8 }, { key: "tts", count: 5 }, { key: "stt", count: 3 }],
  providers: {
    models: [{ key: "openai/gpt-5.6-luna", count: 26 }, { key: "google/gemini-2.5-flash", count: 11 }],
    stt: [{ key: "Deepgram", count: 37 }],
    tts: [{ key: "Gradium", count: 26 }, { key: "ElevenLabs", count: 11 }],
    browsers: [{ key: "Chromium", count: 25 }, { key: "Safari", count: 12 }],
    characters: [{ key: "max", count: 37 }],
  },
  actions: {
    cinematics: { recommended: 9, played: 7, skipped: 2 },
    handoffs: { proposed: 6, accepted: 4, refused: 1, executed: 3, blocked: 1 },
  },
  timeline: timeline.map(([timestamp, turns, responseReadyP50, responseReadyP95, firstSoundP50, firstSoundP95, endToEndP50, endToEndP95]) => ({
    timestamp, turns, responseReadyP50, responseReadyP95, firstSoundP50, firstSoundP95, endToEndP50, endToEndP95,
  })),
  slowestTurns: Array.from({ length: 10 }, (_, index) => ({
    turnId: `turn-preview-${index + 1}`,
    sessionId: `session-92ca7d-${(index % 7) + 1}`,
    timestamp: new Date(Date.parse("2026-08-09T09:31:00.000Z") - index * 9 * 60_000).toISOString(),
    turnIndex: 12 - index,
    character: "max",
    model: index % 3 === 0 ? "google/gemini-2.5-flash" : "openai/gpt-5.6-luna",
    stt: "Deepgram",
    tts: index % 3 === 0 ? "ElevenLabs" : "Gradium",
    browser: index % 4 === 0 ? "Safari" : "Chromium",
    responseReadyMs: 4200 + index * 210,
    firstSoundMs: 5900 + index * 260,
    endToEndMs: 34700 - index * 1150,
    sttMs: 540 + index * 80,
    ragMs: 1480 + index * 130,
    maxMs: 3100 + index * 180,
    ttsMs: 1320 + index * 75,
    blocker: index < 4 ? "rag" : index < 7 ? "max_llm" : "tts",
    severity: index === 0 ? "failed" : "ok",
    fallback: index === 1,
  })),
  turnIds: Array.from({ length: 37 }, (_, index) => `turn-preview-${index + 1}`),
};

export default function LatencyTelemetryPreview() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground lg:p-10">
      <div className="mx-auto max-w-[1680px]">
        <LatencyTelemetryTab initialStats={MOCK_STATS} />
      </div>
    </main>
  );
}
