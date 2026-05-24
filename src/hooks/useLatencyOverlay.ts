import { useCallback, useMemo, useState } from "react";

export type LatencySegmentStatus = "active" | "done";

export interface LatencySegment {
  id: string;
  segment: string;
  service: string;
  status: LatencySegmentStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  turnIndex: number;
}

export interface LatencySegmentEvent {
  segment: string;
  service: string;
}

export function isLatencyOverlayEnabledFromSearch(search: string) {
  return new URLSearchParams(search).has("latence");
}

export function formatLatencyDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds} sec`;
}

export function useLatencyOverlayEnabled() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return isLatencyOverlayEnabledFromSearch(window.location.search);
  }, []);
}

export function useLatencyInstrumentation(enabled: boolean) {
  const [segments, setSegments] = useState<LatencySegment[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);

  /** Démarre un nouveau tour : efface les segments précédents et affiche le nouvel en-tête. */
  const startTurn = useCallback(
    (turnIndex: number) => {
      if (!enabled) return;
      setCurrentTurn(turnIndex);
      setSegments([]);
    },
    [enabled],
  );

  const startSegment = useCallback(
    ({ segment, service }: LatencySegmentEvent) => {
      if (!enabled) return null;
      const now = performance.now();
      const id = `${segment.toLowerCase()}-${Math.round(now)}-${Math.random().toString(36).slice(2, 7)}`;
      setSegments((current) => [
        ...current,
        {
          id,
          segment,
          service,
          status: "active",
          startedAt: now,
          turnIndex: currentTurn,
        },
      ]);
      return id;
    },
    [enabled, currentTurn],
  );

  const endSegment = useCallback(
    (id: string | null | undefined) => {
      if (!enabled || !id) return;
      const now = performance.now();
      setSegments((current) =>
        current.map((segment) => {
          if (segment.id !== id || segment.status === "done") return segment;
          return {
            ...segment,
            status: "done",
            endedAt: now,
            durationMs: Math.round(now - segment.startedAt),
          };
        }),
      );
    },
    [enabled],
  );

  const addCompletedSegment = useCallback(
    ({ segment, service }: LatencySegmentEvent, durationMs: number) => {
      if (!enabled) return null;
      const duration = Math.max(0, Math.round(durationMs));
      const now = performance.now();
      const id = `${segment.toLowerCase()}-${Math.round(now)}-${Math.random().toString(36).slice(2, 7)}`;
      setSegments((current) => [
        ...current,
        {
          id,
          segment,
          service,
          status: "done",
          startedAt: now - duration,
          endedAt: now,
          durationMs: duration,
          turnIndex: currentTurn,
        },
      ]);
      return id;
    },
    [enabled, currentTurn],
  );

  return {
    segments,
    currentTurn,
    startTurn,
    startSegment,
    endSegment,
    addCompletedSegment,
  };
}
