import { useState, useEffect, useCallback, useRef } from "react";

export function useTimer(durationSeconds: number, onTimeout: () => void) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  const durationRef = useRef(durationSeconds);
  const isRunningRef = useRef(false);
  onTimeoutRef.current = onTimeout;
  durationRef.current = durationSeconds;

  useEffect(() => {
    if (!isRunningRef.current) setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    if (remaining <= 0) {
      onTimeoutRef.current();
      isRunningRef.current = false;
      setIsRunning(false);
      return;
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, remaining]);

  const start = useCallback(() => {
    isRunningRef.current = true;
    setIsRunning(true);
  }, []);
  const pause = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
  }, []);
  const reset = useCallback((nextDurationSeconds?: number) => {
    isRunningRef.current = false;
    setRemaining(nextDurationSeconds ?? durationRef.current);
    setIsRunning(false);
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = remaining <= 60;

  return { remaining, formatted, isWarning, isRunning, start, pause, reset };
}
