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
 * Overlay mode (« Superposer à la réponse ») is the other presentation: the
 * video replaces the character's image while the reply that motivated it is
 * still being spoken, with its sound lowered. The conversation is never held:
 *
 *   idle → overlay_waiting → overlay_showing → overlay_closing → idle
 *
 * `overlay_waiting` needs both the media playing (muted, hidden) and the reply
 * audible; the reply ending, a player interruption or a missed start deadline
 * drop the video and the character simply goes on.
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
/** Overlay: character → video crossfade once the media plays and the reply is audible. */
export const CINEMATIC_OVERLAY_REVEAL_MS = 400;
/** Overlay: video → character crossfade after the reply, the video or an interruption. */
export const CINEMATIC_OVERLAY_CLOSE_MS = 600;
/** Overlay: from the decision, the media and the voice must both be ready within this delay. */
export const CINEMATIC_OVERLAY_START_DEADLINE_MS = 2_500;

/** « Interrompre la conversation » (current behaviour) or « Superposer à la réponse ». */
export type CinematicPresentation = "interrupt" | "overlay";
export const DEFAULT_CINEMATIC_PRESENTATION: CinematicPresentation = "interrupt";

export type CinematicPhase =
  | "idle" | "pending" | "fading_out" | "playing" | "closing" | "fading_in"
  | "overlay_waiting" | "overlay_showing" | "overlay_closing";
/** `reply_ended`: overlay closed because the reply ended or was interrupted before the video. */
export type CinematicOutcome = "completed" | "skipped" | "error" | "reply_ended";

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
  presentation: CinematicPresentation;
  /** Overlay only: the hidden player is really playing the media. */
  mediaReady: boolean;
  /** Overlay only: the reply is audible. */
  replySpeaking: boolean;
}

export type CinematicTransitionState<T> = { phase: "idle" } | CinematicTransitionActive<T>;

export type CinematicTransitionEvent<T> =
  /** Accepted director cinematic. `conversationBusy`: a turn (and its reply) is in flight. */
  | {
    type: "decided"; video: T; at: number; conversationBusy: boolean; playerSpeaking: boolean;
    /** Default `interrupt`. In overlay mode the page only decides while the reply is in flight. */
    presentation?: CinematicPresentation;
    /** Overlay: the reply is already audible. */
    replySpeaking?: boolean;
  }
  /** Overlay: the hidden player started playing the media. */
  | { type: "media_started"; at: number }
  /** Overlay: the reply became audible. */
  | { type: "reply_speaking"; at: number }
  /** Overlay: the reply is no longer audible (ended, interrupted, failed). */
  | { type: "reply_ended" }
  /** Overlay: media or voice not ready in time; the reply goes on without video. */
  | { type: "start_deadline" }
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
    const presentation = event.presentation ?? DEFAULT_CINEMATIC_PRESENTATION;
    const base = { video: event.video, decidedAt: event.at, startedAt: null, outcome: null, presentation,
      mediaReady: false, replySpeaking: false };
    if (presentation === "overlay") {
      return { ...base, phase: "overlay_waiting", holdInput: false, deferrals: 0, replySpeaking: event.replySpeaking === true };
    }
    if (event.conversationBusy) return { ...base, phase: "pending", holdInput: true, deferrals: 0 };
    if (event.playerSpeaking) return { ...base, phase: "pending", holdInput: false, deferrals: 1 };
    return { ...base, phase: "fading_out", holdInput: true, deferrals: 0 };
  }

  if (state.presentation === "overlay") return overlayStep(state, event);

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

function overlayStep<T>(
  state: CinematicTransitionActive<T>,
  event: CinematicTransitionEvent<T>,
): CinematicTransitionState<T> {
  const close = (outcome: CinematicOutcome): CinematicTransitionState<T> =>
    ({ ...state, phase: "overlay_closing", outcome });
  if (state.phase === "overlay_waiting") {
    switch (event.type) {
      case "media_started":
      case "reply_speaking": {
        const next = { ...state, mediaReady: state.mediaReady || event.type === "media_started",
          replySpeaking: state.replySpeaking || event.type === "reply_speaking" };
        return next.mediaReady && next.replySpeaking ? { ...next, phase: "overlay_showing", startedAt: event.at } : next;
      }
      // Too late or nothing to cover: the video is dropped, the reply goes on.
      case "reply_ended":
      case "conversation_idle":
      case "turn_abandoned":
      case "turn_started":
      case "start_deadline":
      case "video_ended":
      case "skip":
        return CINEMATIC_IDLE;
      default:
        return state;
    }
  }
  if (state.phase === "overlay_showing") {
    switch (event.type) {
      case "reply_ended":
      case "conversation_idle":
      case "turn_abandoned":
      case "turn_started":
        return close("reply_ended");
      case "video_ended":
        return close(event.outcome);
      case "skip":
        return close("skipped");
      default:
        return state;
    }
  }
  if (state.phase === "overlay_closing" && event.type === "close_done") return CINEMATIC_IDLE;
  return state;
}

