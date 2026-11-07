import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyDevice,
  getDeviceClass,
  getDeviceSnapshot,
  parseDeviceOverride,
  readDeviceOverride,
  resetDeviceClassForTests,
} from "./deviceClass";

describe("classifyDevice", () => {
  const cases: Array<[string, Parameters<typeof classifyDevice>[0], string]> = [
    ["iPhone portrait 390×844", { shortSide: 390, pointerCoarse: true, maxTouchPoints: 5 }, "smartphone"],
    ["iPhone landscape (screen short side unchanged)", { shortSide: 390, pointerCoarse: true, maxTouchPoints: 5 }, "smartphone"],
    ["small Android 360×780", { shortSide: 360, pointerCoarse: true, maxTouchPoints: 5 }, "smartphone"],
    ["iPad portrait 820×1180", { shortSide: 820, pointerCoarse: true, maxTouchPoints: 5 }, "tablet"],
    ["iPad landscape 1180×820", { shortSide: 820, pointerCoarse: true, maxTouchPoints: 5 }, "tablet"],
    ["iPad as Macintosh with trackpad (fine pointer, touch points)", { shortSide: 1024, pointerCoarse: false, maxTouchPoints: 5 }, "tablet"],
    ["Android tablet 800×1280", { shortSide: 800, pointerCoarse: true, maxTouchPoints: 10 }, "tablet"],
    ["narrow desktop window on a large screen, no touch", { shortSide: 1080, pointerCoarse: false, maxTouchPoints: 0 }, "desktop"],
    ["small non-touch screen stays desktop", { shortSide: 500, pointerCoarse: false, maxTouchPoints: 0 }, "desktop"],
    ["touch laptop screen", { shortSide: 900, pointerCoarse: false, maxTouchPoints: 10 }, "tablet"],
    ["single touch point mouse device", { shortSide: 900, pointerCoarse: false, maxTouchPoints: 1 }, "desktop"],
    ["unknown screen size with touch", { shortSide: 0, pointerCoarse: true, maxTouchPoints: 5 }, "tablet"],
  ];
  it.each(cases)("%s", (_label, input, expected) => {
    expect(classifyDevice(input)).toBe(expected);
  });

  it("applies a valid override before any measurement", () => {
    expect(classifyDevice({ shortSide: 1440, pointerCoarse: false, maxTouchPoints: 0, override: "smartphone" })).toBe("smartphone");
    expect(classifyDevice({ shortSide: 390, pointerCoarse: true, maxTouchPoints: 5, override: "desktop" })).toBe("desktop");
  });
});

describe("parseDeviceOverride", () => {
  it("maps the French URL values", () => {
    expect(parseDeviceOverride("telephone")).toBe("smartphone");
    expect(parseDeviceOverride("TABLETTE")).toBe("tablet");
    expect(parseDeviceOverride("desktop")).toBe("desktop");
  });
  it("ignores unknown values", () => {
    expect(parseDeviceOverride("smartphone")).toBeNull();
    expect(parseDeviceOverride("mobile")).toBeNull();
    expect(parseDeviceOverride("")).toBeNull();
    expect(parseDeviceOverride(null)).toBeNull();
  });
});

describe("readDeviceOverride", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the URL override for the tab, then reads it back without the parameter", () => {
    expect(readDeviceOverride("?ecran=telephone")).toBe("smartphone");
    expect(readDeviceOverride("")).toBe("smartphone");
    expect(readDeviceOverride("?phase=chat")).toBe("smartphone");
  });

  it("ignores an invalid value and keeps an earlier valid one", () => {
    expect(readDeviceOverride("?ecran=tablette")).toBe("tablet");
    expect(readDeviceOverride("?ecran=watch")).toBe("tablet");
  });

  it("returns null without any override", () => {
    expect(readDeviceOverride("?ecran=watch")).toBeNull();
  });
});

describe("getDeviceSnapshot", () => {
  const originalScreen = window.screen;
  const originalMatchMedia = window.matchMedia;

  function setDevice(width: number, height: number, coarse: boolean, touchPoints: number) {
    Object.defineProperty(window, "screen", { configurable: true, value: { width, height } });
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: touchPoints });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(pointer: coarse)" ? coarse : false,
    })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    resetDeviceClassForTests();
  });
  afterEach(() => {
    Object.defineProperty(window, "screen", { configurable: true, value: originalScreen });
    window.matchMedia = originalMatchMedia;
    resetDeviceClassForTests();
  });

  it("classifies from the screen and freezes the result (rotation does not reclassify)", () => {
    setDevice(390, 844, true, 5);
    const first = getDeviceSnapshot();
    expect(first).toMatchObject({
      device_class: "smartphone",
      source: "auto",
      screen_short_side: 390,
      screen_long_side: 844,
      pointer_coarse: true,
      touch: true,
    });
    setDevice(1920, 1080, false, 0);
    expect(getDeviceClass()).toBe("smartphone");
  });

  it("reports the URL source and carries no identifying field", () => {
    setDevice(1920, 1080, false, 0);
    window.history.replaceState(null, "", "/?ecran=telephone");
    const snapshot = getDeviceSnapshot();
    expect(snapshot.device_class).toBe("smartphone");
    expect(snapshot.source).toBe("url");
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/Mozilla|user_?agent|"ip(_address)?"/i);
  });
});
