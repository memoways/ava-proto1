import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoDecisionReport } from "@/services/videoDecisionLog";

const report: VideoDecisionReport = {
  sessions: [{
    sessionId: "session-a",
    startedAt: "2026-11-20T10:00:00.000Z",
    turns: [
      {
        key: "played",
        sessionId: "session-a",
        turnIndex: 3,
        turnId: "t1",
        character: "max",
        createdAt: "2026-11-20T10:00:00.000Z",
        mechanism: "overlay",
        outcome: "played",
        reason: null,
        reasonLabel: "jouée",
        videoId: "v1",
        videoTitle: "Max, Emma et Leo suspendus, tension",
        quote: "« depuis le chalet » ↔ devant le chalet",
        confidence: 0.8,
        candidates: [{ id: "v1", title: "Max, Emma et Leo suspendus, tension" }, { id: "v2", title: "Autre" }],
        candidateCount: 2,
        excluded: [{ reason: "cinematic_cooldown", label: "espacement trop court", videoIds: ["v3"] }],
        replyExcerpt: "On est devant le chalet.",
        userExcerpt: "Où es-tu ?",
        linkDetail: null,
        themes: ["famille"],
        topics: ["Ava"],
        degraded: false,
      },
      {
        key: "blocked",
        sessionId: "session-a",
        turnIndex: 4,
        turnId: "t2",
        character: "emma",
        createdAt: "2026-11-20T10:05:00.000Z",
        mechanism: "overlay",
        outcome: "skipped",
        reason: "zz_custom_reason",
        reasonLabel: "zz_custom_reason",
        videoId: null,
        videoTitle: null,
        quote: null,
        confidence: null,
        candidates: [],
        candidateCount: 0,
        excluded: [],
        replyExcerpt: null,
        userExcerpt: null,
        linkDetail: null,
        themes: ["peur"],
        topics: [],
        degraded: true,
      },
    ],
  }],
  turns: [],
  playCounts: [{ videoId: "v1", title: "Max, Emma et Leo suspendus, tension", plays: 17, sessions: 17, lastPlayedAt: "2026-11-21T08:00:00.000Z" }],
  themeFlows: { toVideos: [], evolution: [] },
  criteria: { turns: 0, played: 0, skipped: 0, byReason: [], confidence: [], linkDetails: [] },
  zeroRows: false,
  truncated: false,
  error: null,
  catalogUnreadable: false,
  themesUnreadable: false,
};

const loadVideoDecisions = vi.fn(async () => report);

vi.mock("@/services/videoDecisionLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/videoDecisionLog")>();
  return { ...actual, loadVideoDecisions: () => loadVideoDecisions() };
});

import VideoDecisionsTab from "./VideoDecisionsTab";

describe("VideoDecisionsTab", () => {
  beforeEach(() => {
    loadVideoDecisions.mockReset();
    loadVideoDecisions.mockResolvedValue(report);
  });

  it("renders the three views, the quote and an unknown reason", async () => {
    render(<VideoDecisionsTab />);
    expect(await screen.findByText("Max, Emma et Leo suspendus, tension")).toBeTruthy();
    expect(screen.getByText("zz_custom_reason")).toBeTruthy();
    expect(screen.getByText("« depuis le chalet » ↔ devant le chalet")).toBeTruthy();
    fireEvent.click(screen.getByText("Tour 3"));
    expect(await screen.findByText(/On est devant le chalet/)).toBeTruthy();
    expect(screen.getByText(/Écartées · espacement trop court/)).toBeTruthy();

    const themesTab = screen.getByRole("tab", { name: "Par thèmes" });
    fireEvent.mouseDown(themesTab);
    fireEvent.click(themesTab);
    expect(screen.getByTestId("video-decision-sankey")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Évolution des thèmes" }));
    expect(screen.getByText(/Survolez un flux/)).toBeTruthy();

    const criteriaTab = screen.getByRole("tab", { name: "Synthèse" });
    fireEvent.mouseDown(criteriaTab);
    fireEvent.click(criteriaTab);
    expect(screen.getByText("Par motif")).toBeTruthy();
    expect(screen.getByText("Confiance")).toBeTruthy();
    expect(screen.getByText("1 jouée · 1 écartée sur 2")).toBeTruthy();
    expect(screen.getByText("zz_custom_reason")).toBeTruthy();
  });

  it("says when the read returned zero rows", async () => {
    loadVideoDecisions.mockResolvedValue({ ...report, sessions: [], turns: [], zeroRows: true, playCounts: [] });
    render(<VideoDecisionsTab />);
    expect(await screen.findByTestId("video-decisions-empty")).toBeTruthy();
    expect(screen.queryByText("jamais jouée")).toBeNull();
  });
});
