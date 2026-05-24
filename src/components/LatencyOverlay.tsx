import { useEffect, useMemo, useState } from "react";
import { formatLatencyDuration, type LatencySegment } from "@/hooks/useLatencyOverlay";
import { cn } from "@/lib/utils";

interface LatencyOverlayProps {
  enabled: boolean;
  segments: LatencySegment[];
  currentTurn?: number;
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

const ORDER: Record<string, number> = { STT: 0, ASR: 0, RAG: 1, LLM: 2, TTS: 3, Validator: 4, GM: 5 };

export default function LatencyOverlay({ enabled, segments, currentTurn, nowMs }: LatencyOverlayProps) {
  const hasActiveSegment = segments.some((segment) => segment.status === "active");
  const [tick, setTick] = useState(() => performance.now());

  useEffect(() => {
    if (!enabled || !hasActiveSegment || nowMs != null) return;
    const interval = window.setInterval(() => setTick(performance.now()), 250);
    return () => window.clearInterval(interval);
  }, [enabled, hasActiveSegment, nowMs]);

  const renderNow = nowMs ?? tick;

  // Garde uniquement les segments du tour courant, et trie par ordre canonique
  const turnSegments = useMemo(() => {
    if (currentTurn == null) return segments;
    return segments
      .filter((s) => s.turnIndex === currentTurn)
      .sort((a, b) => (ORDER[a.segment] ?? 99) - (ORDER[b.segment] ?? 99) || a.startedAt - b.startedAt);
  }, [segments, currentTurn]);

  if (!enabled || (currentTurn ?? 0) <= 0) return null;

  return (
    <div
      data-testid="latency-overlay"
      className="pointer-events-none fixed bottom-4 left-4 z-40 flex max-w-[20rem] flex-col gap-1.5"
      aria-hidden
    >
      <div className="self-start rounded-md border border-primary/50 bg-primary/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground shadow-lg backdrop-blur-md">
        Tour {currentTurn}
      </div>
      {turnSegments.map((segment) => {
        const durationMs = segment.status === "active"
          ? renderNow - segment.startedAt
          : segment.durationMs ?? ((segment.endedAt ?? renderNow) - segment.startedAt);
        return (
          <div
            key={segment.id}
            className={cn(
              "flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] leading-none shadow-lg shadow-black/20 backdrop-blur-md",
              SEGMENT_STYLES[segment.segment] ?? "border-border/40 bg-background/60 text-foreground",
              segment.status === "active" && "animate-pulse",
            )}
          >
            <span className="font-semibold uppercase tracking-wide">{segment.segment}</span>
            <span className="max-w-[8rem] truncate text-white/72">{segment.service}</span>
            <span className="ml-auto font-mono tabular-nums text-white">{formatLatencyDuration(durationMs)}</span>
          </div>
        );
      })}
    </div>
  );
}