/** Player input is held: no new turn, no interruption accepted. Never in overlay mode. */
export function cinematicHoldsInput(state: CinematicTransitionState<unknown>): boolean {
  if (state.phase === "idle" || state.presentation === "overlay") return false;
  return state.phase !== "pending" || state.holdInput;
}

/** Overlay mode: the hidden player loads/plays the media (muted until shown). */
export function cinematicOverlayActive(state: CinematicTransitionState<unknown>): boolean {
  return state.phase === "overlay_waiting" || state.phase === "overlay_showing";
}

/** Overlay mode: the video is visible in place of the character. */
export function cinematicOverlayVisible(state: CinematicTransitionState<unknown>): boolean {
  return state.phase === "overlay_showing";
}

/** Any phase of a cinematic in interrupt mode (the conversation is suspended). */
export function cinematicInterruptRunning(state: CinematicTransitionState<unknown>): boolean {
  return state.phase !== "idle" && state.presentation === "interrupt";
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
  if (phase === "overlay_closing") return CINEMATIC_OVERLAY_CLOSE_MS;
  return null;
}

/** The cinematic never reached the screen and was dropped (skip, abandon, cancel). */
export function cinematicDroppedBeforePlayback<T>(
  previous: CinematicTransitionState<T>,
  next: CinematicTransitionState<T>,
): boolean {
  if (previous.phase === "overlay_waiting") return next.phase === "idle";
  return (previous.phase === "pending" || previous.phase === "fading_out") && (next.phase === "idle" || next.phase === "fading_in");
}

/** Normalises the stored setting: anything but « overlay » keeps the current behaviour. */
export function cinematicPresentationFrom(value: unknown): CinematicPresentation {
  return value === "overlay" ? "overlay" : DEFAULT_CINEMATIC_PRESENTATION;
}

/** Default attenuation of the video sound under the voice in overlay mode (to be validated by ear). */
export const DEFAULT_OVERLAY_VIDEO_GAIN_DB = -24;

/** dB attenuation → media element volume (0..1). Clamped to [-60, 0] dB; invalid → default. */
export function overlayVideoVolume(gainDb: unknown): number {
  const db = typeof gainDb === "number" && Number.isFinite(gainDb) ? Math.min(0, Math.max(-60, gainDb)) : DEFAULT_OVERLAY_VIDEO_GAIN_DB;
  return Math.round(10 ** (db / 20) * 1000) / 1000;
}

/** Rough French speech rate used to estimate how long a reply lasts. */
export const OVERLAY_SPEECH_CHARS_PER_SECOND = 15;
/** Below this estimated remaining speech, the overlay would only flash: the reply stays as is. */
export const OVERLAY_MIN_REMAINING_SPEECH_MS = 2_500;

/**
 * Estimated speech still to come for the reply. Unknown text → null (no estimate).
 * `speechStartedAt` null: the reply is not audible yet, the whole text remains.
 */
export function estimatedRemainingSpeechMs(replyText: string | null | undefined, speechStartedAt: number | null, now: number): number | null {
  const length = (replyText ?? "").trim().length;
  if (length === 0) return null;
  const total = (length / OVERLAY_SPEECH_CHARS_PER_SECOND) * 1000;
  const elapsed = speechStartedAt == null ? 0 : Math.max(0, now - speechStartedAt);
  return Math.max(0, Math.round(total - elapsed));
}

/** Overlay is worth starting only if enough of the reply remains (or no estimate exists). */
export function overlayHasTimeToShow(remainingSpeechMs: number | null): boolean {
  return remainingSpeechMs == null || remainingSpeechMs >= OVERLAY_MIN_REMAINING_SPEECH_MS + CINEMATIC_OVERLAY_REVEAL_MS;
}
