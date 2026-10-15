import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  excludeSandbox: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: mocks.select,
    }),
  },
}));
vi.mock("@/services/latencyServiceMetadata", () => ({
  getConfiguredLatencyServices: () => ({}),
}));
vi.mock("@/components/admin/LLMTokenCostPanel", () => ({ default: () => null }));
vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: () => null,
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
  beforeEach(() => {
    vi.clearAllMocks();
    const historical = session("Historical September session", "public", "2026-09-16T12:31:46Z");
    const recent = session("Recent October session", "sandbox", "2026-10-14T14:07:58Z");
    mocks.excludeSandbox.mockResolvedValue({ data: [historical], error: null });
    mocks.select.mockImplementation(() => ({
      order: () => ({
        limit: () => Object.assign(Promise.resolve({ data: [recent, historical], error: null }), {
          neq: mocks.excludeSandbox,
        }),
      }),
    }));
  });

  it("shows the recent sandbox measurements and comparisons on first opening", async () => {
    openTab();

    expect(await screen.findByRole("button", { name: /Recent October session/ })).toBeInTheDocument();
    expect(mocks.excludeSandbox).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getAllByText("sandbox-ulrich").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/2 sélectionnée/)).toBeInTheDocument());
    expect(screen.getAllByText("800 ms").length).toBeGreaterThan(0);
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

  it("uses the existing automatic session title instead of the numeric id when no name is saved", async () => {
    const recent = { ...session("512186fe-0000-0000-0000-000000000000", "sandbox", "2026-10-14T14:07:58Z"), name: null };
    mocks.select.mockReturnValue({ order: () => ({ limit: async () => ({ data: [recent], error: null }) }) });
    openTab();

    const row = await screen.findByRole("button", { name: /Ulrich · .*test court \(1 tours\), fin : fin/ });
    expect(row).toBeInTheDocument();
    expect(screen.getByTitle(/Ulrich · .*test court \(1 tours\), fin : fin/)).toBeInTheDocument();
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("tester_label, test_invitation_id"));
  });
});
