import { describe, expect, it } from "vitest";
import type { TavusFace } from "./api";
import {
  assignTavusFace,
  canAssignTavusFace,
  charactersUsingTavusFace,
  hasTavusFaceInProgress,
  isTavusFacePreview,
  mergeTavusFace,
  tavusFaceStageLabel,
} from "./tavusFaceAdmin";

const face = (patch: Partial<TavusFace> = {}): TavusFace => ({
  faceId: "f1",
  name: "Max",
  status: "started",
  trainingProgress: "10/100",
  progressPercent: 10,
  finetuneStatus: null,
  stage: "training",
  errorMessage: null,
  modelName: "phoenix-4.5",
  createdAt: null,
  updatedAt: null,
  ...patch,
});

describe("Face labels and rules", () => {
  it("labels each stage", () => {
    expect(tavusFaceStageLabel(face())).toBe("Entraînement en cours 10 %");
    expect(tavusFaceStageLabel(face({ progressPercent: null, trainingProgress: "3/9" }))).toBe("Entraînement en cours 3/9");
    expect(tavusFaceStageLabel(face({ stage: "preview" }))).toMatch(/filigrané/);
    expect(tavusFaceStageLabel(face({ stage: "ready" }))).toBe("Prêt");
    expect(tavusFaceStageLabel(face({ stage: "tuning_failed" }))).toMatch(/échec/);
    expect(tavusFaceStageLabel(face({ stage: "error" }))).toMatch(/Échec/);
  });

  it("allows an assignment only once training completed", () => {
    expect(canAssignTavusFace(face({ status: "started" }))).toBe(false);
    expect(canAssignTavusFace(face({ status: "error" }))).toBe(false);
    expect(canAssignTavusFace(face({ status: "unknown" }))).toBe(false);
    expect(canAssignTavusFace(face({ status: "completed", stage: "preview" }))).toBe(true);
    expect(canAssignTavusFace(face({ status: "completed", stage: "ready" }))).toBe(true);
  });

  it("flags the watermarked preview", () => {
    expect(isTavusFacePreview(face({ stage: "preview" }))).toBe(true);
    expect(isTavusFacePreview(face({ stage: "tuning_failed" }))).toBe(true);
    expect(isTavusFacePreview(face({ stage: "ready" }))).toBe(false);
  });

  it("polls only while a Face is training", () => {
    expect(hasTavusFaceInProgress([])).toBe(false);
    expect(hasTavusFaceInProgress([face({ status: "completed" }), face({ status: "error" })])).toBe(false);
    expect(hasTavusFaceInProgress([face({ status: "completed" }), face({ status: "started" })])).toBe(true);
  });
});

describe("list and assignment", () => {
  it("merges a Face in place or prepends a new one", () => {
    const list = [face({ faceId: "a" }), face({ faceId: "b" })];
    expect(mergeTavusFace(list, face({ faceId: "b", stage: "ready" })).map((f) => [f.faceId, f.stage])).toEqual([
      ["a", "training"],
      ["b", "ready"],
    ]);
    expect(mergeTavusFace(list, face({ faceId: "c" })).map((f) => f.faceId)).toEqual(["c", "a", "b"]);
    expect(list.map((f) => f.faceId)).toEqual(["a", "b"]);
  });

  it("writes tavus.characters.<key>.faceId without touching other overrides", () => {
    const characters = { max: { echoEmotion: "dejected" as const }, emma: { faceId: "emma-face" } };
    const next = assignTavusFace(characters, "max", "f9");
    expect(next).toEqual({ max: { echoEmotion: "dejected", faceId: "f9" }, emma: { faceId: "emma-face" } });
    expect(characters.max).toEqual({ echoEmotion: "dejected" });
    expect(assignTavusFace({}, "max", "f9")).toEqual({ max: { faceId: "f9" } });
  });

  it("finds who uses a Face", () => {
    expect(charactersUsingTavusFace({ max: { faceId: "f1" }, emma: { faceId: "f2" }, x: {} }, "f1")).toEqual(["max"]);
    expect(charactersUsingTavusFace({}, "f1")).toEqual([]);
  });
});
