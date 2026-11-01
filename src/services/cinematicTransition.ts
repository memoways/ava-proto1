/**
 * Cinematic transition (selection lot 3b).
 *
 * Pure state machine between an accepted director cinematic and the return to
 * the character. The character's reply is never cut: a cinematic decided while
 * the conversation is busy waits for the reply to end; one decided while the
 * player is already speaking is deferred to the end of the next reply. From the
 * announcement on, player input is held (no new turn, no barge-in) until the
 * character is back on screen.
 *
 *   idle → pending → fading_out → playing → closing → fading_in → idle
 *
 * The page owns timers, media and telemetry; this module only decides.
 */

/** Character → black, before the video. */
export const CINEMATIC_FADE_OUT_MS = 700;
/** Black → video, once the player is shown. */
export const CINEMATIC_REVEAL_MS = 400;
/** Video → black, after the video ends or is skipped. */
export const CINEMATIC_CLOSE_MS = 700;
/** Black → character, then listening reopens. */
export const CINEMATIC_FADE_IN_MS = 800;

export type CinematicPhase = "idle" | "pending" | "fading_out" | "playing" | "closing" | "fading_in";
export type CinematicOutcome = "completed" | "skipped" | "error";

export interface CinematicTransitionActive<T> {
  phase: Exclude<CinematicPhase, "idle">;
  video: T;
  decidedAt: number;
  /** Pending only: false while a deferred cinematic lets the player finish speaking. */
  holdInput: boolean;
  /** Replies the cinematic waited for because the player was already speaking. */
  deferrals: number;
  startedAt: number | null;
  outcome: CinematicOutcome | null;
}

export type CinematicTransitionState<T> = { phase: "idle" } | CinematicTransitionActive<T>;

export type CinematicTransitionEvent<T> =
  /** Accepted director cinematic. `conversationBusy`: a turn (and its reply) is in flight. */
  | { type: "decided"; video: T; at: number; conversationBusy: boolean; playerSpeaking: boolean }
  /** A player turn started processing (its reply will follow). */
  | { type: "turn_started" }
  /** No turn in flight and nobody speaking: the reply has really ended. */
  | { type: "conversation_idle" }
  /** The turn whose reply was awaited was abandoned (abort, error, recovery). */
  | { type: "turn_abandoned" }
  | { type: "fade_out_done"; at: number }
  | { type: "video_ended"; outcome: CinematicOutcome }
  | { type: "close_done" }
  | { type: "fade_in_done" }
  /** « Passer » from the pending sign or during the transition. */
  | { type: "skip" }
  /** End of game, handoff to the other character, reset: drop everything now. */
  | { type: "cancel" };

export const CINEMATIC_IDLE: CinematicTransitionState<never> = { phase: "idle" };

export function cinematicTransitionStep<T>(
  state: CinematicTransitionState<T>,
  event: CinematicTransitionEvent<T>,
): CinematicTransitionState<T> {
  if (event.type === "cancel") return CINEMATIC_IDLE;
  if (state.phase === "idle") {
    if (event.type !== "decided") return state;
    const base = { video: event.video, decidedAt: event.at, startedAt: null, outcome: null };
    if (event.conversationBusy) return { ...base, phase: "pending", holdInput: true, deferrals: 0 };
    if (event.playerSpeaking) return { ...base, phase: "pending", holdInput: false, deferrals: 1 };
    return { ...base, phase: "fading_out", holdInput: true, deferrals: 0 };
  }

  switch (event.type) {
    case "turn_started":
      return state.phase === "pending" && !state.holdInput ? { ...state, holdInput: true } : state;
    case "conversation_idle":
      return state.phase === "pending" ? { ...state, phase: "fading_out", holdInput: true } : state;
    case "turn_abandoned":
      return state.phase === "pending" && state.holdInput ? CINEMATIC_IDLE : state;
    case "fade_out_done":
      return state.phase === "fading_out" ? { ...state, phase: "playing", startedAt: event.at } : state;
    case "video_ended":
      return state.phase === "playing" ? { ...state, phase: "closing", outcome: event.outcome } : state;
    case "close_done":
      return state.phase === "closing" ? { ...state, phase: "fading_in" } : state;
    case "fade_in_done":
      return state.phase === "fading_in" ? CINEMATIC_IDLE : state;
    case "skip":
      if (state.phase === "pending") return CINEMATIC_IDLE;
      if (state.phase === "fading_out") return { ...state, phase: "fading_in", outcome: "skipped" };
      if (state.phase === "playing") return { ...state, phase: "closing", outcome: "skipped" };
      return state;
    default:
      return state;
  }
}

/** Player input is held: no new turn, no interruption accepted. */
export function cinematicHoldsInput(state: CinematicTransitionState<unknown>): boolean {
  return state.phase !== "idle" && (state.phase !== "pending" || state.holdInput);
}

/** The video element is shown (and the character screen hidden). */
export function cinematicShowsVideo(state: CinematicTransitionState<unknown>): boolean {
  return state.phase === "playing" || state.phase === "closing";
}

/** Opacity of the black veil above the character or the video. */
export function cinematicVeilOpacity(state: CinematicTransitionState<unknown>): 0 | 1 {
  return state.phase === "fading_out" || state.phase === "closing" ? 1 : 0;
}

/** Duration of the veil fade entering `phase` (playing: black lifts over the video). */
export function cinematicVeilTransitionMs(phase: CinematicPhase): number {
  if (phase === "playing") return CINEMATIC_REVEAL_MS;
  return cinematicPhaseDurationMs(phase) ?? 0;
}

/** Duration of the timed phases; null for phases driven by the conversation or the video. */
export function cinematicPhaseDurationMs(phase: CinematicPhase): number | null {
  if (phase === "fading_out") return CINEMATIC_FADE_OUT_MS;
  if (phase === "closing") return CINEMATIC_CLOSE_MS;
  if (phase === "fading_in") return CINEMATIC_FADE_IN_MS;
  return null;
}

/** The cinematic never reached the screen and was dropped (skip, abandon, cancel). */
export function cinematicDroppedBeforePlayback<T>(
  previous: CinematicTransitionState<T>,
  next: CinematicTransitionState<T>,
): boolean {
  return (previous.phase === "pending" || previous.phase === "fading_out") && (next.phase === "idle" || next.phase === "fading_in");
}
