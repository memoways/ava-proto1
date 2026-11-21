import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

const row = (over: Partial<VideoTriggerRow>): VideoTriggerRow => ({
  id: "x", notion_id: "n", title: "t", type: "interlude", themes: [], video_url: "https://v/x",
  context: null, description: null, priority: 1, transition_style: null, post_video_context: null,
  updated_at: null, nature: "transformed", characters: ["all"], ...over,
});

const rows = [
  row({ id: "c1", title: "Rêve lumineux", nature: "transformed" }),
  row({ id: "e1", video_url: "https://gumlet.tv/watch/6a3177ccb02ffb1d837801ec", title: "Procès-verbal", nature: "extract", dialogue: "spoken", transcription: "MAX : Signez ici.", transcription_verified: false }),
  row({ id: "e2", video_url: "https://gumlet.tv/watch/6a3177ccb02ffb1d837801ec", title: "Couloir muet", nature: "extract", dialogue: "silent" }),
  row({ id: "e3", video_url: "https://gumlet.tv/watch/6a3177ccb02ffb1d837801ec", title: "Dialogue inconnu", nature: "extract" }),
  row({ id: "e4", notion_id: "n4", video_url: "https://gumlet.tv/watch/6a3177ccbf17ac22ca44a8bc", title: "Cuisine parlée", nature: "extract", dialogue: "spoken" }),
];

vi.mock("@/services/videoTriggerService", () => ({
  listVideoTriggers: vi.fn(async () => rows),
  updateVideoTriggerOnNotion: vi.fn(),
  describeVideoWithAi: vi.fn(),
  transcribeVideoWithAi: vi.fn(async (id: string) => ({ ok: true, written: true, notion_id: id, transcription: "Voix 1 : Bonjour.", audio_bytes: 3 })),
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

  it("offers Transcrire only on spoken extracts and says why the others cannot", async () => {
    render(<VideoTriggersEditor scope="extracts" />);
    await waitFor(() => expect(screen.getByText("Cuisine parlée")).toBeTruthy());
    expect(screen.getAllByTestId("extract-transcribe-one").map((b) => b.textContent)).toEqual(["Retranscrire", "Transcrire"]);
    const reasons = screen.getAllByTestId("extract-transcribe-blocked").map((el) => el.textContent);
    expect(reasons).toEqual(expect.arrayContaining([expect.stringMatching(/silencieux/), expect.stringMatching(/non renseigné/)]));
  });

  it("counts spoken extracts without transcription, confirms, then transcribes them", async () => {
    const { transcribeVideoWithAi } = await import("@/services/videoTriggerService");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<VideoTriggersEditor scope="extracts" />);
    const bulk = await screen.findByTestId("extract-transcribe-bulk");
    expect(bulk.textContent).toContain("(1)");
    fireEvent.click(bulk);
    await waitFor(() => expect(transcribeVideoWithAi).toHaveBeenCalledWith("n4", { reanalyze: false }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("1 vidéo(s) envoyée(s) à l'IA"));
    await waitFor(() => expect(screen.getByText("Voix 1 : Bonjour.")).toBeTruthy());
  });

  it("shows no transcription panel in the cinematics section", async () => {
    render(<VideoTriggersEditor />);
    await waitFor(() => expect(screen.getByText("Rêve lumineux")).toBeTruthy());
    expect(screen.queryByTestId("extract-transcribe-panel")).toBeNull();
  });
});
