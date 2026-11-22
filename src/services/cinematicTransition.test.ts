import { describe, expect, it } from "vitest";
import {
  CINEMATIC_CLOSE_MS,
  CINEMATIC_FADE_IN_MS,
  CINEMATIC_FADE_OUT_MS,
  CINEMATIC_IDLE,
  CINEMATIC_OVERLAY_CLOSE_MS,
  CINEMATIC_OVERLAY_START_DEADLINE_MS,
  CINEMATIC_REVEAL_MS,
  DEFAULT_OVERLAY_VIDEO_GAIN_DB,
  OVERLAY_MIN_REMAINING_SPEECH_MS,
  OVERLAY_SPEECH_CHARS_PER_SECOND,
  cinematicDroppedBeforePlayback,
  cinematicHoldsInput,
  cinematicInterruptRunning,
  cinematicOverlayActive,
  cinematicOverlayVisible,
  cinematicPhaseDurationMs,
  cinematicPresentationFrom,
  cinematicShowsVideo,
  estimatedRemainingSpeechMs,
  overlayHasTimeToShow,
  overlayVideoVolume,
  cinematicSilencedOnPhone,
  cinematicTransitionStep,
  cinematicVeilOpacity,
  cinematicVeilTransitionMs,
  type CinematicTransitionEvent,
  type CinematicTransitionState,
} from "./cinematicTransition";

type Video = { id: string };
const video: Video = { id: "v1" };
const run = (events: CinematicTransitionEvent<Video>[], from: CinematicTransitionState<Video> = CINEMATIC_IDLE) =>
  events.reduce(cinematicTransitionStep, from);
const decided = (conversationBusy: boolean, playerSpeaking = false): CinematicTransitionEvent<Video> =>
  ({ type: "decided", video, at: 1_000, conversationBusy, playerSpeaking });

