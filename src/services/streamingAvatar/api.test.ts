import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFunctionFetch = vi.hoisted(() => vi.fn());
vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch }));

import { getTavusFaceStatus, trainTavusFace } from "./api";

const face = {
  faceId: "f123",
  name: "Max",
  status: "started",
  trainingProgress: "0/100",
  progressPercent: 0,
  finetuneStatus: null,
  stage: "training",
  errorMessage: null,
  modelName: "phoenix-4.5",
  createdAt: null,
  updatedAt: null,
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(authenticatedFunctionFetch.mock.calls[0][1].body as string);
}

describe("Tavus Face training client", () => {
  beforeEach(() => authenticatedFunctionFetch.mockReset());

  it("starts a training from a stored video", async () => {
    authenticatedFunctionFetch.mockResolvedValue(ok({ provider: "tavus", face }));
    await expect(trainTavusFace({ faceName: "Max", storagePath: "max/take.mp4" })).resolves.toEqual(face);
    const [url, init] = authenticatedFunctionFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/streaming-avatar-session$/);
    expect(init.method).toBe("POST");
    expect(sentBody()).toEqual({
      action: "train-face",
      provider: "tavus",
      faceName: "Max",
      storagePath: "max/take.mp4",
    });
  });

  it("starts a training from a public link", async () => {
    authenticatedFunctionFetch.mockResolvedValue(ok({ provider: "tavus", face }));
    await trainTavusFace({ faceName: "Max", videoUrl: "https://cdn.example.com/v.mp4" });
    expect(sentBody()).toEqual({
      action: "train-face",
      provider: "tavus",
      faceName: "Max",
      videoUrl: "https://cdn.example.com/v.mp4",
    });
  });

  it("surfaces the server error message", async () => {
    authenticatedFunctionFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Training video not found in storage" }), { status: 404 }),
    );
    await expect(trainTavusFace({ faceName: "Max", storagePath: "x.mp4" })).rejects.toThrow(
      "Training video not found in storage",
    );
  });

  it("rejects a response without a Face", async () => {
    authenticatedFunctionFetch.mockResolvedValue(ok({ provider: "tavus" }));
    await expect(trainTavusFace({ faceName: "Max", videoUrl: "https://a.example.com/v.mp4" })).rejects.toThrow(
      "Tavus returned no Face",
    );
  });

  it("reads the status of a Face", async () => {
    const preview = { ...face, status: "completed", stage: "preview", finetuneStatus: "training" };
    authenticatedFunctionFetch.mockResolvedValue(ok({ provider: "tavus", face: preview }));
    await expect(getTavusFaceStatus("f123")).resolves.toEqual(preview);
    expect(sentBody()).toEqual({ action: "face-status", provider: "tavus", faceId: "f123" });
  });

  it("surfaces a status error", async () => {
    authenticatedFunctionFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Tavus Face not found" }), { status: 404 }),
    );
    await expect(getTavusFaceStatus("nope")).rejects.toThrow("Tavus Face not found");
  });
});
