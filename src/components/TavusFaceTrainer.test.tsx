import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TavusFace } from "@/services/streamingAvatar/api";

const mocks = vi.hoisted(() => ({
  listTavusFaces: vi.fn(),
  getTavusFaceStatus: vi.fn(),
  trainTavusFace: vi.fn(),
  uploadTavusTrainingVideo: vi.fn(),
}));

vi.mock("@/services/streamingAvatar/api", () => ({
  listTavusFaces: mocks.listTavusFaces,
  getTavusFaceStatus: mocks.getTavusFaceStatus,
  trainTavusFace: mocks.trainTavusFace,
}));
vi.mock("@/services/gameAuth", () => ({ getCachedSession: vi.fn() }));
vi.mock("tus-js-client", () => ({ Upload: class {} }));
vi.mock("@/services/streamingAvatar/tavusFaceUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/streamingAvatar/tavusFaceUpload")>()),
  uploadTavusTrainingVideo: mocks.uploadTavusTrainingVideo,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TavusFaceTrainer from "./TavusFaceTrainer";

const face = (patch: Partial<TavusFace>): TavusFace => ({
  faceId: "f1",
  name: "Max — test",
  status: "completed",
  trainingProgress: "100/100",
  progressPercent: 100,
  finetuneStatus: null,
  stage: "ready",
  errorMessage: null,
  modelName: "phoenix-4.5",
  createdAt: null,
  updatedAt: null,
  ...patch,
});

const LABELS = { max: "Max", emma: "Emma" };

function renderTrainer(onAssign = vi.fn(), characters = {}) {
  render(<TavusFaceTrainer characters={characters} characterLabels={LABELS} onAssign={onAssign} />);
  return onAssign;
}

const openBlock = () => fireEvent.click(screen.getByText("Entraîner un Face (vidéo)"));

