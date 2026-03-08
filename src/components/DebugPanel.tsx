import { useState, useEffect, useRef, useCallback } from "react";
import { debugLogger, type DebugLogEntry, type DebugService, type DebugLogLevel } from "@/services/debugLogger";
import { X, Copy, Trash2, ChevronDown, ChevronRight } from "lucide-react";

const SERVICE_COLORS: Record<DebugService, string> = {
  llm: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  tts: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  stt: "bg-green-500/20 text-green-300 border-green-500/30",
  rag: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  notion: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  session: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  gm: "bg-red-500/20 text-red-300 border-red-500/30",
  other: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const LEVEL_INDICATORS: Record<DebugLogLevel, string> = {
  info: "●",
  warn: "⚠",
  error: "✖",
  success: "✓",
};

const LEVEL_COLORS: Record<DebugLogLevel, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
};

const SERVICE_LABELS: Record<DebugService, string> = {
  llm: "LLM",
  tts: "TTS",
  stt: "STT",
  rag: "RAG",
  notion: "Notion",
  session: "Session",
  gm: "Game Master",
  other: "Other",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    "." + String(d.getMilliseconds()).padStart(3, "0");
}

function LogEntry({ entry }: { entry: DebugLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = !!entry.payload || !!entry.detail;

  const copyEntry = useCallback(() => {
    const text = [
      `[${formatTime(entry.timestamp)}] [${entry.service.toUpperCase()}] ${entry.direction === "out" ? "→" : "←"} ${entry.label}`,
      entry.detail ? `  URL: ${entry.detail}` : "",
      entry.durationMs ? `  Duration: ${entry.durationMs}ms` : "",
      entry.payload ? `  Payload:\n${entry.payload}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
  }, [entry]);

  return (
    <div className={`border-l-2 pl-2 py-1.5 text-[11px] font-mono ${
      entry.level === "error" ? "border-l-red-500 bg-red-500/5" :
      entry.level === "warn" ? "border-l-yellow-500 bg-yellow-500/5" :
      entry.level === "success" ? "border-l-green-500/50" :
      "border-l-border/30"
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-1.5 cursor-pointer group" onClick={() => hasPayload && setExpanded(!expanded)}>
        {/* Expand toggle */}
        {hasPayload ? (
          expanded ? <ChevronDown size={10} className="mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight size={10} className="mt-0.5 shrink-0 text-muted-foreground" />
        ) : <span className="w-2.5 shrink-0" />}

        {/* Level indicator */}
        <span className={`shrink-0 ${LEVEL_COLORS[entry.level]}`}>
          {LEVEL_INDICATORS[entry.level]}
        </span>

        {/* Service badge */}
        <span className={`shrink-0 px-1 py-0 rounded text-[9px] border ${SERVICE_COLORS[entry.service]}`}>
          {SERVICE_LABELS[entry.service]}
        </span>

        {/* Direction */}
        <span className="shrink-0 text-muted-foreground/50">
          {entry.direction === "out" ? "→" : "←"}
        </span>

        {/* Label */}
        <span className="text-foreground/80 flex-1 break-all leading-tight">
          {entry.label}
        </span>

        {/* Duration */}
        {entry.durationMs != null && (
          <span className="shrink-0 text-muted-foreground/50">
            {entry.durationMs}ms
          </span>
        )}

        {/* Copy button */}
        <button
          onClick={(e) => { e.stopPropagation(); copyEntry(); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
          title="Copier"
        >
          <Copy size={10} />
        </button>
      </div>

      {/* Time */}
      <div className="text-[9px] text-muted-foreground/40 ml-5 mt-0.5">
        {formatTime(entry.timestamp)}
      </div>

      {/* Expanded detail */}
      {expanded && hasPayload && (
        <div className="mt-1 ml-5 space-y-1">
          {entry.detail && (
            <div className="text-muted-foreground/60 break-all">
              {entry.detail}
            </div>
          )}
          {entry.payload && (
            <pre className="text-[10px] bg-black/30 rounded p-1.5 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground/70 select-all">
              {entry.payload}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function DebugPanel() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [filter, setFilter] = useState<DebugService | "all">("all");
  const [levelFilter, setLevelFilter] = useState<DebugLogLevel | "all">("all");
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const unsub = debugLogger.subscribe(() => {
      setEntries([...debugLogger.getEntries()]);
    });
    setEntries([...debugLogger.getEntries()]);
    return unsub;
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  const filtered = entries.filter(e => {
    if (filter !== "all" && e.service !== filter) return false;
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    return true;
  });

  const copyAll = useCallback(() => {
    const text = filtered.map(e => {
      return `[${formatTime(e.timestamp)}] [${e.service.toUpperCase()}] ${e.direction === "out" ? "→" : "←"} ${e.label}${e.durationMs ? ` (${e.durationMs}ms)` : ""}${e.detail ? `\n  ${e.detail}` : ""}${e.payload ? `\n  ${e.payload.slice(0, 500)}` : ""}`;
    }).join("\n\n");
    navigator.clipboard.writeText(text);
  }, [filtered]);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed top-4 right-4 z-50 px-2 py-1 rounded text-[10px] font-mono bg-black/80 border border-border/30 text-muted-foreground hover:text-foreground backdrop-blur-sm"
      >
        DEBUG ({entries.length})
      </button>
    );
  }

  const services: (DebugService | "all")[] = ["all", "llm", "tts", "stt", "rag", "gm", "notion", "session", "other"];
  const levels: (DebugLogLevel | "all")[] = ["all", "info", "success", "warn", "error"];

  return (
    <div className="fixed top-0 right-0 bottom-0 w-96 z-50 flex flex-col bg-black/95 border-l border-border/30 backdrop-blur-md font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-black/50">
        <span className="text-foreground/80 font-semibold text-xs">
          🔍 Debug Console
          <span className="ml-2 text-muted-foreground/50 font-normal">{filtered.length}/{entries.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <button onClick={copyAll} className="p-1 text-muted-foreground hover:text-foreground" title="Copier tout">
            <Copy size={12} />
          </button>
          <button onClick={() => debugLogger.clear()} className="p-1 text-muted-foreground hover:text-foreground" title="Effacer">
            <Trash2 size={12} />
          </button>
          <button onClick={() => setMinimized(true)} className="p-1 text-muted-foreground hover:text-foreground" title="Minimiser">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-2 py-1.5 border-b border-border/20 space-y-1">
        {/* Service filter */}
        <div className="flex flex-wrap gap-1">
          {services.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                filter === s
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-black/30 text-muted-foreground/50 border-border/20 hover:text-muted-foreground"
              }`}
            >
              {s === "all" ? "Tous" : SERVICE_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Level filter */}
        <div className="flex gap-1">
          {levels.map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                levelFilter === l
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-black/30 text-muted-foreground/50 border-border/20 hover:text-muted-foreground"
              }`}
            >
              {l === "all" ? "Tous" : `${LEVEL_INDICATORS[l]} ${l}`}
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-1 space-y-0.5"
      >
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground/30 py-8 text-xs">
            Aucun message capturé…
          </div>
        ) : (
          filtered.map(entry => <LogEntry key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Footer */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[9px] bg-primary/20 text-primary border border-primary/30 backdrop-blur-sm"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
