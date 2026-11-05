import type { TavusFace } from "./api";
import type { TavusCharacterOverride } from "./types";

export const TAVUS_FACE_POLL_MS = 30_000;

/** Short French status for the admin list. */
export function tavusFaceStageLabel(face: Pick<TavusFace, "stage" | "progressPercent" | "trainingProgress">): string {
  switch (face.stage) {
    case "training": {
      const progress = face.progressPercent !== null ? ` ${face.progressPercent} %` : face.trainingProgress ? ` ${face.trainingProgress}` : "";
      return `Entraînement en cours${progress}`;
    }
    case "preview":
      return "Aperçu prêt (filigrané), affinage en cours";
    case "ready":
      return "Prêt";
    case "tuning_failed":
      return "Aperçu utilisable, affinage en échec";
    case "error":
      return "Échec de l'entraînement";
  }
}

/** Preview, ready or failed tuning can be attached; a Face still training or in error cannot. */
export function canAssignTavusFace(face: Pick<TavusFace, "status">): boolean {
  return face.status === "completed";
}

/** The watermarked preview works for tests but is not the final Face. */
export function isTavusFacePreview(face: Pick<TavusFace, "stage">): boolean {
  return face.stage === "preview" || face.stage === "tuning_failed";
}

/** Polling runs only while a Face is still training (`started`). */
export function hasTavusFaceInProgress(faces: readonly Pick<TavusFace, "status">[]): boolean {
  return faces.some((face) => face.status === "started");
}

/** Replaces (or prepends) one Face in the list, keeping the order of the others. */
export function mergeTavusFace(faces: readonly TavusFace[], face: TavusFace): TavusFace[] {
  const index = faces.findIndex((entry) => entry.faceId === face.faceId);
  if (index < 0) return [face, ...faces];
  const next = [...faces];
  next[index] = face;
  return next;
}

/** Character keys whose per-character Face is this one. */
export function charactersUsingTavusFace(
  characters: Record<string, TavusCharacterOverride>,
  faceId: string,
): string[] {
  return Object.keys(characters).filter((key) => characters[key]?.faceId === faceId);
}

/**
 * Writes `tavus.characters.<key>.faceId` (a copy; other overrides untouched). The admin still
 * has to press the usual « Sauvegarder » to persist it.
 */
export function assignTavusFace(
  characters: Record<string, TavusCharacterOverride>,
  characterKey: string,
  faceId: string,
): Record<string, TavusCharacterOverride> {
  return { ...characters, [characterKey]: { ...(characters[characterKey] ?? {}), faceId } };
}
