/**
 * Smartphone cinematic framing — pure rules, no DOM.
 *
 * Three experiences, chosen in the back-office (Cinématiques tab), smartphone only:
 *   - "current"   : whole 16:9 frame letterboxed (historical behaviour).
 *   - "portrait"  : native 9:16 — the video fills the full height, the viewer pans
 *                   horizontally with a finger across the width of the film.
 *   - "landscape" : native 16:9 — the viewer is invited (icon only) to turn the phone;
 *                   the film fills the landscape screen.
 * Desktop and tablet never leave "current", whatever the setting says.
 */

import type { DeviceClass } from "@/services/deviceClass";

export type SmartphoneVideoMode = "current" | "portrait" | "landscape";

export const SMARTPHONE_VIDEO_MODES: readonly SmartphoneVideoMode[] = ["current", "portrait", "landscape"];
export const DEFAULT_SMARTPHONE_VIDEO_MODE: SmartphoneVideoMode = "current";
export const SMARTPHONE_VIDEO_MODE_LABELS: Record<SmartphoneVideoMode, string> = {
  current: "Actuel (image entière, bandes noires)",
  portrait: "Vertical 9:16 plein écran (panoramique au doigt)",
  landscape: "Horizontal 16:9 plein écran (tourner le téléphone)",
};

/** Where the pan starts, 0 = left edge of the film, 0.5 = centre, 1 = right edge. */
export const DEFAULT_SMARTPHONE_PAN_START = 0.5;
/** Film ratio used until the media reports its real size. */
export const DEFAULT_VIDEO_ASPECT = 16 / 9;
/** Horizontal finger travel before a touch becomes a pan (keeps taps on the buttons). */
export const PAN_DRAG_THRESHOLD_PX = 6;

export function smartphoneVideoModeFrom(value: unknown): SmartphoneVideoMode {
  return typeof value === "string" && (SMARTPHONE_VIDEO_MODES as readonly string[]).includes(value)
    ? value as SmartphoneVideoMode
    : DEFAULT_SMARTPHONE_VIDEO_MODE;
}

/** Mode actually applied: anything but a smartphone stays on the historical presentation. */
export function effectiveSmartphoneVideoMode(deviceClass: DeviceClass, setting: unknown): SmartphoneVideoMode {
  return deviceClass === "smartphone" ? smartphoneVideoModeFrom(setting) : "current";
}

/** Pan start, clamped to [0, 1]; missing or invalid → centre. */
export function smartphonePanStartFrom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SMARTPHONE_PAN_START;
  return Math.min(1, Math.max(0, value));
}

export interface PanFraming {
  /** Rendered width of the film at full container height. */
  filmWidth: number;
  /** Largest horizontal offset (film wider than the screen); 0 when it fits. */
  maxOffset: number;
  /** Offset (px, film shifted left by this much) putting `focus` at the screen centre. */
  offset: number;
}

/**
 * Film scaled to the full container height; `focus` (0..1 of the film width) is brought to the
 * centre of the screen as far as the edges allow. A film narrower than the screen is centred.
 */
export function computePanFraming(input: {
  containerWidth: number;
  containerHeight: number;
  aspect?: number;
  focus?: number;
}): PanFraming {
  const containerWidth = Math.max(0, Number.isFinite(input.containerWidth) ? input.containerWidth : 0);
  const containerHeight = Math.max(0, Number.isFinite(input.containerHeight) ? input.containerHeight : 0);
  const aspect = typeof input.aspect === "number" && Number.isFinite(input.aspect) && input.aspect > 0
    ? input.aspect
    : DEFAULT_VIDEO_ASPECT;
  const focus = smartphonePanStartFrom(input.focus);
  const filmWidth = containerHeight * aspect;
  const maxOffset = Math.max(0, filmWidth - containerWidth);
  if (maxOffset === 0) return { filmWidth, maxOffset: 0, offset: 0 };
  return { filmWidth, maxOffset, offset: clampPanOffset(focus * filmWidth - containerWidth / 2, maxOffset) };
}

export function clampPanOffset(offset: number, maxOffset: number): number {
  if (!Number.isFinite(offset) || maxOffset <= 0) return 0;
  return Math.min(maxOffset, Math.max(0, offset));
}

/** Dragging the finger right moves the film right, i.e. the offset shrinks. */
export function panOffsetAfterDrag(startOffset: number, dragDx: number, maxOffset: number): number {
  return clampPanOffset(startOffset - dragDx, maxOffset);
}

/** True once the finger has travelled far enough sideways to count as a pan. */
export function isPanDrag(dragDx: number, dragDy: number): boolean {
  return Math.abs(dragDx) >= PAN_DRAG_THRESHOLD_PX && Math.abs(dragDx) > Math.abs(dragDy);
}

/** Landscape experience: the viewer still holds the phone upright. */
export function needsRotationInvite(mode: SmartphoneVideoMode, portraitOrientation: boolean): boolean {
  return mode === "landscape" && portraitOrientation;
}
