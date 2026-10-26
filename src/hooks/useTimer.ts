import { useState, useEffect, useCallback, useRef } from 'react';

/** Wall-clock countdown while running; a paused budget has no deadline. */
export function useTimer(durationSeconds: number, onTimeout: () => void) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  const durationRef = useRef(durationSeconds);
  const remainingRef = useRef(durationSeconds);
  const deadlineRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  onTimeoutRef.current = onTimeout;
  durationRef.current = durationSeconds;

  const snapshot = useCallback(() => deadlineRef.current === null ? remainingRef.current
    : Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)), []);
  useEffect(() => {
    if (!initializedRef.current) { remainingRef.current = durationSeconds; setRemaining(durationSeconds); }
  }, [durationSeconds]);
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      if (deadlineRef.current === null) return;
      const next = snapshot();
      remainingRef.current = next;
      setRemaining(next);
      if (next <= 0) {
        deadlineRef.current = null;
        setIsRunning(false);
        onTimeoutRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isRunning, snapshot]);

  const start = useCallback(() => {
    initializedRef.current = true;
    if (deadlineRef.current === null) deadlineRef.current = Date.now() + remainingRef.current * 1000;
    setIsRunning(true);
  }, []);
  const pause = useCallback(() => {
    remainingRef.current = snapshot();
    deadlineRef.current = null;
    setRemaining(remainingRef.current);
    setIsRunning(false);
    return remainingRef.current;
  }, [snapshot]);
  const reset = useCallback((nextDurationSeconds?: number) => {
    initializedRef.current = true;
    deadlineRef.current = null;
    remainingRef.current = nextDurationSeconds ?? durationRef.current;
    setRemaining(remainingRef.current);
    setIsRunning(false);
  }, []);
  const formatted = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
  return { remaining, formatted, isWarning: remaining <= 60, isRunning, start, pause, reset, snapshot };
}
