import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ConversationMessage, ConversationPipelineTimings } from "@/types";

interface SessionRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  conversation_log: ConversationMessage[] | null;
  game_over_reason: string | null;
}

interface TurnTiming extends ConversationPipelineTimings {
  index: number;
  timestamp: number;
  preview: string;
}

interface SessionAggregate {
  session: SessionRow;
  turnCount: number;
  avg: ConversationPipelineTimings;
  max: ConversationPipelineTimings;
  blockerCount: number;
  topBlocker: string | null;
  lastBlocker: { step: string | null; turnIndex: number; preview: string } | null;
  turns: TurnTiming[];
}

type NumericTimingKey = "rag_ms" | "gm_pre_ms" | "max_ms" | "validator_ms" | "tts_ms" | "gm_post_ms" | "total_ms";

const STEP_LABELS: Array<{ key: NumericTimingKey; label: string; color: string }> = [
  { key: "rag_ms", label: "RAG", color: "bg-sky-500" },
  { key: "gm_pre_ms", label: "GM pre-turn", color: "bg-violet-500" },
  { key: "max_ms", label: "Max LLM", color: "bg-emerald-500" },
  { key: "validator_ms", label: "Validateur", color: "bg-amber-500" },
  { key: "tts_ms", label: "TTS", color: "bg-rose-500" },
  { key: "gm_post_ms", label: "GM post-turn", color: "bg-fuchsia-500" },
];