describe("cinematicTransitionStep", () => {
  it("decided during the reply waits for its end and holds input at once", () => {
    const pending = run([decided(true)]);
    expect(pending).toMatchObject({ phase: "pending", holdInput: true, deferrals: 0, decidedAt: 1_000 });
    expect(cinematicHoldsInput(pending)).toBe(true);
    expect(cinematicShowsVideo(pending)).toBe(false);
    expect(cinematicVeilOpacity(pending)).toBe(0);
  });

  it("runs the full sequence: reply end → fade out → video → close → fade in → idle", () => {
    const phases: string[] = [];
    let state: CinematicTransitionState<Video> = CINEMATIC_IDLE;
    for (const event of [
      decided(true),
      { type: "conversation_idle" },
      { type: "fade_out_done", at: 2_500 },
      { type: "video_ended", outcome: "completed" },
      { type: "close_done" },
      { type: "fade_in_done" },
    ] as CinematicTransitionEvent<Video>[]) {
      state = cinematicTransitionStep(state, event);
      phases.push(state.phase);
    }
    expect(phases).toEqual(["pending", "fading_out", "playing", "closing", "fading_in", "idle"]);
  });

  it("records the playback start and the outcome", () => {
    const playing = run([decided(true), { type: "conversation_idle" }, { type: "fade_out_done", at: 2_500 }]);
    expect(playing).toMatchObject({ phase: "playing", startedAt: 2_500, outcome: null });
    expect(run([{ type: "video_ended", outcome: "error" }], playing)).toMatchObject({ phase: "closing", outcome: "error" });
  });

  it("decided when nobody speaks starts the fade immediately", () => {
    const state = run([decided(false, false)]);
    expect(state).toMatchObject({ phase: "fading_out", holdInput: true, deferrals: 0 });
    expect(cinematicHoldsInput(state)).toBe(true);
  });

  it("decided while the player speaks never cuts them and defers to the next reply", () => {
    const deferred = run([decided(false, true)]);
    expect(deferred).toMatchObject({ phase: "pending", holdInput: false, deferrals: 1 });
    expect(cinematicHoldsInput(deferred)).toBe(false);

    const announced = run([{ type: "turn_started" }], deferred);
    expect(announced).toMatchObject({ phase: "pending", holdInput: true, deferrals: 1 });
    expect(cinematicHoldsInput(announced)).toBe(true);

    expect(run([{ type: "conversation_idle" }], announced).phase).toBe("fading_out");
  });

  it("a deferred cinematic starts when the player stops without producing a turn", () => {
    expect(run([decided(false, true), { type: "conversation_idle" }]).phase).toBe("fading_out");
  });

  it("an abandoned awaited turn drops the pending cinematic", () => {
    expect(run([decided(true), { type: "turn_abandoned" }])).toBe(CINEMATIC_IDLE);
    // A deferred cinematic does not wait on any turn yet.
    expect(run([decided(false, true), { type: "turn_abandoned" }]).phase).toBe("pending");
    // Once playing, a stale abandon is ignored.
    const playing = run([decided(false), { type: "fade_out_done", at: 2 }]);
    expect(run([{ type: "turn_abandoned" }], playing)).toBe(playing);
  });

  it("skip drops a pending cinematic, and returns through the fades otherwise", () => {
    expect(run([decided(true), { type: "skip" }])).toBe(CINEMATIC_IDLE);
    expect(run([decided(false), { type: "skip" }])).toMatchObject({ phase: "fading_in", outcome: "skipped" });
    expect(run([decided(false), { type: "fade_out_done", at: 2 }, { type: "skip" }])).toMatchObject({ phase: "closing", outcome: "skipped" });
  });

  it("cancel restores idle from every phase", () => {
    const states = [
      run([decided(true)]),
      run([decided(false)]),
      run([decided(false), { type: "fade_out_done", at: 2 }]),
      run([decided(false), { type: "fade_out_done", at: 2 }, { type: "video_ended", outcome: "completed" }]),
      run([decided(false), { type: "fade_out_done", at: 2 }, { type: "video_ended", outcome: "completed" }, { type: "close_done" }]),
    ];
    for (const state of states) {
      const next = run([{ type: "cancel" }], state);
      expect(next).toBe(CINEMATIC_IDLE);
      expect(cinematicHoldsInput(next)).toBe(false);
    }
  });

  it("ignores a second decision while a cinematic is in progress", () => {
    const pending = run([decided(true)]);
    expect(run([{ ...decided(false), video: { id: "v2" } } as CinematicTransitionEvent<Video>], pending)).toBe(pending);
  });

  it("ignores out-of-order events", () => {
    expect(run([{ type: "conversation_idle" }, { type: "fade_out_done", at: 1 }, { type: "skip" }])).toBe(CINEMATIC_IDLE);
    const pending = run([decided(true)]);
    expect(run([{ type: "fade_out_done", at: 1 }, { type: "video_ended", outcome: "completed" }, { type: "fade_in_done" }], pending)).toBe(pending);
  });

  it("holds input from the announcement until the character is back", () => {
    const sequence = [
      decided(true),
      { type: "conversation_idle" },
      { type: "fade_out_done", at: 2 },
      { type: "video_ended", outcome: "skipped" },
      { type: "close_done" },
    ] as CinematicTransitionEvent<Video>[];
    let state: CinematicTransitionState<Video> = CINEMATIC_IDLE;
    for (const event of sequence) {
      state = cinematicTransitionStep(state, event);
      expect(cinematicHoldsInput(state)).toBe(true);
    }
    expect(cinematicHoldsInput(cinematicTransitionStep(state, { type: "fade_in_done" }))).toBe(false);
  });
});

