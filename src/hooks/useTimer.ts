import { useState, useEffect, useCallback, useRef } from "react";

export function useTimer(durationSeconds: number, onTimeout: () => void) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isRunning) return;
    if (remaining <= 0) {
      onTimeoutRef.current();
      setIsRunning(false);
      return;
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, remaining]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setRemaining(durationSeconds);
    setIsRunning(false);
  }, [durationSeconds]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = remaining <= 60;

  return { remaining, formatted, isWarning, isRunning, start, pause, reset };
}
