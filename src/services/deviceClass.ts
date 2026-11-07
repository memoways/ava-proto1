/**
 * Device class — single source for "which screen is the player on".
 *
 * Rule approved by Ulrich (screen adaptation plan, lot 1):
 *   valid URL override > touch and screen short side < 600 px → smartphone
 *   > touch (including iPad presenting itself as "Macintosh") → tablet > desktop.
 * A narrow desktop window stays desktop: the short side is measured on the
 * screen, never on the window. The class is frozen on first read so a rotation
 * never changes it during a call. Lot 1 only records it; no experience change.
 */

export type DeviceClass = "smartphone" | "tablet" | "desktop";
export type DeviceClassSource = "auto" | "url";

export const DEVICE_CLASSES: readonly DeviceClass[] = ["smartphone", "tablet", "desktop"];
export const DEVICE_CLASS_LABELS: Record<DeviceClass, string> = {
  smartphone: "Smartphone",
  tablet: "Tablette",
  desktop: "Desktop",
};

/** Screens whose short side is below this many CSS pixels are phones. */
export const SMARTPHONE_MAX_SHORT_SIDE_PX = 600;

const OVERRIDE_PARAM = "ecran";
const OVERRIDE_STORAGE_KEY = "ava_device_class_override";
const OVERRIDE_VALUES: Record<string, DeviceClass> = {
  telephone: "smartphone",
  tablette: "tablet",
  desktop: "desktop",
};

export interface DeviceClassInput {
  shortSide: number;
  pointerCoarse: boolean;
  maxTouchPoints: number;
  override?: DeviceClass | null;
}

/** Pure classification; see the module comment for the rule. */
export function classifyDevice({ shortSide, pointerCoarse, maxTouchPoints, override }: DeviceClassInput): DeviceClass {
  if (override && DEVICE_CLASSES.includes(override)) return override;
  // iPadOS reports a "Macintosh" user agent and a fine pointer when a trackpad
  // is attached; more than one touch point still marks a touch device.
  const touch = pointerCoarse || maxTouchPoints > 1;
  if (!touch) return "desktop";
  if (Number.isFinite(shortSide) && shortSide > 0 && shortSide < SMARTPHONE_MAX_SHORT_SIDE_PX) return "smartphone";
  return "tablet";
}

/** Maps `?ecran=telephone|tablette|desktop` to a class; unknown values are ignored. */
export function parseDeviceOverride(value: string | null | undefined): DeviceClass | null {
  if (!value) return null;
  return OVERRIDE_VALUES[value.trim().toLowerCase()] ?? null;
}

/** True when a stored value is one of the three classes (`null` for anything else). */
export function normalizeDeviceClass(value: unknown): DeviceClass | null {
  return typeof value === "string" && (DEVICE_CLASSES as readonly string[]).includes(value) ? value as DeviceClass : null;
}

/** Admin filter value for sessions recorded before the device class existed. */
export const UNKNOWN_DEVICE = "unknown";

/** Device filter key of a session row; missing or invalid classes are "unknown". */
export function sessionDeviceKey(session: { device_class?: string | null }): string {
  return normalizeDeviceClass(session.device_class) ?? UNKNOWN_DEVICE;
}

/** French admin label of a session row's device class. */
export function sessionDeviceLabel(session: { device_class?: string | null }): string {
  const device = normalizeDeviceClass(session.device_class);
  return device ? DEVICE_CLASS_LABELS[device] : "inconnu";
}

/**
 * Reads the override from the URL, else from the tab's sessionStorage, so it
 * survives phase changes that rewrite the URL and a reload that resumes the
 * session in the same tab.
 */
export function readDeviceOverride(search: string = globalThis.location?.search ?? ""): DeviceClass | null {
  const fromUrl = parseDeviceOverride(new URLSearchParams(search).get(OVERRIDE_PARAM));
  try {
    if (fromUrl) {
      globalThis.sessionStorage?.setItem(OVERRIDE_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return normalizeDeviceClass(globalThis.sessionStorage?.getItem(OVERRIDE_STORAGE_KEY));
  } catch {
    return fromUrl;
  }
}

export interface DeviceSnapshot {
  device_class: DeviceClass;
  source: DeviceClassSource;
  viewport_width: number | null;
  viewport_height: number | null;
  screen_short_side: number | null;
  screen_long_side: number | null;
  device_pixel_ratio: number | null;
  orientation: "portrait" | "landscape" | null;
  pointer_coarse: boolean;
  touch: boolean;
  max_touch_points: number;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/**
 * Reads the browser once. Technical values only: no user agent, no address,
 * nothing that identifies the player.
 */
export function readDeviceSnapshot(): DeviceSnapshot {
  const win = globalThis as typeof globalThis & Partial<Window>;
  const screenWidth = finiteOrNull(win.screen?.width);
  const screenHeight = finiteOrNull(win.screen?.height);
  const shortSide = screenWidth != null && screenHeight != null ? Math.min(screenWidth, screenHeight) : null;
  const longSide = screenWidth != null && screenHeight != null ? Math.max(screenWidth, screenHeight) : null;
  let pointerCoarse = false;
  try {
    pointerCoarse = win.matchMedia?.("(pointer: coarse)").matches === true;
  } catch {
    pointerCoarse = false;
  }
  const maxTouchPoints = typeof win.navigator?.maxTouchPoints === "number" ? win.navigator.maxTouchPoints : 0;
  const override = readDeviceOverride();
  const viewportWidth = finiteOrNull(win.innerWidth);
  const viewportHeight = finiteOrNull(win.innerHeight);
  return {
    device_class: classifyDevice({ shortSide: shortSide ?? 0, pointerCoarse, maxTouchPoints, override }),
    source: override ? "url" : "auto",
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    screen_short_side: shortSide,
    screen_long_side: longSide,
    device_pixel_ratio: finiteOrNull(win.devicePixelRatio),
    orientation: viewportWidth != null && viewportHeight != null
      ? (viewportHeight >= viewportWidth ? "portrait" : "landscape")
      : null,
    pointer_coarse: pointerCoarse,
    touch: pointerCoarse || maxTouchPoints > 1,
    max_touch_points: maxTouchPoints,
  };
}

let frozenSnapshot: DeviceSnapshot | null = null;

/** Snapshot frozen on first call for the whole page: a rotation does not reclassify. */
export function getDeviceSnapshot(): DeviceSnapshot {
  if (!frozenSnapshot) frozenSnapshot = readDeviceSnapshot();
  return { ...frozenSnapshot };
}

export function getDeviceClass(): DeviceClass {
  return getDeviceSnapshot().device_class;
}

/** Test helper: forget the frozen snapshot. */
export function resetDeviceClassForTests(): void {
  frozenSnapshot = null;
}
