import type { ExperienceDirectorConfig, PriorityKey, PriorityLevel, PriorityLevels } from "@/types";

/**
 * GM analysis priorities as four 0–3 levels (Réglages GM, lot B).
 * 0 = ignored, 1 = light, 2 = normal (the historical checkbox), 3 = top priority.
 * Pure module (no service imports): shared by the config normalizer, the
 * settings registry and the UI.
 */

export const PRIORITY_KEYS: readonly PriorityKey[] = ["narrative_continuity", "player_engagement", "safety", "pace"];

/** Safety can be dialled down to 1 but never cut. */
export const PRIORITY_SAFETY_FLOOR: PriorityLevel = 1;

export const PRIORITY_AXIS_LABELS: Record<PriorityKey, string> = {
  narrative_continuity: "Continuité narrative",
  player_engagement: "Engagement du joueur",
  safety: "Sécurité",
  pace: "Rythme",
};

/** Short names used by the arbitration rule. */
const PRIORITY_SHORT_NAMES: Record<PriorityKey, string> = {
  narrative_continuity: "continuité narrative",
  player_engagement: "engagement du joueur",
  safety: "sécurité",
  pace: "rythme",
};

/**
 * Exact text sent to the GM per axis and level. Level 2 is the historical
 * wording, unchanged, so a config where every axis sits at 2 compiles to the
 * text that existed before the sliders.
 */
export const PRIORITY_LEVEL_TEXT: Record<PriorityKey, Record<1 | 2 | 3, string>> = {
  narrative_continuity: {
    1: "secondaire : continuité narrative, ne signale une incohérence de faits que si elle est flagrante",
    2: "continuité narrative et cohérence des faits",
    3: "PRIORITAIRE : continuité narrative et cohérence des faits avant tout ; relève chaque écart avec la fiche, la mémoire ou les faits établis et demande au personnage de le corriger au tour suivant",
  },
  player_engagement: {
    1: "secondaire : engagement du joueur, laisse l'échange suivre son cours et ne relance que si le joueur décroche",
    2: "engagement du joueur et qualité de l'échange",
    3: "PRIORITAIRE : engagement du joueur avant tout ; à chaque tour, cherche ce qui le relance (une question ouverte, un écho à ce qu'il vient de dire) et guide le personnage en ce sens",
  },
  safety: {
    1: "secondaire : sécurité, n'interviens que sur un risque net (détresse, faux statut, propos graves) ; ce plancher ne peut pas être coupé",
    2: "sécurité, modération charitable et limites du personnage",
    3: "PRIORITAIRE : sécurité avant tout ; au moindre signe de détresse, de faux statut ou de dérive, recadre ou guide vers une sortie calme dès le tour suivant, même au détriment du rythme",
  },
  pace: {
    1: "secondaire : rythme, n'accélère pas ; laisse la conversation s'étirer et ne signale la clôture qu'au seuil de fin",
    2: "rythme, progression et clôture naturelle dans le temps disponible",
    3: "PRIORITAIRE : rythme avant tout ; fais avancer la scène à chaque tour et signale la clôture dès le seuil atteint",
  },
};

export const PRIORITY_LEVEL_NAMES: Record<PriorityLevel, string> = {
  0: "Ignoré",
  1: "Léger",
  2: "Normal",
  3: "Prioritaire",
};

const DEFAULT_LEVEL: PriorityLevel = 2;

const isPriorityKey = (value: unknown): value is PriorityKey => PRIORITY_KEYS.includes(value as PriorityKey);

function clampLevel(value: unknown): PriorityLevel | null {
  const number = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(3, Math.max(0, Math.round(number))) as PriorityLevel;
}

/**
 * Levels from the stored config. `priorityLevels` wins; otherwise the legacy
 * checkbox list is read (checked → 2, unchecked → 0); absent or empty → all 2.
 * Safety is floored at 1 whatever was stored.
 */
export function normalizePriorityLevels(levels: unknown, legacyPriorities: unknown): PriorityLevels {
  const result = {} as PriorityLevels;
  const stored = levels && typeof levels === "object" && !Array.isArray(levels) ? levels as Record<string, unknown> : null;
  const legacy = Array.isArray(legacyPriorities) ? legacyPriorities.filter(isPriorityKey) : [];
  for (const key of PRIORITY_KEYS) {
    if (stored) result[key] = clampLevel(stored[key]) ?? DEFAULT_LEVEL;
    else if (legacy.length) result[key] = legacy.includes(key) ? 2 : 0;
    else result[key] = DEFAULT_LEVEL;
  }
  if (result.safety < PRIORITY_SAFETY_FLOOR) result.safety = PRIORITY_SAFETY_FLOOR;
  return result;
}

/** Axes with level > 0, highest level first, ties in the fixed axis order. */
function rankedAxes(levels: PriorityLevels): PriorityKey[] {
  return PRIORITY_KEYS
    .filter((key) => levels[key] > 0)
    .sort((a, b) => levels[b] - levels[a] || PRIORITY_KEYS.indexOf(a) - PRIORITY_KEYS.indexOf(b));
}

/** Generated only when the active levels differ; empty otherwise. */
export function arbitrationRule(levels: PriorityLevels): string {
  const ranked = rankedAxes(levels);
  if (new Set(ranked.map((key) => levels[key])).size < 2) return "";
  return `En cas de conflit entre ces priorités, applique d'abord : ${ranked.map((key, index) =>
    `${index ? "puis " : ""}${PRIORITY_SHORT_NAMES[key]} (${levels[key]})`).join(", ")}.`;
}

export function priorityLevelsFragment(config: ExperienceDirectorConfig): string {
  const levels = config.editor.priorityLevels;
  const lines = rankedAxes(levels).map((key) => `- ${PRIORITY_LEVEL_TEXT[key][levels[key] as 1 | 2 | 3]}`);
  const rule = arbitrationRule(levels);
  return `Priorités à appliquer :\n${lines.join("\n")}${rule ? `\n${rule}` : ""}`;
}
