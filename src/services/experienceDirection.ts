/**
 * Experience curve (Réglages GM, lot E1): pure engine that picks the current
 * "direction" of a call. A direction is a narrative state to reach, never a
 * timed phase: time is only a soft pressure. Code decides, the GM would only
 * receive the result (not wired yet; no prompt, orchestrator or DB change, no
 * AI call). See docs/cadrage_courbe_experience_gm.md.
 */

import { SESSION_MINIMUM_CLOSURE_RATIO } from "@/config/experienceRuntime";
import type { StateAxis, StateLevels } from "@/services/characterState";
import type { RelationshipTier, TopicOpenness } from "@/types/relationship";

export const EXPERIENCE_DIRECTIONS = ["establish", "dig", "weigh", "release", "conclude"] as const;
export type ExperienceDirection = (typeof EXPERIENCE_DIRECTIONS)[number];

/** Editable labels (provisional catalogue, to validate with Romed). */
export const EXPERIENCE_DIRECTION_LABELS: Record<ExperienceDirection, string> = {
  establish: "Établir le contact",
  dig: "Creuser",
  weigh: "Faire peser",
  release: "Relâcher",
  conclude: "Conclure",
};

export type AxisBias = "up" | "down";

/** Soft bias on radar axes: a hint for the GM, never a forced value. */
export const EXPERIENCE_DIRECTION_BIAS: Record<ExperienceDirection, Partial<Record<StateAxis, AxisBias>>> = {
  establish: {},
  dig: { ouverture: "up" },
  weigh: { agitation: "up", lucidite: "up" },
  release: { agitation: "down", lucidite: "up" },
  conclude: { agitation: "down" },
};

const TIER_RANK: Record<RelationshipTier, number> = { contact: 0, link: 1, trust: 2 };
/** Time fraction after which "release" is pressed gently (never forced). */
export const RELEASE_PRESSURE_RATIO = 0.6;

export interface ExperienceSignals {
  /** The caller is in distress, asks for silence or the character is overwhelmed. */
  distress?: boolean;
  offTopic?: boolean;
  hostility?: boolean;
  /** GM or policy reported a natural closing signal. */
  closingSignal?: boolean;
}

export interface ExperienceDirectionInput {
  tier: RelationshipTier;
  topicOpenness: Record<string, TopicOpenness>;
  /** Current radar state; null when the character has no radar. */
  levels: StateLevels | null;
  /** timeElapsedSeconds / sessionDurationSeconds. */
  elapsedRatio: number;
  signals?: ExperienceSignals;
  /** Direction of the previous turn; null at the first turn. */
  previous?: ExperienceDirection | null;
  /** Directions this character must never take (character sheet hint). */
  forbidden?: readonly ExperienceDirection[];
}

export interface ExperienceDirectionResult {
  direction: ExperienceDirection;
  /** True when a non-intervention case held the previous direction. */
  suspended: boolean;
  reason: string;
  bias: Partial<Record<StateAxis, AxisBias>>;
}

const indexOf = (d: ExperienceDirection) => EXPERIENCE_DIRECTIONS.indexOf(d);

function hasTopic(openness: Record<string, TopicOpenness>, min: TopicOpenness): boolean {
  return Object.values(openness).some((v) => (min === "partial" ? v === "partial" || v === "open" : v === "open"));
}

function isEligible(d: ExperienceDirection, input: ExperienceDirectionInput, ratio: number): boolean {
  const tier = TIER_RANK[input.tier];
  const { levels, topicOpenness: topics } = input;
  switch (d) {
    case "establish": return true;
    case "dig": return tier >= 1 && hasTopic(topics, "partial") && (!levels || levels.ouverture >= 2);
    case "weigh": return tier >= 2 && hasTopic(topics, "open") && (!levels || levels.ouverture >= 3);
    case "release":
      return indexOf(input.previous ?? "establish") >= indexOf("dig")
        && ((levels?.agitation ?? 0) >= 4 || ratio >= RELEASE_PRESSURE_RATIO);
    case "conclude":
      return ratio >= SESSION_MINIMUM_CLOSURE_RATIO && (input.signals?.closingSignal === true || input.previous === "release");
  }
}

function result(direction: ExperienceDirection, suspended: boolean, reason: string): ExperienceDirectionResult {
  return { direction, suspended, reason, bias: { ...EXPERIENCE_DIRECTION_BIAS[direction] } };
}

/**
 * Picks the current direction. Rules: relational preconditions first; never
 * skip a direction forward (one step at most) but any step back is allowed;
 * "conclude" never before the closure threshold; non-intervention cases
 * (distress, off-topic, hostility) hold the previous direction.
 */
export function resolveExperienceDirection(input: ExperienceDirectionInput): ExperienceDirectionResult {
  const ratio = Number.isFinite(input.elapsedRatio) ? Math.max(0, input.elapsedRatio) : 0;
  const forbidden = new Set(input.forbidden ?? []);
  const previous = input.previous ?? null;

  const s = input.signals ?? {};
  if (s.distress || s.offTopic || s.hostility) {
    const held = previous && !forbidden.has(previous) ? previous : "establish";
    const why = s.distress ? "détresse" : s.hostility ? "hostilité" : "hors-sujet";
    return result(held, true, `Direction suspendue (${why}) : ${EXPERIENCE_DIRECTION_LABELS[held]} maintenue.`);
  }

  let best = 0;
  EXPERIENCE_DIRECTIONS.forEach((d, i) => {
    if (!forbidden.has(d) && isEligible(d, { ...input, previous }, ratio)) best = i;
  });
  const cap = previous ? indexOf(previous) + 1 : 0;
  let idx = Math.min(best, cap);
  // Highest eligible direction not above the cap ("establish" is always the floor).
  while (idx > 0 && (forbidden.has(EXPERIENCE_DIRECTIONS[idx]) || !isEligible(EXPERIENCE_DIRECTIONS[idx], { ...input, previous }, ratio))) idx -= 1;

  const direction = EXPERIENCE_DIRECTIONS[idx];
  return result(direction, false, `${EXPERIENCE_DIRECTION_LABELS[direction]} : conditions réunies.`);
}
