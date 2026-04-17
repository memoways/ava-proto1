import { useEffect, useRef, useCallback } from "react";

/**
 * Push-to-talk hook.
 * - Hold (mouse down / touch start / Space key) → calls onPress (start listening)
 * - Release (mouse up / touch end / Space release) → calls onRelease (finalize)
 *
 * Spacebar binding is global; ignored when typing in input/textarea.
 */
export function usePushToTalk(opts: {
  enabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}) {
  const { enabled, onPress, onRelease } = opts;
  const holdingRef = useRef(false);

  const press = useCallback(() => {
    if (!enabled || holdingRef.current) return;
    holdingRef.current = true;
    onPress();
  }, [enabled, onPress]);

  const release = useCallback(() => {
    if (!enabled || !holdingRef.current) return;
    holdingRef.current = false;
    onRelease();
  }, [enabled, onRelease]);

  // Global Space key binding
  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      release();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Safety: if window loses focus while holding, release
    const onBlur = () => release();
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, press, release]);

  // Pointer handlers to attach to the PTT button
  const buttonHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      press();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      release();
    },
    onPointerCancel: () => release(),
    onPointerLeave: (e: React.PointerEvent) => {
      // Only release if pointer is no longer down
      if (e.buttons === 0) release();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { buttonHandlers, isHolding: holdingRef };
}
