import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

const row = (over: Partial<VideoTriggerRow>): VideoTriggerRow => ({
  id: "x", notion_id: "n", title: "t", type: "interlude", themes: [], video_url: "https://v/x",
  context: null, description: null, priority: 1, transition_style: null, post_video_context: null,
  updated_at: null, nature: "transformed", characters: ["all"], ...over,
});

const rows = [
  row({ id: "c1", title: "Rêve lumineux", nature: "transformed" }),
  row({ id: "e1", title: "Procès-verbal", nature: "extract", dialogue: "spoken", transcription: "MAX : Signez ici.", transcription_verified: false }),
  row({ id: "e2", title: "Couloir muet", nature: "extract", dialogue: "silent" }),
  row({ id: "e3", title: "Dialogue inconnu", nature: "extract" }),
];

vi.mock("@/services/videoTriggerService", () => ({
  listVideoTriggers: vi.fn(async () => rows),
  updateVideoTriggerOnNotion: vi.fn(),
  describeVideoWithAi: vi.fn(),
}));
vi.mock("@/services/settingsService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/settingsService")>()),
  loadVideoTriggerSettingsFromDB: vi.fn(async () => (await import("@/services/settingsService")).videoTriggerDefaults),
  loadExtractSettingsFromDB: vi.fn(async () => (await import("@/services/settingsService")).extractDefaults),
}));
vi.mock("@/services/videoSyncHistory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/videoSyncHistory")>()),
  loadVideoSyncHistory: vi.fn(async () => []),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
  },
}));
vi.mock("@/components/CinematicPreview", () => ({ default: () => null }));

import VideoTriggersEditor from "@/components/VideoTriggersEditor";

describe("VideoTriggersEditor sections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only film extracts, with transcript status and their own rules, in the Extraits section", async () => {
    render(<VideoTriggersEditor scope="extracts" />);
    await waitFor(() => expect(screen.getByText("Procès-verbal")).toBeTruthy());
    expect(screen.queryByText("Rêve lumineux")).toBeNull();
    expect(screen.getByText("Couloir muet")).toBeTruthy();
    const statuses = screen.getAllByTestId("extract-transcript-status").map((el) => el.textContent);
    expect(statuses).toEqual(expect.arrayContaining(["Parlé · transcription à vérifier", "Sans dialogue", "Dialogue non renseigné"]));
    expect(screen.getByText("MAX : Signez ici.")).toBeTruthy();
    expect(await screen.findByTestId("extract-rules")).toBeTruthy();
  });

  it("keeps extracts out of the cinematics section", async () => {
    render(<VideoTriggersEditor />);
    await waitFor(() => expect(screen.getByText("Rêve lumineux")).toBeTruthy());
    expect(screen.queryByText("Procès-verbal")).toBeNull();
    expect(screen.queryByTestId("extract-rules")).toBeNull();
  });
});
