import type { ExperienceDirectorConfig } from "@/types";

/**
 * GM speech guidance switch (Expérience → Réglages GM).
 *
 * "Speech guidance" is what the post-turn GM tells the character about what to
 * say or how to say it on the next turn: `next_turn_guidance`, the proposed
 * `next_speech_state` and the "already covered" topics attached to it.
 * Turning it off never stops the GM: labels, memory, relationship, cinematics,
 * handoff proposals and end decisions keep running; the GM still computes its
 * advice, which stays visible in the logs but is not sent to the character.
 *
 * The switch is read from the orchestration version pinned to the session, so
 * a session never changes mode midway.
 */

export type GmGuidancePartKind =
  /** `next_turn_guidance` of the previous post-turn: speech guidance. */
  | "gm_advice"
  /** Handoff proposal decided by the GM: the passage between characters. */
  | "handoff_proposal"
  /** Procedure rule when the player asks for the other character. */
  | "switch_request";

export interface GmGuidancePart {
  kind: GmGuidancePartKind;
  text: string;
}

export type GmSpeechGuidanceMode = "on" | "off";

export interface CharacterGuidanceResolution {
  mode: GmSpeechGuidanceMode;
  /** Text injected into the character prompt, null when nothing is left. */
  guidance: string | null;
  topicsCovered: string[];
  /** GM speech state proposal kept for this turn. */
  speechState: string | null;
  /** What the GM produced but the switch kept away from the character. */
  withheld: {
    advice: string | null;
    speechState: string | null;
    topicsCovered: number;
  };
}

/** Absent or anything other than `false` keeps the historical behaviour. */
export function isGmSpeechGuidanceEnabled(config: Pick<ExperienceDirectorConfig, "editor"> | null | undefined): boolean {
  return config?.editor?.speechGuidance !== false;
}

/** Joins the parts exactly as the UI did before the switch existed. */
export function joinGuidanceParts(parts: readonly GmGuidancePart[]): string | null {
  return parts.map((part) => part.text).filter((text) => text?.trim()).join(" ") || null;
}

/**
 * Pure gate applied right before the character prompt is built.
 * `parts` describes where each piece of guidance comes from; callers that only
 * have a plain string (evaluations, replays) pass `legacyGuidance`, which is
 * treated as GM advice.
 */
export function resolveCharacterGuidance(input: {
  enabled: boolean;
  parts?: readonly GmGuidancePart[] | null;
  legacyGuidance?: string | null;
  topicsCovered?: readonly string[] | null;
  speechState?: string | null;
}): CharacterGuidanceResolution {
  const parts: GmGuidancePart[] = input.parts
    ? input.parts.filter((part) => part.text?.trim())
    : input.legacyGuidance?.trim()
      ? [{ kind: "gm_advice", text: input.legacyGuidance }]
      : [];
  const topics = (input.topicsCovered ?? []).filter((topic) => topic?.trim());
  const speechState = input.speechState ?? null;
  if (input.enabled) {
    return {
      mode: "on",
      guidance: joinGuidanceParts(parts),
      topicsCovered: [...topics],
      speechState,
      withheld: { advice: null, speechState: null, topicsCovered: 0 },
    };
  }
  const kept = parts.filter((part) => part.kind !== "gm_advice");
  const advice = joinGuidanceParts(parts.filter((part) => part.kind === "gm_advice"));
  return {
    mode: "off",
    guidance: joinGuidanceParts(kept),
    topicsCovered: [],
    speechState: null,
    withheld: { advice, speechState, topicsCovered: topics.length },
  };
}
