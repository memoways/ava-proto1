import type { ExperienceDirectorConfig } from "@/types";

/**
 * Time cues sent to the character (Réglages GM → « Repères de temps du
 * personnage »): elapsed time, turn and a start / middle / end phase. First
 * on/off brick of the experience curve, without deciding its future shape.
 */
export const CHARACTER_TIME_CUE_PHASES = {
  start: "début : installe la relation sans rejouer une ouverture déjà passée",
  middle: "milieu : approfondis selon la confiance acquise",
  end: "fin proche : va à l'essentiel et prépare une sortie naturelle",
} as const;

/** Progress thresholds of the phases (share of the session duration). */
export const CHARACTER_TIME_CUE_THRESHOLDS = { middle: 0.25, end: 0.75 } as const;

export const CHARACTER_TIME_CUE_SUFFIX = "Adapte seulement ton rythme ; ne cite jamais ces repères.";

/** Absent or anything other than `false` keeps the historical behaviour. */
export function isCharacterTimeCuesEnabled(config: Pick<ExperienceDirectorConfig, "editor"> | null | undefined): boolean {
  return config?.editor?.characterTimeCues !== false;
}