function fmtMs(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(2)} s`;
}

const STEP_HEX: Record<NumericTimingKey, string> = {
  rag_ms: "#0ea5e9",       // sky-500
  gm_pre_ms: "#8b5cf6",    // violet-500
  max_ms: "#10b981",       // emerald-500
  validator_ms: "#f59e0b", // amber-500
  tts_ms: "#f43f5e",       // rose-500
  gm_post_ms: "#d946ef",   // fuchsia-500
  total_ms: "#6366f1",
};

const TARGET_MS = 2000;

interface StackedRowProps {
  label: string;
  values: ConversationPipelineTimings;
  scaleMax: number;
  target?: number;
}

function StackedRow({ label, values, scaleMax, target }: StackedRowProps) {
  const total = STEP_LABELS.reduce((acc, { key }) => acc + (values[key] ?? 0), 0);
  const denom = Math.max(scaleMax, total, 1);
  const targetPct = target ? Math.min(100, (target / denom) * 100) : null;
  const overTarget = target ? total > target : false;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono font-semibold ${overTarget ? "text-destructive" : "text-foreground"}`}>
          {fmtMs(total)}
        </span>
      </div>
      <div className="relative h-6 w-full bg-muted/40 rounded overflow-hidden">
        <div className="absolute inset-0 flex">
          {STEP_LABELS.map(({ key, label: stepLabel }) => {
            const v = values[key] ?? 0;
            if (v <= 0) return null;
            const pct = (v / denom) * 100;
            return (
              <div
                key={key}
                className="h-full flex items-center justify-center text-[10px] text-white/95 font-medium overflow-hidden"
                style={{ width: `${pct}%`, backgroundColor: STEP_HEX[key] }}
                title={`${stepLabel}: ${fmtMs(v)}`}
              >
                {pct > 8 ? stepLabel : ""}
              </div>
            );
          })}
        </div>
        {targetPct !== null && (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-destructive"
              style={{ left: `${targetPct}%` }}
            />
            <div
              className="absolute -top-0.5 w-2 h-2 rounded-full bg-destructive -translate-x-1/2"
              style={{ left: `${targetPct}%` }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function LatencyVisualization({
  avg,
  max,
  turns,
  showRelative = true,
  perSessionRows,
}: {
  avg: ConversationPipelineTimings;
  max: ConversationPipelineTimings;
  turns: TurnTiming[];
  showRelative?: boolean;
  perSessionRows?: Array<{ id: string; label: string; avg: ConversationPipelineTimings }>;
}) {
  const bestTurn = turns.reduce<TurnTiming | null>((best, t) => {
    if (typeof t.total_ms !== "number") return best;
    if (!best || (best.total_ms ?? Infinity) > t.total_ms) return t;
    return best;
  }, null);
  const bestTotal = bestTurn?.total_ms ?? 0;
  const avgTotal = avg.total_ms ?? 0;
  const maxTotal = max.total_ms ?? 0;
  const scaleMax = Math.max(maxTotal, avgTotal, bestTotal, TARGET_MS) * 1.05;

  const onTarget = avgTotal > 0 && avgTotal <= TARGET_MS;

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Latence estimée &amp; répartition</h3>
          <p className="text-xs text-muted-foreground">
            Vue relative et absolue des étapes du pipeline. Cible : &lt; {TARGET_MS / 1000}s end-to-end.
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <div>
            <div className="text-muted-foreground">Best case</div>
            <div className="font-mono font-bold text-base text-emerald-500">{fmtMs(bestTotal)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Moyen</div>
            <div className="font-mono font-bold text-base">{fmtMs(avgTotal)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Pire</div>
            <div className="font-mono font-bold text-base text-destructive">{fmtMs(maxTotal)}</div>
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              onTarget
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {onTarget ? `✓ Cible <${TARGET_MS / 1000}s` : `✗ Au-dessus de ${TARGET_MS / 1000}s`}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {bestTurn && <StackedRow label="Best case" values={bestTurn} scaleMax={scaleMax} target={TARGET_MS} />}
        <StackedRow label="Moyen" values={avg} scaleMax={scaleMax} target={TARGET_MS} />
        <StackedRow label="Pire" values={max} scaleMax={scaleMax} target={TARGET_MS} />
      </div>

      {/* Per-session comparison rows */}
      {perSessionRows && perSessionRows.length > 0 && (
        <div className="mt-5 pt-4 border-t">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Comparaison par session ({perSessionRows.length})
          </div>
          <div className="space-y-2">
            {perSessionRows.map((row) => (
              <StackedRow
                key={row.id}
                label={row.label}
                values={row.avg}
                scaleMax={scaleMax}
                target={TARGET_MS}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {STEP_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: STEP_HEX[key] }}
            />
            <span className="text-muted-foreground">{label} :</span>
            <span className="font-mono">{fmtMs(avg[key])}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-destructive" />
          <span className="text-destructive">cible {TARGET_MS / 1000}s</span>
        </div>
      </div>

      {/* Cost breakdown (relative share of average pipeline) */}
      {avgTotal > 0 && (
        <div className="mt-4">
          <div className="text-xs text-muted-foreground mb-1">Répartition relative (moyenne)</div>
          <div className="flex h-3 w-full rounded overflow-hidden">
            {STEP_LABELS.map(({ key, label }) => {
              const v = avg[key] ?? 0;
              if (v <= 0) return null;
              const pct = (v / avgTotal) * 100;
              return (
                <div
                  key={key}
                  style={{ width: `${pct}%`, backgroundColor: STEP_HEX[key] }}
                  title={`${label}: ${pct.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px]">
            {STEP_LABELS.map(({ key, label }) => {
              const v = avg[key] ?? 0;
              if (v <= 0) return null;
              const pct = (v / avgTotal) * 100;
              return (
                <span key={key} className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ backgroundColor: STEP_HEX[key] }}
                  />
                  <span className="text-muted-foreground">{label} :</span>
                  <span className="font-mono">{pct.toFixed(0)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function aggregate(session: SessionRow): SessionAggregate {
  const log = Array.isArray(session.conversation_log) ? session.conversation_log : [];
  const turns: TurnTiming[] = [];
  log.forEach((msg, i) => {
    if (msg.role !== "max" || !msg.pipeline) return;
    turns.push({
      ...msg.pipeline,
      index: i,
      timestamp: msg.timestamp,
      preview: msg.content.slice(0, 80),
    });
  });

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const maxes: Record<string, number> = {};
  const blockerCounter: Record<string, number> = {};
  let blockerCount = 0;
  let lastBlocker: SessionAggregate["lastBlocker"] = null;

  for (const t of turns) {
    for (const { key } of STEP_LABELS) {
      const v = t[key];
      if (typeof v === "number") {
        sums[key] = (sums[key] ?? 0) + v;
        counts[key] = (counts[key] ?? 0) + 1;
        maxes[key] = Math.max(maxes[key] ?? 0, v);
      }
    }
    const tot = t.total_ms;
    if (typeof tot === "number") {
      sums["total_ms"] = (sums["total_ms"] ?? 0) + tot;
      counts["total_ms"] = (counts["total_ms"] ?? 0) + 1;
      maxes["total_ms"] = Math.max(maxes["total_ms"] ?? 0, tot);
    }
    if (t.blocker) {
      blockerCount++;
      blockerCounter[t.blocker] = (blockerCounter[t.blocker] ?? 0) + 1;
      lastBlocker = { step: t.blocker, turnIndex: t.index, preview: t.preview };
    }
  }

  const avg: ConversationPipelineTimings = {};
  const max: ConversationPipelineTimings = {};
  for (const key of Object.keys(sums)) {
    (avg as Record<string, number>)[key] = sums[key] / counts[key];
    (max as Record<string, number>)[key] = maxes[key];
  }

  const topBlocker = Object.entries(blockerCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    session,
    turnCount: turns.length,
    avg,
    max,
    blockerCount,
    topBlocker,
    lastBlocker,
    turns,
  };
}

interface ComparisonAggregate {
  turnCount: number;
  sessionCount: number;
  avg: ConversationPipelineTimings;
  max: ConversationPipelineTimings;
  turns: TurnTiming[];
  blockerCount: number;
  topBlocker: string | null;
}

function aggregateMany(aggs: SessionAggregate[]): ComparisonAggregate | null {
  const allTurns = aggs.flatMap((a) => a.turns);
  if (!allTurns.length) return null;
  const sums: Record<string, { sum: number; count: number; max: number }> = {};
  let blockers = 0;
  const blockerCounter: Record<string, number> = {};
  const allKeys: NumericTimingKey[] = [...STEP_LABELS.map((s) => s.key), "total_ms"];
  for (const t of allTurns) {
    for (const key of allKeys) {
      const v = t[key];
      if (typeof v === "number") {
        sums[key] ??= { sum: 0, count: 0, max: 0 };
        sums[key].sum += v;
        sums[key].count++;
        sums[key].max = Math.max(sums[key].max, v);
      }
    }
    if (t.blocker) {
      blockers++;
      blockerCounter[t.blocker] = (blockerCounter[t.blocker] ?? 0) + 1;
    }
  }
  const avg: ConversationPipelineTimings = {};
  const max: ConversationPipelineTimings = {};
  for (const k of Object.keys(sums)) {
    (avg as Record<string, number>)[k] = sums[k].sum / sums[k].count;
    (max as Record<string, number>)[k] = sums[k].max;
  }
  return {
    turnCount: allTurns.length,
    sessionCount: aggs.length,
    avg,
    max,
    turns: allTurns,
    blockerCount: blockers,
    topBlocker: Object.entries(blockerCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

export default function LatencyBlockingTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showRelative, setShowRelative] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, started_at, ended_at, conversation_log, game_over_reason")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) console.error(error);
    setSessions(((data as unknown) as SessionRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const aggregates = useMemo(() => sessions.map(aggregate).filter((a) => a.turnCount > 0), [sessions]);

  // Initialize selection: select all sessions on first load
  useEffect(() => {
    if (aggregates.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(aggregates.map((a) => a.session.id)));
    }
  }, [aggregates, selectedIds.size]);

  const selectedAggregates = useMemo(
    () => aggregates.filter((a) => selectedIds.has(a.session.id)),
    [aggregates, selectedIds],
  );

  const comparison = useMemo(() => aggregateMany(selectedAggregates), [selectedAggregates]);
  const focused = aggregates.find((a) => a.session.id === focusId) ?? null;

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelectedIds(new Set(aggregates.map((a) => a.session.id)));
  }
  function selectNone() {
    setSelectedIds(new Set());
  }


  // Global stats across last 50 sessions
  const global = useMemo(() => {
    const allTurns = aggregates.flatMap((a) => a.turns);
    if (!allTurns.length) return null;
    const sums: Record<string, { sum: number; count: number; max: number }> = {};
    let blockers = 0;
    const blockerCounter: Record<string, number> = {};
    for (const t of allTurns) {
      for (const { key } of STEP_LABELS) {
        const v = t[key];
        if (typeof v === "number") {
          sums[key] ??= { sum: 0, count: 0, max: 0 };
          sums[key].sum += v;
          sums[key].count++;
          sums[key].max = Math.max(sums[key].max, v);
        }
      }
      if (typeof t.total_ms === "number") {
        sums["total_ms"] ??= { sum: 0, count: 0, max: 0 };
        sums["total_ms"].sum += t.total_ms;
        sums["total_ms"].count++;
        sums["total_ms"].max = Math.max(sums["total_ms"].max, t.total_ms);
      }
      if (t.blocker) {
        blockers++;
        blockerCounter[t.blocker] = (blockerCounter[t.blocker] ?? 0) + 1;
      }
    }
    return {
      turnCount: allTurns.length,
      sums,
      blockers,
      blockerRate: blockers / allTurns.length,
      topBlocker: Object.entries(blockerCounter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      blockerCounter,
    };
  }, [aggregates]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Latence & blocage</h2>
          <p className="text-xs text-muted-foreground">
            Temps par étape (RAG, GM pre-turn, Max, validateur, TTS, GM post-turn) et dernier point de blocage par session.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      {/* Global stats */}
      {global && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h3 className="text-sm font-semibold mb-3">
            Vue globale — {aggregates.length} session(s) instrumentée(s), {global.turnCount} tour(s) Max
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[...STEP_LABELS, { key: "total_ms" as const, label: "Total", color: "bg-primary" }].map(({ key, label, color }) => {
              const s = global.sums[key];
              if (!s) return (
                <div key={key} className="text-xs">
                  <div className="text-muted-foreground">{label}</div>
                  <div className="font-mono">—</div>
                </div>
              );
              return (
                <div key={key} className="text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </div>
                  <div className="font-mono font-semibold">{fmtMs(s.sum / s.count)}</div>
                  <div className="text-muted-foreground text-[10px]">max {fmtMs(s.max)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Tours bloqués (au moins 1 étape au-dessus du seuil)&nbsp;:</span>
            <Badge variant={global.blockerRate > 0.3 ? "destructive" : "secondary"}>
              {global.blockers} / {global.turnCount} ({(global.blockerRate * 100).toFixed(0)}%)
            </Badge>
            {global.topBlocker && (
              <span className="text-muted-foreground">
                Étape la plus bloquante&nbsp;: <strong className="text-foreground">{global.topBlocker}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Visual latency breakdown — global */}
      {global && (() => {
        const avg: ConversationPipelineTimings = {};
        const max: ConversationPipelineTimings = {};
        for (const k of Object.keys(global.sums)) {
          (avg as Record<string, number>)[k as NumericTimingKey] = global.sums[k].sum / global.sums[k].count;
          (max as Record<string, number>)[k as NumericTimingKey] = global.sums[k].max;
        }
        const allTurns = aggregates.flatMap((a) => a.turns);
        return <LatencyVisualization avg={avg} max={max} turns={allTurns} />;
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Session list */}
        <div className="border rounded-lg">
          <div className="p-3 border-b text-sm font-semibold">Sessions ({aggregates.length})</div>
          <ScrollArea className="h-[60vh]">
            {aggregates.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">
                Aucune session avec timings instrumentés. Joue une partie pour générer des données.
              </p>
            )}
            {aggregates.map((a) => (
              <button
                key={a.session.id}
                onClick={() => setSelectedId(a.session.id)}
                className={`w-full text-left p-3 border-b text-xs hover:bg-accent/50 transition-colors ${
                  selected?.session.id === a.session.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono">{a.session.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{a.turnCount} tour(s)</span>
                </div>
                <div className="text-muted-foreground">
                  {a.session.started_at ? new Date(a.session.started_at).toLocaleString("fr-CH") : "—"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span>Total moy. <strong className="text-foreground font-mono">{fmtMs(a.avg.total_ms)}</strong></span>
                  {a.blockerCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      {a.blockerCount} bloc.
                    </Badge>
                  )}
                </div>
                {a.lastBlocker?.step && (
                  <div className="mt-1 text-amber-500">
                    Dernier blocage&nbsp;: <strong>{a.lastBlocker.step}</strong> (tour #{a.lastBlocker.turnIndex})
                  </div>
                )}
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 border rounded-lg p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Sélectionne une session.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold font-mono">{selected.session.id}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selected.turnCount} tour(s) Max • Game over&nbsp;: {selected.session.game_over_reason || "—"}
                  </p>
                </div>
                {selected.lastBlocker?.step ? (
                  <Badge variant="destructive">Dernier point de blocage : {selected.lastBlocker.step}</Badge>
                ) : (
                  <Badge variant="secondary">Aucun blocage détecté</Badge>
                )}
              </div>

              {/* Per-step averages */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[...STEP_LABELS, { key: "total_ms" as const, label: "Total", color: "bg-primary" }].map(({ key, label, color }) => (
                  <div key={key} className="border rounded p-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                      {label}
                    </div>
                    <div className="font-mono text-sm font-semibold">{fmtMs(selected.avg[key])}</div>
                    <div className="text-[10px] text-muted-foreground">max {fmtMs(selected.max[key])}</div>
                  </div>
                ))}
              </div>

              {/* Visual breakdown for selected session */}
              <div className="mb-4">
                <LatencyVisualization avg={selected.avg} max={selected.max} turns={selected.turns} />
              </div>

              {/* Per-turn breakdown */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Détail par tour ({selected.turns.length})
                </h4>
                <ScrollArea className="h-[40vh] border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        {STEP_LABELS.map(({ key, label }) => (
                          <th key={key} className="p-2 text-right">{label}</th>
                        ))}
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-left">Blocker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.turns.map((t) => (
                        <tr key={t.index} className="border-t">
                          <td className="p-2 font-mono">{t.index}</td>
                          {STEP_LABELS.map(({ key }) => (
                            <td key={key} className="p-2 text-right font-mono">{fmtMs(t[key])}</td>
                          ))}
                          <td className="p-2 text-right font-mono font-semibold">{fmtMs(t.total_ms)}</td>
                          <td className="p-2">
                            {t.blocker ? (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">{t.blocker}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
