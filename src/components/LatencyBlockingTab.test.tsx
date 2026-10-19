import type { PropsWithChildren } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  excludeSandbox: vi.fn(),
  select: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  lines: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: mocks.select,
    }),
  },
}));
vi.mock("@/components/admin/LLMTokenCostPanel", () => ({ default: () => null }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  LineChart: ({ children, onMouseMove, onMouseLeave }: PropsWithChildren<{
    onMouseMove?: (state: { activeLabel: string; isTooltipActive: boolean }) => void;
    onMouseLeave?: () => void;
  }>) => <div data-testid="evolution-chart" onMouseMove={() => onMouseMove?.({ activeLabel: "#1", isTooltipActive: true })} onMouseLeave={onMouseLeave}>{children}</div>,
  Line: (props: Record<string, unknown>) => { mocks.lines(props); return null; },
  CartesianGrid: () => null, Legend: () => null, ReferenceLine: () => null,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null,
}));

import LatencyBlockingTab from "./LatencyBlockingTab";
import { TooltipProvider } from "./ui/tooltip";

function session(id: string, context: string, startedAt: string) {
  return {
    id,
    name: id,
    context_type: context,
    environment_id: context === "sandbox" ? "sandbox-ulrich" : "prod",
    started_at: startedAt,
    ended_at: "2026-10-14T14:08:30Z",
    duration_seconds: 32,
    game_over_reason: "fin",
    tester_label: null,
    test_invitation_id: null,
    conversation_log: [
      { role: "user", content: "Bonjour", timestamp: 1 },
      { role: "max", content: "Bonjour !", timestamp: 2, pipeline: { max_ms: 800, rag_ms: 100 } },
    ],
    gm_post_turn_log: [],
  };
}

function openTab() {
  return render(<MemoryRouter><TooltipProvider><LatencyBlockingTab /></TooltipProvider></MemoryRouter>);
}

