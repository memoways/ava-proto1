import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  showRelative = true,
  perSessionRows,
}: {
  /** Moyenne agrégée sur les sessions affichées (vraies données). */
  avg: ConversationPipelineTimings;
  showRelative?: boolean;
  /** Une ligne par session sélectionnée — moyenne réelle des tours de la session. */
  perSessionRows: Array<{
    id: string;
    label: string;
    sublabel?: string;
    avg: ConversationPipelineTimings;
    turnCount: number;
  }>;
}) {
  const avgTotal = avg.total_ms ?? 0;
  const perSessionMax = perSessionRows.reduce(
    (m, r) => Math.max(m, r.avg.total_ms ?? 0),
    0,
  );
  const scaleMax = Math.max(perSessionMax, avgTotal, TARGET_MS) * 1.05;
  const onTarget = avgTotal > 0 && avgTotal <= TARGET_MS;
  const isAggregate = perSessionRows.length > 1;

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Latence réelle &amp; répartition</h3>
          <p className="text-xs text-muted-foreground">
            {isAggregate
              ? "Moyenne réelle par session, mesurée à partir de la conversation."
              : "Moyenne réelle des tours de la session."}{" "}
            Cible : &lt; {TARGET_MS / 1000}s end-to-end.
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          {isAggregate && (
            <div>
              <div className="text-muted-foreground">Moyenne globale</div>
              <div className="font-mono font-bold text-base">{fmtMs(avgTotal)}</div>
            </div>
          )}
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

      {/* Une barre par session — données réelles uniquement */}
      <div className="space-y-2">
        {perSessionRows.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune session à afficher.
          </p>
        )}
        {perSessionRows.map((row) => (
          <StackedRow
            key={row.id}
            label={row.sublabel ? `${row.label} · ${row.sublabel}` : row.label}
            values={row.avg}
            scaleMax={scaleMax}
            target={TARGET_MS}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {STEP_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: STEP_HEX[key] }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-destructive" />
          <span className="text-destructive">cible {TARGET_MS / 1000}s</span>
        </div>
      </div>

      {/* Cost breakdown (relative share of average pipeline) */}
      {showRelative && avgTotal > 0 && (
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

type PeriodPreset = "all" | "24h" | "7d" | "30d" | "custom";
type BlockerFilter = "all" | "with" | "without";

export default function LatencyBlockingTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showRelative, setShowRelative] = useState(false);

  // Filters
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState<string>(""); // yyyy-mm-dd
  const [customTo, setCustomTo] = useState<string>("");
  const [minTurns, setMinTurns] = useState<number>(0);
  const [blockerFilter, setBlockerFilter] = useState<BlockerFilter>("all");
  const [hasInitialized, setHasInitialized] = useState(false);

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

  // Apply filters
  const filteredAggregates = useMemo(() => {
    const now = Date.now();
    let fromTs: number | null = null;
    let toTs: number | null = null;
    if (period === "24h") fromTs = now - 24 * 3600 * 1000;
    else if (period === "7d") fromTs = now - 7 * 24 * 3600 * 1000;
    else if (period === "30d") fromTs = now - 30 * 24 * 3600 * 1000;
    else if (period === "custom") {
      if (customFrom) fromTs = new Date(customFrom + "T00:00:00").getTime();
      if (customTo) toTs = new Date(customTo + "T23:59:59").getTime();
    }
    return aggregates.filter((a) => {
      if (a.turnCount < minTurns) return false;
      if (blockerFilter === "with" && a.blockerCount === 0) return false;
      if (blockerFilter === "without" && a.blockerCount > 0) return false;
      const ts = a.session.started_at ? new Date(a.session.started_at).getTime() : null;
      if (fromTs !== null && (ts === null || ts < fromTs)) return false;
      if (toTs !== null && (ts === null || ts > toTs)) return false;
      return true;
    });
  }, [aggregates, period, customFrom, customTo, minTurns, blockerFilter]);

  // Initialize selection: select all sessions on first load
  useEffect(() => {
    if (!hasInitialized && aggregates.length > 0) {
      setSelectedIds(new Set(aggregates.map((a) => a.session.id)));
      setHasInitialized(true);
    }
  }, [aggregates, hasInitialized]);

  // Drop selected ids that no longer pass the filter so the comparison matches what's visible
  useEffect(() => {
    if (!hasInitialized) return;
    const visibleIds = new Set(filteredAggregates.map((a) => a.session.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filteredAggregates, hasInitialized]);

  const selectedAggregates = useMemo(
    () => filteredAggregates.filter((a) => selectedIds.has(a.session.id)),
    [filteredAggregates, selectedIds],
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
    setSelectedIds(new Set(filteredAggregates.map((a) => a.session.id)));
  }
  function selectNone() {
    setSelectedIds(new Set());
  }
  function resetFilters() {
    setPeriod("all");
    setCustomFrom("");
    setCustomTo("");
    setMinTurns(0);
    setBlockerFilter("all");
  }
  const allSelected =
    filteredAggregates.length > 0 && selectedIds.size === filteredAggregates.length;
  const filtersActive =
    period !== "all" || minTurns > 0 || blockerFilter !== "all" || !!customFrom || !!customTo;
  const hiddenCount = aggregates.length - filteredAggregates.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Latence & blocage</h2>
          <p className="text-xs text-muted-foreground">
            Sélectionne une ou plusieurs sessions pour comparer leurs latences cumulatives.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sessions list with checkboxes */}
        <div className="border rounded-lg flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                Sessions ({filteredAggregates.length}
                {hiddenCount > 0 && (
                  <span className="text-muted-foreground font-normal"> / {aggregates.length}</span>
                )}
                )
              </span>
              <Badge variant={selectedIds.size > 0 ? "default" : "secondary"} className="text-[10px]">
                {selectedIds.size} sélectionnée(s)
              </Badge>
            </div>

            {/* Filters */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Période
                  </label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="24h">Dernières 24h</SelectItem>
                      <SelectItem value="7d">7 derniers jours</SelectItem>
                      <SelectItem value="30d">30 derniers jours</SelectItem>
                      <SelectItem value="custom">Personnalisée…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Blocage
                  </label>
                  <Select
                    value={blockerFilter}
                    onValueChange={(v) => setBlockerFilter(v as BlockerFilter)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="with">Avec blocage</SelectItem>
                      <SelectItem value="without">Sans blocage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {period === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Du</label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Au</label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Min. tours Max
                </label>
                <Input
                  type="number"
                  min={0}
                  value={minTurns || ""}
                  placeholder="0"
                  onChange={(e) => setMinTurns(Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 text-xs"
                />
              </div>

              {filtersActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full text-xs"
                  onClick={resetFilters}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs flex-1"
                onClick={selectAll}
                disabled={allSelected || filteredAggregates.length === 0}
              >
                Tout
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs flex-1"
                onClick={selectNone}
                disabled={selectedIds.size === 0}
              >
                Aucune
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              ☐ Coche pour comparer · clique le nom pour voir le détail
            </p>
          </div>
          <ScrollArea className="h-[60vh]">
            {aggregates.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">
                Aucune session avec timings instrumentés. Joue une partie pour générer des données.
              </p>
            )}
            {aggregates.length > 0 && filteredAggregates.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">
                Aucune session ne correspond aux filtres.
              </p>
            )}
            {filteredAggregates.map((a) => {
              const isSelected = selectedIds.has(a.session.id);
              const isFocused = focusId === a.session.id;
              return (
                <div
                  key={a.session.id}
                  className={`flex items-start gap-2 p-3 border-b text-xs transition-colors ${
                    isFocused ? "bg-accent" : "hover:bg-accent/40"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleId(a.session.id)}
                    className="mt-0.5"
                    aria-label={`Comparer la session ${a.session.id.slice(0, 8)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setFocusId(a.session.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono">{a.session.id.slice(0, 8)}</span>
                      <span className="text-muted-foreground">{a.turnCount} tour(s)</span>
                    </div>
                    <div className="text-muted-foreground">
                      {a.session.started_at ? new Date(a.session.started_at).toLocaleString("fr-CH") : "—"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span>
                        Total moy. <strong className="text-foreground font-mono">{fmtMs(a.avg.total_ms)}</strong>
                      </span>
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
                </div>
              );
            })}
          </ScrollArea>
        </div>

        {/* Right column: comparison + (optional) focused detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Comparison panel */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold">
                  Comparaison ({comparison?.sessionCount ?? 0} session{(comparison?.sessionCount ?? 0) > 1 ? "s" : ""})
                </h3>
                <p className="text-xs text-muted-foreground">
                  {comparison
                    ? `Agrégé sur ${comparison.turnCount} tour(s) Max.`
                    : "Coche au moins une session dans la liste."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={showRelative}
                  onCheckedChange={(v) => setShowRelative(Boolean(v))}
                />
                <span>Afficher la répartition relative (moyenne)</span>
              </label>
            </div>

            {comparison ? (
              <LatencyVisualization
                avg={comparison.avg}
                max={comparison.max}
                turns={comparison.turns}
                showRelative={showRelative}
                perSessionRows={
                  selectedAggregates.length > 1
                    ? selectedAggregates.map((a) => ({
                        id: a.session.id,
                        label: `${a.session.id.slice(0, 8)} · ${a.turnCount} tour(s)`,
                        avg: a.avg,
                      }))
                    : undefined
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucune donnée à comparer. Coche des sessions dans la liste à gauche.
              </p>
            )}
          </div>

          {/* Focused session detail */}
          {focused && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold font-mono">{focused.session.id}</h3>
                  <p className="text-xs text-muted-foreground">
                    {focused.turnCount} tour(s) Max • Game over&nbsp;: {focused.session.game_over_reason || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {focused.lastBlocker?.step ? (
                    <Badge variant="destructive">Blocage : {focused.lastBlocker.step}</Badge>
                  ) : (
                    <Badge variant="secondary">Aucun blocage</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setFocusId(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>

              {/* Per-turn breakdown */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Détail par tour ({focused.turns.length})
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
                      {focused.turns.map((t) => (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