describe("TavusFaceTrainer", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listTavusFaces.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("starts nothing and reads nothing from Tavus until the block is opened", () => {
    renderTrainer();
    expect(mocks.listTavusFaces).not.toHaveBeenCalled();
    expect(mocks.trainTavusFace).not.toHaveBeenCalled();
  });

  it("suggests « Max — date » and keeps training disabled without a source", async () => {
    renderTrainer();
    openBlock();
    expect(await screen.findByLabelText("Nom du Face")).toHaveValue(
      `Max — ${new Date().toISOString().slice(0, 10)}`,
    );
    expect(screen.getByRole("button", { name: "Lancer l'entraînement" })).toBeDisabled();
  });

  it("asks for confirmation before any training and sends the public URL", async () => {
    mocks.trainTavusFace.mockResolvedValue(face({ faceId: "new", name: "Max — x", status: "started", stage: "training", progressPercent: 0 }));
    renderTrainer();
    openBlock();
    fireEvent.change(await screen.findByLabelText(/URL publique/), { target: { value: "https://cdn.example.com/v.mp4" } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer l'entraînement" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(mocks.trainTavusFace).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.trainTavusFace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Lancer l'entraînement" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Lancer l'entraînement" }));
    await waitFor(() => expect(mocks.trainTavusFace).toHaveBeenCalledTimes(1));
    expect(mocks.trainTavusFace).toHaveBeenCalledWith({
      faceName: expect.stringMatching(/^Max — \d{4}-\d{2}-\d{2}$/),
      videoUrl: "https://cdn.example.com/v.mp4",
    });
    expect(await screen.findByText(/Entraînement en cours 0 %/)).toBeInTheDocument();
  });

  it("refuses a link that is not https", async () => {
    renderTrainer();
    openBlock();
    fireEvent.change(await screen.findByLabelText(/URL publique/), { target: { value: "http://cdn.example.com/v.mp4" } });
    expect(screen.getByText(/https:\/\//, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancer l'entraînement" })).toBeDisabled();
  });

  it("refuses a wrong format before uploading anything", async () => {
    renderTrainer();
    openBlock();
    const input = await screen.findByLabelText("Vidéo d'entraînement");
    fireEvent.change(input, { target: { files: [new File(["x"], "take.mov", { type: "video/quicktime" })] } });
    expect(await screen.findByText(/mp4 et le webm/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Téléverser" })).not.toBeInTheDocument();
    expect(mocks.uploadTavusTrainingVideo).not.toHaveBeenCalled();
  });

  it("uploads to the bucket, then trains from the stored path", async () => {
    mocks.uploadTavusTrainingVideo.mockImplementation((_file: File, path: string) => ({
      done: Promise.resolve(path),
      abort: vi.fn(),
    }));
    mocks.trainTavusFace.mockResolvedValue(face({ faceId: "new", status: "started", stage: "training", progressPercent: 0 }));
    renderTrainer();
    openBlock();
    const input = await screen.findByLabelText("Vidéo d'entraînement");
    fireEvent.change(input, { target: { files: [new File(["x"], "take.mp4", { type: "video/mp4" })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Téléverser" }));
    expect(await screen.findByText(/aucun entraînement lancé/)).toBeInTheDocument();
    expect(mocks.uploadTavusTrainingVideo.mock.calls[0][1]).toMatch(/^max\/\d{14}-take\.mp4$/);
    expect(mocks.trainTavusFace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Lancer l'entraînement" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Lancer l'entraînement" }));
    await waitFor(() => expect(mocks.trainTavusFace).toHaveBeenCalledTimes(1));
    expect(mocks.trainTavusFace.mock.calls[0][0]).toMatchObject({ storagePath: expect.stringMatching(/^max\//) });
  });

  it("shows the size-limit message and keeps the URL fallback available", async () => {
    mocks.uploadTavusTrainingVideo.mockImplementation(() => ({
      done: Promise.reject({ originalResponse: { getStatus: () => 413, getBody: () => "" }, message: "tus" }),
      abort: vi.fn(),
    }));
    renderTrainer();
    openBlock();
    fireEvent.change(await screen.findByLabelText("Vidéo d'entraînement"), {
      target: { files: [new File(["x"], "take.mp4", { type: "video/mp4" })] },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Téléverser" }));
    expect(await screen.findByText(/limite de taille d'objet/)).toBeInTheDocument();
    expect(screen.getByLabelText(/URL publique/)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reprendre le téléversement" })).toBeInTheDocument();
  });

  it("lists the Faces, attaches a completed one and refuses one still training", async () => {
    mocks.listTavusFaces.mockResolvedValue([
      face({ faceId: "busy", name: "En cours", status: "started", stage: "training", progressPercent: 40 }),
      face({ faceId: "preview", name: "Aperçu", stage: "preview", finetuneStatus: "training" }),
    ]);
    const onAssign = renderTrainer(vi.fn(), { emma: { faceId: "preview" } });
    openBlock();
    expect(await screen.findByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("Entraînement en cours 40 %")).toBeInTheDocument();
    expect(screen.getByText(/Aperçu filigrané/)).toBeInTheDocument();
    expect(screen.getByText("Attribué à Emma")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: "Attribuer à Max" });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    fireEvent.click(buttons[1]);
    expect(onAssign).toHaveBeenCalledWith("max", "preview");
    expect(mocks.trainTavusFace).not.toHaveBeenCalled();
  });

  it("reports a Tavus read failure and refreshes by hand", async () => {
    mocks.listTavusFaces.mockRejectedValueOnce(new Error("missing TAVUS_API_KEY")).mockResolvedValueOnce([face({ name: "Prêt" })]);
    renderTrainer();
    openBlock();
    expect(await screen.findByText("missing TAVUS_API_KEY")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Rafraîchir/ }));
    expect(await screen.findByText("Prêt", { selector: "p.text-xs" })).toBeInTheDocument();
    expect(mocks.listTavusFaces).toHaveBeenCalledTimes(2);
  });

  it("polls the status every 30 s while a Face is training, then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.listTavusFaces.mockResolvedValue([
        face({ faceId: "busy", name: "En cours", status: "started", stage: "training", progressPercent: 10 }),
      ]);
      mocks.getTavusFaceStatus.mockResolvedValue(face({ faceId: "busy", name: "En cours", status: "completed", stage: "preview" }));
      renderTrainer();
      openBlock();
      await screen.findByText("En cours");
      expect(mocks.getTavusFaceStatus).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(30_000);
      await waitFor(() => expect(mocks.getTavusFaceStatus).toHaveBeenCalledWith("busy"));
      expect(await screen.findByText(/Aperçu prêt/)).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(90_000);
      expect(mocks.getTavusFaceStatus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