describe("cinematic transition helpers", () => {
  it("shows the video only while playing or closing", () => {
    const playing = run([decided(false), { type: "fade_out_done", at: 2 }]);
    const closing = run([{ type: "video_ended", outcome: "completed" }], playing);
    const fadingIn = run([{ type: "close_done" }], closing);
    expect([playing, closing, fadingIn].map(cinematicShowsVideo)).toEqual([true, true, false]);
    expect([playing, closing, fadingIn].map(cinematicVeilOpacity)).toEqual([0, 1, 0]);
  });

  it("uses the named fade durations", () => {
    expect(cinematicPhaseDurationMs("fading_out")).toBe(CINEMATIC_FADE_OUT_MS);
    expect(cinematicPhaseDurationMs("closing")).toBe(CINEMATIC_CLOSE_MS);
    expect(cinematicPhaseDurationMs("fading_in")).toBe(CINEMATIC_FADE_IN_MS);
    expect(cinematicPhaseDurationMs("pending")).toBeNull();
    expect(cinematicPhaseDurationMs("playing")).toBeNull();
    expect(cinematicVeilTransitionMs("playing")).toBe(CINEMATIC_REVEAL_MS);
    expect(cinematicVeilTransitionMs("idle")).toBe(0);
    for (const ms of [CINEMATIC_FADE_OUT_MS, CINEMATIC_CLOSE_MS, CINEMATIC_FADE_IN_MS]) {
      expect(ms).toBeGreaterThanOrEqual(600);
      expect(ms).toBeLessThanOrEqual(800);
    }
  });

  it("detects a cinematic dropped before playback", () => {
    const pending = run([decided(true)]);
    expect(cinematicDroppedBeforePlayback(pending, run([{ type: "skip" }], pending))).toBe(true);
    const fading = run([decided(false)]);
    expect(cinematicDroppedBeforePlayback(fading, run([{ type: "skip" }], fading))).toBe(true);
    const playing = run([{ type: "fade_out_done", at: 2 }], fading);
    expect(cinematicDroppedBeforePlayback(playing, run([{ type: "cancel" }], playing))).toBe(false);
  });
});

describe("cinematic overlay presentation", () => {
  const overlay = (replySpeaking = true): CinematicTransitionEvent<Video> =>
    ({ type: "decided", video, at: 1_000, conversationBusy: true, playerSpeaking: false, presentation: "overlay", replySpeaking });
  const showing = () => run([overlay(), { type: "media_started", at: 1_400 }]);

  it("waits for the media, then shows over the audible reply without holding input", () => {
    const waiting = run([overlay()]);
    expect(waiting).toMatchObject({ phase: "overlay_waiting", presentation: "overlay", replySpeaking: true, mediaReady: false });
    expect(cinematicHoldsInput(waiting)).toBe(false);
    expect(cinematicOverlayActive(waiting)).toBe(true);
    expect(cinematicOverlayVisible(waiting)).toBe(false);
    expect(cinematicShowsVideo(waiting)).toBe(false);
    expect(cinematicVeilOpacity(waiting)).toBe(0);
    expect(cinematicInterruptRunning(waiting)).toBe(false);

    const shown = showing();
    expect(shown).toMatchObject({ phase: "overlay_showing", startedAt: 1_400 });
    expect(cinematicOverlayVisible(shown)).toBe(true);
    expect(cinematicHoldsInput(shown)).toBe(false);
    expect(cinematicVeilOpacity(shown)).toBe(0);
  });

  it("decided before the voice is audible: shows only once both media and voice are ready", () => {
    const mediaFirst = run([overlay(false), { type: "media_started", at: 1_200 }]);
    expect(mediaFirst).toMatchObject({ phase: "overlay_waiting", mediaReady: true, replySpeaking: false });
    expect(run([{ type: "reply_speaking", at: 1_500 }], mediaFirst)).toMatchObject({ phase: "overlay_showing", startedAt: 1_500 });
  });

  it("drops the video, never the reply, when it cannot show in time", () => {
    for (const event of [
      { type: "start_deadline" },
      { type: "reply_ended" },
      { type: "conversation_idle" },
      { type: "turn_abandoned" },
      { type: "video_ended", outcome: "error" },
      { type: "cancel" },
    ] as CinematicTransitionEvent<Video>[]) {
      const waiting = run([overlay()]);
      const next = run([event], waiting);
      expect(next).toEqual(CINEMATIC_IDLE);
      expect(cinematicDroppedBeforePlayback(waiting, next)).toBe(true);
    }
  });

  it("closes back to the character when the reply ends, the player interrupts or the media ends", () => {
    expect(run([{ type: "reply_ended" }], showing())).toMatchObject({ phase: "overlay_closing", outcome: "reply_ended" });
    expect(run([{ type: "turn_started" }], showing())).toMatchObject({ phase: "overlay_closing", outcome: "reply_ended" });
    expect(run([{ type: "video_ended", outcome: "completed" }], showing())).toMatchObject({ phase: "overlay_closing", outcome: "completed" });
    expect(run([{ type: "video_ended", outcome: "error" }], showing())).toMatchObject({ phase: "overlay_closing", outcome: "error" });
    const closing = run([{ type: "reply_ended" }], showing());
    expect(cinematicOverlayActive(closing)).toBe(false);
    expect(cinematicPhaseDurationMs("overlay_closing")).toBe(CINEMATIC_OVERLAY_CLOSE_MS);
    // A late media end during the crossfade changes nothing; the fade ends at idle.
    expect(run([{ type: "video_ended", outcome: "completed" }], closing)).toBe(closing);
    expect(run([{ type: "close_done" }], closing)).toEqual(CINEMATIC_IDLE);
    expect(cinematicDroppedBeforePlayback(showing(), closing)).toBe(false);
    expect(run([{ type: "cancel" }], showing())).toEqual(CINEMATIC_IDLE);
  });

  it("interrupt mode is unchanged and remains the default", () => {
    expect(run([decided(true)])).toMatchObject({ phase: "pending", presentation: "interrupt" });
    expect(cinematicInterruptRunning(run([decided(true)]))).toBe(true);
    expect(cinematicPresentationFrom(undefined)).toBe("interrupt");
    expect(cinematicPresentationFrom("overlay")).toBe("overlay");
    expect(cinematicPresentationFrom("superpose")).toBe("interrupt");
    // Overlay-only events are ignored by an interrupt cinematic.
    const pending = run([decided(true)]);
    expect(run([{ type: "reply_ended" }, { type: "media_started", at: 2 }, { type: "start_deadline" }], pending)).toBe(pending);
  });
});

