import { useEffect, useRef, useCallback } from "react";

/**
 * Push-to-talk / Toggle-to-talk hook.
 *
 * mode: "hold" (default) — press = onPress, release = onRelease (mouse/touch/space hold).
 * mode: "toggle" — single click or space tap toggles between onPress / onRelease.
 *
 * Spacebar binding is global; ignored when typing in input/textarea.
 */
export function usePushToTalk(opts: {
  enabled: boolean;
  onPress: () => void;
  onRelease: () => void;
  mode?: "hold" | "toggle";
}) {
  const { enabled, onPress, onRelease, mode = "hold" } = opts;
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

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (holdingRef.current) {
      holdingRef.current = false;
      onRelease();
    } else {
      holdingRef.current = true;
      onPress();
    }
  }, [enabled, onPress, onRelease]);

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
      if (mode === "toggle") toggle();
      else press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (mode === "hold") release();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Safety: if window loses focus while holding (hold mode only), release
    const onBlur = () => {
      if (mode === "hold") release();
    };
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, mode, press, release, toggle]);

  // Handlers to attach to the PTT button
  const buttonHandlers =
    mode === "toggle"
      ? {
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            toggle();
          },
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        }
      : {
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
            if (e.buttons === 0) release();
          },
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };

  return { buttonHandlers, isHolding: holdingRef };
}
