import type { ExperienceDirectorConfig, GmInjectedToCharacter, GmMode, PRD4PostTurnEvaluation } from "@/types";

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

/**
 * GM mode (lot C) replaces the speech guidance boolean:
 * - full: historical behaviour;
 * - light: the GM runs (memory, relationship, passages, cinematics, end) but its
 *   speech guidance is withheld from the character (former `speechGuidance: false`);
 * - off: no post-turn GM call; the character keeps sheet, RAG, conversation
 *   history and frame; the session ends on the timer; an explicit player request
 *   to change character keeps its procedure rule.
 */
export const GM_MODES: readonly GmMode[] = ["off", "light", "full"];

/** Explicit valid gmMode wins; legacy `speechGuidance: false` is light; anything else is full. */
export function normalizeGmMode(editor: { gmMode?: unknown; speechGuidance?: unknown } | null | undefined): GmMode {
  const mode = editor?.gmMode;
  if (typeof mode === "string" && (GM_MODES as readonly string[]).includes(mode)) return mode as GmMode;
  return editor?.speechGuidance === false ? "light" : "full";
}

export function resolveGmMode(config: { editor?: { gmMode?: unknown; speechGuidance?: unknown } } | null | undefined): GmMode {
  return normalizeGmMode(config?.editor);
}

export interface CharacterGuidanceResolution {
  mode: GmSpeechGuidanceMode;
  /** Text injected into the character prompt, null when nothing is left. */
  guidance: string | null;
  /** Exact GM -> character payload of this turn, as persisted in gm_post_turn_log[].injected. */
  injected: GmInjectedToCharacter;
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

/** Speech guidance reaches the character only in full mode. */
export function isGmSpeechGuidanceEnabled(config: { editor?: { gmMode?: unknown; speechGuidance?: unknown } } | null | undefined): boolean {
  return resolveGmMode(config) === "full";
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
  /** "off" also drops a GM handoff proposal; the player's explicit switch rule stays. */
  gmMode?: GmMode;
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
    const guidance = joinGuidanceParts(parts);
    return {
      mode: "on",
      guidance,
      injected: { text: guidance ?? "", speechState, topicsCovered: [...topics] },
      topicsCovered: [...topics],
      speechState,
      withheld: { advice: null, speechState: null, topicsCovered: 0 },
    };
  }
  const gmOff = input.gmMode === "off";
  const kept = parts.filter((part) => part.kind === "switch_request" || (!gmOff && part.kind !== "gm_advice"));
  const advice = joinGuidanceParts(parts.filter((part) => part.kind === "gm_advice"));
  const keptText = joinGuidanceParts(kept);
  return {
    mode: "off",
    guidance: keptText,
    injected: { text: keptText ?? "", speechState: null, topicsCovered: [] },
    topicsCovered: [],
    speechState: null,
    withheld: { advice, speechState, topicsCovered: topics.length },
  };
}

/**
 * Entry logged for a turn played with GM mode "off": no GM call was made, so
 * nothing but the mode and what the character received is recorded.
 */
export function buildGmOffEvaluation(input: {
  characterKey: NonNullable<PRD4PostTurnEvaluation["character_key"]>;
  turnIndex: number;
  injected: GmInjectedToCharacter;
  orchestrationVersionId: string | null;
  orchestrationConfig: ExperienceDirectorConfig | null;
  /** Lot D: fixed initial state played this turn (no GM, so no evolution). */
  characterState?: import("@/services/characterState").StateLevels | null;
}): PRD4PostTurnEvaluation {
  return {
    engagement_delta: 0,
    confusion_detected: false,
    role_usage_quality: "unknown",
    topics_covered: [],
    transition_recommended: false,
    cinematic_hint: null,
    next_turn_guidance: "",
    end_recommended: false,
    moderation_flag: false,
    notes: "GM désactivé (mode off) : aucun appel post-tour.",
    action: { type: "none" },
    trigger_video_id: null,
    labels: { themes: [], topics: [], intentions: [] },
    memory_delta: null,
    next_speech_state: null,
    player_switch_request: null,
    character_key: input.characterKey,
    turn_index: input.turnIndex,
    latency_ms: 0,
    model: "",
    created_at: new Date().toISOString(),
    execution_status: "skipped",
    execution_reason: "gm_off",
    orchestration_version_id: input.orchestrationVersionId,
    orchestration_config: input.orchestrationConfig,
    speech_guidance: "off",
    gm_mode: "off",
    injected: input.injected,
    ...(input.characterState ? {
      character_state_used: input.characterState,
      character_state_after: input.characterState,
      character_state_applied: {},
    } : {}),
  };
}