describe("LatencyBlockingTab session scope", () => {
  afterEach(cleanup);
  Element.prototype.scrollIntoView = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    const historical = session("Historical September session", "public", "2026-09-16T12:31:46Z");
    const recent = session("Recent October session", "sandbox", "2026-10-14T14:07:58Z");
    mocks.rows = [recent, historical];
    mocks.select.mockImplementation(() => {
      let limit = Infinity;
      let after = "";
      let exclude = false;
      const query = {
        order: () => query,
        limit: (value: number) => { limit = value; return query; },
        neq: (key: string, value: string) => { mocks.excludeSandbox(key, value); exclude = true; return query; },
        gt: (_key: string, value: string) => { after = value; return query; },
        abortSignal: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
          data: mocks.rows.filter(row => (!exclude || row.context_type !== "sandbox") && String(row.id) > after)
            .sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, limit),
          error: null,
        })),
      };
      return query;
    });
  });

  it("shows the recent sandbox measurements and comparisons on first opening", async () => {
    openTab();

    expect(await screen.findByRole("button", { name: /Recent October session/ })).toBeInTheDocument();
    expect(mocks.excludeSandbox).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getAllByText("sandbox-ulrich").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/2 sélectionnée/)).toBeInTheDocument());
    expect(screen.getAllByText("800 ms").length).toBeGreaterThan(0);
    expect(mocks.lines).toHaveBeenCalled();
    expect(mocks.lines.mock.calls.every(([props]) => props.type === "linear" && props.connectNulls === false)).toBe(true);
  });

  it("shows the measured video provider and avatar in comparisons and evolution", async () => {
    const row = session("Video session", "sandbox", "2026-10-18T12:00:00Z");
    Object.assign(row.conversation_log[1].pipeline, { video_ms: 1250, video_status: "started", max_ms: 300,
      total_ms: 1600, latency_origin: "text_submitted", first_sound_status: "measured",
      segmentServices: { video_ms: { serviceProvider: "future-video", model: "actual-avatar", mode: "webrtc" } } });
    mocks.rows = [row];
    openTab();
    await screen.findByRole("button", { name: /Video session/ });
    expect(screen.getAllByText(/future-video/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/actual-avatar/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.25 s").length).toBeGreaterThan(0);
    expect(screen.getByText(/Évolution temporelle par service/)).toBeInTheDocument();
  });

  it("allows explicit sandbox exclusion and automatically selects the remaining history", async () => {
    openTab();
    await screen.findByRole("button", { name: /Recent October session/ });
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(mocks.excludeSandbox).toHaveBeenCalledWith("context_type", "sandbox"));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Recent October session/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Historical September session/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 sélectionnée/)).toBeInTheDocument());
    expect(screen.getByText(/Les sessions sandbox sont masquées/)).toBeInTheDocument();
  });

  it("shows hover details outside the chart and clears them when leaving", async () => {
    openTab();
    await screen.findByRole("button", { name: /Recent October session/ });
    const chart = screen.getAllByTestId("evolution-chart")[0];
    const panel = screen.getByRole("complementary", { name: "Détails du survol Personnage LLM" });
    expect(within(panel).getByText(/Survole une session/)).toBeInTheDocument();
    fireEvent.mouseMove(chart);
    expect(within(panel).getByText("Historical September session")).toBeInTheDocument();
    expect(within(panel).getAllByText("0.80 s")).toHaveLength(3);
    expect(within(chart).queryByText("Historical September session")).not.toBeInTheDocument();
    fireEvent.mouseLeave(chart.parentElement!);
    expect(within(panel).getByText(/Survole une session/)).toBeInTheDocument();
  });

  it("uses the existing automatic session title instead of the numeric id when no name is saved", async () => {
    const recent = { ...session("512186fe-0000-0000-0000-000000000000", "sandbox", "2026-10-14T14:07:58Z"), name: null };
    mocks.rows = [recent];
    openTab();

    const row = await screen.findByRole("button", { name: /Ulrich · .*test court \(1 tours\), fin : fin/ });
    expect(row).toBeInTheDocument();
    expect(screen.getByTitle(/Ulrich · .*test court \(1 tours\), fin : fin/)).toBeInTheDocument();
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("tester_label, test_invitation_id"));
  });
  it("loads measured sessions beyond the first fifty rows", async () => {
    mocks.rows = Array.from({ length: 105 }, (_, i) => session(`session-${String(i).padStart(3, "0")}`, "public", "2026-05-01T10:00:00Z"));
    openTab();
    expect(await screen.findByRole("button", { name: /session-104/ })).toBeInTheDocument();
    expect(screen.getByText("Sessions (105)")).toBeInTheDocument();
  });

  it("preserves measured first-sound totals instead of replacing them with the sum of overlapping services", async () => {
    const recent = session("Observed first sound", "sandbox", "2026-10-14T14:07:58Z");
    mocks.rows = [{ ...recent, conversation_log: [recent.conversation_log[0], {
      role: "max", content: "Réponse", timestamp: 2,
      pipeline: { rag_ms: 500, max_ms: 1200, tts_first_playback_ms: 600, total_ms: 1850,
        latency_origin: "ptt_finalized", first_sound_status: "measured" },
    }] }];
    openTab();
    expect(await screen.findByRole("button", { name: /Observed first sound.*1[.,]85 s/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Afficher les tours/ }));
    expect(screen.getAllByText("1.85 s").length).toBeGreaterThan(1);
  });

  it("filters the actual turns of a mixed conversation and offers future characters", async () => {
    const mixed = session("Mixed session", "sandbox", "2026-10-14T14:07:58Z");
    mocks.rows = [{ ...mixed, conversation_log: [
      { role: "user", spokenWith: "max", content: "a", timestamp: 1 },
      { role: "max", content: "Max reply", timestamp: 2, pipeline: { max_ms: 800 } },
      { role: "user", spokenWith: "emma", content: "b", timestamp: 3 },
      { role: "emma", spokenWith: "emma", content: "Emma reply", timestamp: 4, pipeline: { max_ms: 300 } },
    ] }];
    openTab();
    await screen.findByRole("button", { name: /Mixed session.*2 tour/ });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrer les latences par personnage" }), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Léo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Emma" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Mixed session.*1 tour.*300 ms/ })).toBeInTheDocument());
    expect(screen.getByText(/Agrégé sur 1 tour/)).toBeInTheDocument();
    expect(screen.getByText(/1 sélectionnée/)).toBeInTheDocument();
  });

});
