import { useEffect, useMemo, useState } from "react";
import { formatLatencyDuration, type LatencySegment } from "@/hooks/useLatencyOverlay";
import { cn } from "@/lib/utils";

interface LatencyOverlayProps {
  enabled: boolean;
  segments: LatencySegment[];
  nowMs?: number;
}

const SEGMENT_STYLES: Record<string, string> = {
  STT: "border-sky-300/40 bg-sky-500/20 text-sky-50",
  ASR: "border-sky-300/40 bg-sky-500/20 text-sky-50",
  RAG: "border-cyan-300/40 bg-cyan-500/20 text-cyan-50",
  LLM: "border-amber-300/40 bg-amber-500/20 text-amber-50",
  TTS: "border-rose-300/40 bg-rose-500/20 text-rose-50",
  GM: "border-fuchsia-300/40 bg-fuchsia-500/20 text-fuchsia-50",
  Validator: "border-violet-300/40 bg-violet-500/20 text-violet-50",
};

export default function LatencyOverlay({ enabled, segments, nowMs }: LatencyOverlayProps) {
  const hasActiveSegment = segments.some((segment) => segment.status === "active");
  const [tick, setTick] = useState(() => performance.now());

  useEffect(() => {
    if (!enabled || !hasActiveSegment || nowMs != null) return;
    const interval = window.setInterval(() => setTick(performance.now()), 250);
    return () => window.clearInterval(interval);
  }, [enabled, hasActiveSegment, nowMs]);

  const renderNow = nowMs ?? tick;
  const visibleSegments = useMemo(() => segments.slice(-8), [segments]);

  if (!enabled || visibleSegments.length === 0) return null;

  return (
    <div
      data-testid="latency-overlay"
      className="pointer-events-none fixed bottom-[6.75rem] left-3 z-40 flex max-h-[4.25rem] max-w-[calc(100vw-1.5rem)] flex-wrap items-start gap-1.5 overflow-hidden md:bottom-4 md:left-4 md:max-w-[28rem]"
      aria-hidden
    >
      {visibleSegments.map((segment) => {
        const durationMs = segment.status === "active"
          ? renderNow - segment.startedAt
          : segment.durationMs ?? ((segment.endedAt ?? renderNow) - segment.startedAt);
        return (
          <div
            key={segment.id}
            className={cn(
              "flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] leading-none shadow-lg shadow-black/20 backdrop-blur-md",
              SEGMENT_STYLES[segment.segment] ?? "border-border/40 bg-background/60 text-foreground",
            )}
          >
            <span className="font-semibold uppercase tracking-wide">{segment.segment}</span>
            <span className="max-w-[8rem] truncate text-white/72">{segment.service}</span>
            <span className="font-mono tabular-nums text-white">{formatLatencyDuration(durationMs)}</span>
          </div>
        );
      })}
    </div>
  );
}
