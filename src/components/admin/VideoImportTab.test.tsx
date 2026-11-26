import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideoImportTab from "@/components/admin/VideoImportTab";

const service = vi.hoisted(() => ({ list: vi.fn(), run: vi.fn() }));
vi.mock("@/services/gumletImportService", () => ({
  listMissingGumletVideos: service.list,
  importGumletVideos: service.run,
  gumletImportErrorMessage: (code: string) => code,
}));

const video = (asset_id: string, title: string, status = "ready") => ({
  asset_id, title, status, description: "", duration_s: 65, width: 1920, height: 1080,
  aspect_ratio: "16:9", size_bytes: 1_000_000, folder: "", tags: [], uploaded_at: null, thumbnail_url: null,
});

const READY = "a".repeat(24);
const PENDING = "b".repeat(24);

describe("VideoImportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockResolvedValue({
      videos: [video(READY, "Max dans la neige"), video(PENDING, "En cours", "processing")],
      unreadable: [], total_gumlet: 3, already_in_notion: 1, not_shown: 0,
    });
    service.run.mockResolvedValue({
      created: [{ asset_id: READY, title: "Max dans la neige", notion_url: "https://www.notion.so/page" }],
      skipped: [], failed: [], ignored_properties: [],
    });
  });

  it("imports only the ticked, ready videos", async () => {
    render(<VideoImportTab />);
    const importButton = await screen.findByRole("button", { name: /Importer dans Notion \(0\)/ });
    expect(importButton).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Sélectionner En cours" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Tout cocher/ }));
    fireEvent.click(screen.getByRole("button", { name: /Importer dans Notion \(1\)/ }));

    await waitFor(() => expect(service.run).toHaveBeenCalledWith([READY], {}));
    expect(await screen.findByRole("link", { name: "Max dans la neige" })).toHaveAttribute("href", "https://www.notion.so/page");
  });

  it("shows why the list could not be read", async () => {
    service.list.mockRejectedValue(new Error("La clé API Gumlet n'est pas configurée"));
    render(<VideoImportTab />);
    expect(await screen.findByRole("alert")).toHaveTextContent("clé API Gumlet");
  });

  it("shows the metadata of each video", async () => {
    render(<VideoImportTab />);
    expect(await screen.findAllByText(/1:05 · date inconnue/)).toHaveLength(2);
  });
});
