import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoDecisionReport } from "@/services/videoDecisionLog";

const report: VideoDecisionReport = {
  sessions: [{
    sessionId: "session-a",
    title: "Ulrich · 20.11.26, 11:00 · Max · échange moyen (8 tours)",
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
        emotions: [],
        stakes: [],
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
        emotions: ["angoisse"],
        stakes: [],
        degraded: true,
      },
    ],
  }],
  turns: [],
  playCounts: [{ videoId: "v1", title: "Max, Emma et Leo suspendus, tension", plays: 17, sessions: 17, lastPlayedAt: "2026-11-21T08:00:00.000Z" }],
  themeFlows: { toVideos: [], evolution: { columns: [], steps: [] } },
  criteria: { turns: 0, played: 0, skipped: 0, byReason: [], confidence: [], linkDetails: [] },
  zeroRows: false,
  truncated: false,
  error: null,
  catalogUnreadable: false,
  themesUnreadable: false,
  vocabulary: { themes: ["famille", "pandémie"], emotions: ["peur"], stakes: ["protéger"], on_screen: ["Max"] },
  vocabularyZeroRows: false,
  vocabularyUnavailable: false,
  vocabularyError: null,
  labelDimensions: { emotion: true, stake: true },
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
    const session = await screen.findByRole("button", { name: /Ulrich · 20.11.26/ });
    expect(session.textContent).toMatch(/1\s+vidéo jouée/);
    expect(screen.queryByText("Tour 3")).toBeNull();
    expect(screen.queryByText("session-a")).toBeNull();
    fireEvent.click(session);
    expect(await screen.findByText("Max, Emma et Leo suspendus, tension")).toBeTruthy();
    expect(screen.getAllByText("Cinématique").length).toBeGreaterThan(0);
    expect(screen.queryByText("Superposition")).toBeNull();
    expect(screen.queryByText("Game Master")).toBeNull();
    expect(screen.getByText("zz_custom_reason")).toBeTruthy();
    expect(screen.getByText("« depuis le chalet » ↔ devant le chalet")).toBeTruthy();
    fireEvent.click(screen.getByText("Tour 3"));
    expect(await screen.findByText(/On est devant le chalet/)).toBeTruthy();
    expect(screen.getByText(/Cinématique montrée pendant que le personnage parle/)).toBeTruthy();
    expect(screen.getByText(/Écartées · espacement trop court/)).toBeTruthy();

    const themesTab = screen.getByRole("tab", { name: "Par thèmes" });
    fireEvent.mouseDown(themesTab);
    fireEvent.click(themesTab);
    expect(screen.getByTestId("video-decision-sankey")).toBeTruthy();
    expect(screen.getByText(/famille · 1 · 50 %/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Évolution des thèmes" }));
    expect(screen.getByText(/Survolez/)).toBeTruthy();

    const criteriaTab = screen.getByRole("tab", { name: "Synthèse" });
    fireEvent.mouseDown(criteriaTab);
    fireEvent.click(criteriaTab);
    expect(screen.getByText("Par motif")).toBeTruthy();
    expect(screen.getByText("Confiance")).toBeTruthy();
    expect(screen.getByText("1 jouée · 1 écartée sur 2")).toBeTruthy();
    expect(screen.getByText("zz_custom_reason")).toBeTruthy();
  });

  it("does not draw a white block when a session stops before the next video", async () => {
    const played = report.sessions[0].turns[0];
    loadVideoDecisions.mockResolvedValue({
      ...report,
      sessions: [
        report.sessions[0],
        {
          ...report.sessions[0],
          sessionId: "session-b",
          title: "Nina · 21.11.26, 12:00 · Emma · échange court (2 tours)",
          turns: [
            { ...played, key: "played-b1", sessionId: "session-b", turnId: "b1", themes: ["famille"] },
            { ...played, key: "played-b2", sessionId: "session-b", turnId: "b2", turnIndex: 5, themes: ["secrets"], createdAt: "2026-11-21T12:05:00.000Z" },
          ],
        },
      ],
    });
    render(<VideoDecisionsTab />);
    const themesTab = await screen.findByRole("tab", { name: "Par thèmes" });
    fireEvent.mouseDown(themesTab);
    fireEvent.click(themesTab);
    fireEvent.click(screen.getByRole("button", { name: "Évolution des thèmes" }));
    const titles = screen.getAllByTestId("sankey-band").map((band) => band.querySelector("title")?.textContent ?? "");
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.some((title) => title.includes("pas de vidéo suivante"))).toBe(false);
    expect(screen.getByTestId("video-decision-sankey").querySelector("path.text-muted-foreground")).toBeNull();
  });

  it("marks a label outside the current list and can switch the Sankey dimension", async () => {
    render(<VideoDecisionsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Ulrich · 20.11.26/ }));
    expect((await screen.findAllByTestId("label-outside")).length).toBeGreaterThan(0);
    const themesTab = screen.getByRole("tab", { name: "Par thèmes" });
    fireEvent.mouseDown(themesTab);
    fireEvent.click(themesTab);
    expect(screen.getByRole("button", { name: "Émotion" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Émotion" }));
    expect(screen.getByRole("button", { name: "Évolution des émotions" })).toBeTruthy();
  });

  it("does not explain a missing vocabulary on the session list", async () => {
    loadVideoDecisions.mockResolvedValue({ ...report, vocabulary: null, vocabularyZeroRows: true, labelDimensions: { emotion: false, stake: false } });
    render(<VideoDecisionsTab />);
    expect(await screen.findByRole("button", { name: /Ulrich · 20.11.26/ })).toBeTruthy();
    expect(screen.queryByText(/vocabulaire/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Émotion" })).toBeNull();
  });

  it("says when the read returned zero rows", async () => {
    loadVideoDecisions.mockResolvedValue({ ...report, sessions: [], turns: [], zeroRows: true, playCounts: [] });
    render(<VideoDecisionsTab />);
    expect(await screen.findByTestId("video-decisions-empty")).toBeTruthy();
    expect(screen.queryByText("jamais jouée")).toBeNull();
  });
});