describe("overlay sound and timing", () => {
  it("converts the attenuation to a media volume", () => {
    expect(overlayVideoVolume(-15)).toBeCloseTo(0.178, 3);
    expect(overlayVideoVolume(0)).toBe(1);
    expect(overlayVideoVolume(6)).toBe(1);
    expect(overlayVideoVolume(-200)).toBe(0.001);
    expect(overlayVideoVolume("x")).toBe(overlayVideoVolume(DEFAULT_OVERLAY_VIDEO_GAIN_DB));
  });

  it("starts an overlay only when enough of the reply remains", () => {
    const long = "x".repeat(OVERLAY_SPEECH_CHARS_PER_SECOND * 10); // ~10 s of speech
    expect(estimatedRemainingSpeechMs(long, null, 5_000)).toBe(10_000);
    expect(estimatedRemainingSpeechMs(long, 1_000, 5_000)).toBe(6_000);
    expect(estimatedRemainingSpeechMs(long, 0, 20_000)).toBe(0);
    expect(estimatedRemainingSpeechMs("", 0, 1)).toBeNull();
    expect(overlayHasTimeToShow(6_000)).toBe(true);
    expect(overlayHasTimeToShow(OVERLAY_MIN_REMAINING_SPEECH_MS - 1)).toBe(false);
    expect(overlayHasTimeToShow(null)).toBe(true);
    expect(CINEMATIC_OVERLAY_START_DEADLINE_MS).toBeLessThanOrEqual(3_000);
  });
});

describe("smartphone cinematic mute", () => {
  it("silences only a playing cinematic, on a smartphone, when the setting is on", () => {
    expect(cinematicSilencedOnPhone("smartphone", true, true)).toBe(true);
    expect(cinematicSilencedOnPhone("smartphone", true, false)).toBe(false); // teaser / nothing playing
    expect(cinematicSilencedOnPhone("smartphone", false, true)).toBe(false);
    expect(cinematicSilencedOnPhone("smartphone", undefined, true)).toBe(false);
    expect(cinematicSilencedOnPhone("tablet", true, true)).toBe(false);
    expect(cinematicSilencedOnPhone("desktop", true, true)).toBe(false);
  });
});
