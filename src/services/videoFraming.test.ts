import { describe, expect, it } from "vitest";
import {
  DEFAULT_SMARTPHONE_PAN_START,
  clampPanOffset,
  computePanFraming,
  effectiveSmartphoneVideoMode,
  isPanDrag,
  needsRotationInvite,
  panOffsetAfterDrag,
  smartphonePanStartFrom,
  smartphoneVideoModeFrom,
} from "./videoFraming";

describe("smartphone video mode", () => {
  it("parses the three modes and falls back to current", () => {
    expect(smartphoneVideoModeFrom("portrait")).toBe("portrait");
    expect(smartphoneVideoModeFrom("landscape")).toBe("landscape");
    expect(smartphoneVideoModeFrom("current")).toBe("current");
    expect(smartphoneVideoModeFrom("nope")).toBe("current");
    expect(smartphoneVideoModeFrom(undefined)).toBe("current");
  });

  it("only applies to smartphones (guard on the device class)", () => {
    expect(effectiveSmartphoneVideoMode("smartphone", "portrait")).toBe("portrait");
    expect(effectiveSmartphoneVideoMode("smartphone", "landscape")).toBe("landscape");
    expect(effectiveSmartphoneVideoMode("tablet", "portrait")).toBe("current");
    expect(effectiveSmartphoneVideoMode("desktop", "landscape")).toBe("current");
    expect(effectiveSmartphoneVideoMode("smartphone", undefined)).toBe("current");
  });

  it("invites to rotate only in landscape mode while upright", () => {
    expect(needsRotationInvite("landscape", true)).toBe(true);
    expect(needsRotationInvite("landscape", false)).toBe(false);
    expect(needsRotationInvite("portrait", true)).toBe(false);
    expect(needsRotationInvite("current", true)).toBe(false);
  });
});

describe("pan framing", () => {
  // iPhone-like portrait screen 390x844: a 16:9 film at full height is ~1500 px wide.
  const screen = { containerWidth: 390, containerHeight: 844 };

  it("scales the film to the full height", () => {
    const framing = computePanFraming({ ...screen });
    expect(framing.filmWidth).toBeCloseTo(844 * (16 / 9), 5);
    expect(framing.maxOffset).toBeCloseTo(framing.filmWidth - 390, 5);
  });

  it("starts on the action point, centred on it", () => {
    const centre = computePanFraming({ ...screen, focus: 0.5 });
    expect(centre.offset).toBeCloseTo(centre.filmWidth / 2 - 195, 5);
    const third = computePanFraming({ ...screen, focus: 0.25 });
    expect(third.offset).toBeCloseTo(third.filmWidth * 0.25 - 195, 5);
  });

  it("clamps a focus near the edges", () => {
    expect(computePanFraming({ ...screen, focus: 0 }).offset).toBe(0);
    const right = computePanFraming({ ...screen, focus: 1 });
    expect(right.offset).toBeCloseTo(right.maxOffset, 5);
  });

  it("uses the real aspect when known", () => {
    const portraitFilm = computePanFraming({ ...screen, aspect: 9 / 16 });
    expect(portraitFilm.filmWidth).toBeCloseTo(844 * 9 / 16, 5);
    expect(portraitFilm.maxOffset).toBeGreaterThanOrEqual(0);
  });

  it("does not pan when the film fits the screen", () => {
    const wide = computePanFraming({ containerWidth: 1000, containerHeight: 300, aspect: 16 / 9 });
    expect(wide.maxOffset).toBe(0);
    expect(wide.offset).toBe(0);
  });

  it("survives invalid sizes", () => {
    expect(computePanFraming({ containerWidth: NaN, containerHeight: 0 })).toEqual({ filmWidth: 0, maxOffset: 0, offset: 0 });
    expect(computePanFraming({ ...screen, aspect: -1 }).filmWidth).toBeCloseTo(844 * (16 / 9), 5);
  });

  it("normalises the pan start", () => {
    expect(smartphonePanStartFrom(0.3)).toBe(0.3);
    expect(smartphonePanStartFrom(-2)).toBe(0);
    expect(smartphonePanStartFrom(9)).toBe(1);
    expect(smartphonePanStartFrom("x")).toBe(DEFAULT_SMARTPHONE_PAN_START);
    expect(smartphonePanStartFrom(NaN)).toBe(DEFAULT_SMARTPHONE_PAN_START);
  });
});

describe("pan drag", () => {
  it("moves the film with the finger and stays inside the film", () => {
    expect(panOffsetAfterDrag(400, 100, 1000)).toBe(300); // finger right → see more of the left
    expect(panOffsetAfterDrag(400, -100, 1000)).toBe(500);
    expect(panOffsetAfterDrag(50, 200, 1000)).toBe(0);
    expect(panOffsetAfterDrag(950, -200, 1000)).toBe(1000);
    expect(clampPanOffset(5, 0)).toBe(0);
  });

  it("treats only a mostly horizontal travel past the threshold as a pan", () => {
    expect(isPanDrag(3, 0)).toBe(false);
    expect(isPanDrag(10, 2)).toBe(true);
    expect(isPanDrag(-10, 2)).toBe(true);
    expect(isPanDrag(8, 30)).toBe(false);
  });
});
