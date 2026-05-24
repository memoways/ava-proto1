import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, MessageSquare } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ConversationMessage, ConversationPipelineTimings } from "@/types";
import {
  buildLatencySegmentsFromPipeline,
  computeSegmentServiceEvolution,
  computeSegmentServiceStats,
  resolveLatencyServiceInfo,
  type LatencySegmentKey,
  type LatencyServiceInfo,
  type SegmentServiceEvolutionPoint,
  type SegmentServiceStats,
} from "@/services/latencySegments";
import { getConfiguredLatencyServices } from "@/services/latencyServiceMetadata";

interface SessionRow {
  id: string;
  name: string | null;
  started_at: string | null;
  ended_at: string | null;
  conversation_log: ConversationMessage[] | null;
  game_over_reason: string | null;
}

function sessionLabel(s: SessionRow): string {
  return s.name?.trim() || s.id.slice(0, 8);
}

interface TurnTiming extends ConversationPipelineTimings {
  index: number;
  sessionId: string;
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

type NumericTimingKey = "stt_ms" | "rag_ms" | "gm_pre_ms" | "max_ms" | "validator_ms" | "tts_ms" | "gm_post_ms" | "total_ms";

const STEP_LABELS: Array<{ key: NumericTimingKey; label: string; color: string }> = [
  { key: "stt_ms", label: "STT", color: "bg-slate-500" },
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
  stt_ms: "#64748b",       // slate-500
  rag_ms: "#0ea5e9",       // sky-500
  gm_pre_ms: "#8b5cf6",    // violet-500
  max_ms: "#10b981",       // emerald-500
  validator_ms: "#f59e0b", // amber-500
  tts_ms: "#f43f5e",       // rose-500
  gm_post_ms: "#d946ef",   // fuchsia-500
  total_ms: "#6366f1",
};

const TARGET_MS = 2000;

// ============================================================================
// Analyse factuelle des causes de latence par étape
// ----------------------------------------------------------------------------
// Tout est calculé en pur JS sur des données déjà chargées (conversation_log
// déjà persistée en base). Aucune requête réseau supplémentaire — donc zéro
// impact sur la latence vécue par l'utilisateur en jeu. Le calcul est mémoïsé
// dans le composant parent.
// ============================================================================

/** Budget cible (ms) attendu par étape pour tenir une latence end-to-end < 2s.
 *  Ces valeurs sont des hypothèses de référence (pas d'estimation des durées
 *  réelles) — elles servent uniquement à qualifier un segment comme "ok",
 *  "élevé" ou "critique" par rapport à un objectif raisonnable. */
const STEP_BUDGET_MS: Record<NumericTimingKey, number> = {
  stt_ms: 900,
  rag_ms: 250,
  gm_pre_ms: 400,
  max_ms: 800,
  validator_ms: 300,
  tts_ms: 600,
  gm_post_ms: 200,
  total_ms: TARGET_MS,
};

/** Hypothèses d'optimisation factuelles, par étape. Affichées en tooltip
 *  pour orienter le diagnostic — ce ne sont pas des promesses de gain. */
const STEP_HYPOTHESES: Record<NumericTimingKey, string[]> = {
  stt_ms: [
    "Comparer Deepgram par navigateur et mime MediaRecorder",
    "Vérifier le délai de silence avant finalisation",
    "Mesurer séparément PTT flush et silence automatique",
  ],
  rag_ms: [
    "Réduire RAG_TOP_K (moins de chunks à vectoriser)",
    "Cache local des embeddings de la dernière question",
    "Filtrer côté SQL avant le match vectoriel",
  ],
  gm_pre_ms: [
    "Basculer sur un modèle GM plus rapide (ex. gemini-2.5-flash-lite)",
    "Réduire la taille du brief JSON demandé au planner",
    "Lancer le pre-turn en parallèle du début du STT final",
  ],
  max_ms: [
    "Activer le streaming token-par-token côté Max LLM",
    "Modèle plus rapide pour Max si la persona le permet",
    "Raccourcir le system prompt et le contexte injecté",
  ],
  validator_ms: [
    "Modèle validateur plus léger (nano/flash-lite)",
    "Skipper le validateur si le brief n'a aucune assertion bloquée",
    "Validation déclenchée seulement quand triggers/trust changent",
  ],
  tts_ms: [
    "Streaming ElevenLabs (déjà actif ?) — vérifier le first-byte",
    "Voice ID plus rapide ou modèle TTS turbo",
    "Pré-charger l'intro TTS pendant la phase ringing",
  ],
  gm_post_ms: [
    "Post-turn en background (n'attend pas avant le tour suivant)",
    "Modèle scorer ultra-rapide (réponse JSON très courte)",
    "Skipper le scoring quand trust n'a pas pu bouger",
  ],
  total_ms: [
    "Paralléliser les étapes indépendantes (TTS pendant validateur)",
    "Identifier l'étape bloqueuse récurrente sur la session",
  ],
};

interface StepBaseline {
  /** Nombre d'observations (tours) pour cette étape sur le dataset visible. */
  n: number;
  mean: number;
  median: number;
  p95: number;
  max: number;
}

type StepBaselines = Partial<Record<NumericTimingKey, StepBaseline>>;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeBaselines(allTurns: TurnTiming[]): StepBaselines {
  const out: StepBaselines = {};
  const allKeys: NumericTimingKey[] = [...STEP_LABELS.map((s) => s.key), "total_ms"];
  for (const key of allKeys) {
    const xs = allTurns
      .map((t) => t[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => a - b);
    if (xs.length === 0) continue;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    out[key] = {
      n: xs.length,
      mean,
      median: percentile(xs, 0.5),
      p95: percentile(xs, 0.95),
      max: xs[xs.length - 1],
    };
  }
  return out;
}

interface StepDiagnostic {
  /** "ok" | "élevé" | "critique" — sévérité par rapport au budget cible. */
  severity: "ok" | "high" | "critical";
  severityLabel: string;
  /** Texte court résumant la situation (ex. "1.4× la médiane du dataset"). */
  comparison: string;
  /** Position approximative dans la distribution (ex. "≥ p95"). */
  distribution: string;
  /** Hypothèses d'optimisation pertinentes. */
  hypotheses: string[];
  /** Part dans le total du tour (en %). */
  shareOfTotalPct: number | null;
}

function analyzeStep(
  key: NumericTimingKey,
  value: number,
  totalForRow: number,
  baseline: StepBaseline | undefined,
): StepDiagnostic {
  const budget = STEP_BUDGET_MS[key];
  let severity: StepDiagnostic["severity"] = "ok";
  if (value > budget * 2) severity = "critical";
  else if (value > budget) severity = "high";

  const severityLabel =
    severity === "critical"
      ? `Critique (> 2× budget cible ${fmtMs(budget)})`
      : severity === "high"
        ? `Élevé (> budget cible ${fmtMs(budget)})`
        : `Dans le budget cible (${fmtMs(budget)})`;

  let comparison = "Pas assez d'historique pour comparer.";
  let distribution = "—";
  if (baseline && baseline.n >= 2) {
    const ratio = baseline.median > 0 ? value / baseline.median : 0;
    if (ratio > 0) {
      comparison = `${ratio.toFixed(2)}× la médiane (${fmtMs(baseline.median)}) sur ${baseline.n} tour(s)`;
    }
    if (value >= baseline.p95) distribution = `≥ p95 (${fmtMs(baseline.p95)}) — parmi les pires 5 %`;
    else if (value >= baseline.mean) distribution = `> moyenne (${fmtMs(baseline.mean)})`;
    else distribution = `≤ moyenne (${fmtMs(baseline.mean)})`;
  }

  const shareOfTotalPct = totalForRow > 0 ? (value / totalForRow) * 100 : null;

  return {
    severity,
    severityLabel,
    comparison,
    distribution,
    hypotheses: STEP_HYPOTHESES[key] ?? [],
    shareOfTotalPct,
  };
}

interface DispersionStats {
  /** Number of samples (turns) used. */
  n: number;
  min: number;
  max: number;
  stddev: number;
}

function computeDispersion(samples: number[]): DispersionStats | null {
  const xs = samples.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (xs.length < 2) return { n: xs.length, min, max, stddev: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  // Sample standard deviation (n-1)
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return { n: xs.length, min, max, stddev: Math.sqrt(variance) };
}

export interface SegmentSelection {
  rowLabel: string;
  rowKind: "session-avg" | "turn" | "global-avg";
  stepKey: NumericTimingKey;
  stepLabel: string;
  stepColor: string;
  value: number;
  total: number;
  diagnostic: StepDiagnostic;
  baseline: StepBaseline | undefined;
  service?: LatencyServiceInfo;
}

interface StackedRowProps {
  label: string;
  values: ConversationPipelineTimings;
  scaleMax: number;
  target?: number;
  /** Per-turn dispersion of the total latency, displayed as min–max bracket and σ badge. */
  dispersion?: DispersionStats | null;
  /** Baselines (médiane/p95/moyenne) calculées sur tous les tours visibles, pour
   *  qualifier chaque segment dans le tooltip. */
  baselines?: StepBaselines;
  /** Indique si la ligne est une moyenne agrégée (vs un tour individuel). */
  rowKind?: "session-avg" | "turn" | "global-avg";
  /** Callback déclenché au clic sur un segment — ouvre le panneau latéral détaillé. */
  onSelectSegment?: (sel: SegmentSelection) => void;
  /** Sévérité minimale pour mettre en avant les segments ; les autres sont atténués. */
  minSeverity?: "all" | "high" | "critical";
  /** Services configurés actuellement, utilisés si les tours historiques n'ont pas de metadata. */
  defaultServices?: Partial<Record<LatencySegmentKey, LatencyServiceInfo>>;
}

function severityClasses(sev: StepDiagnostic["severity"]): string {
  if (sev === "critical") return "bg-destructive/15 text-destructive border-destructive/40";
  if (sev === "high") return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40";
}

function StackedRow({
  label,
  values,
  scaleMax,
  target,
  dispersion,
  baselines,
  rowKind = "turn",
  onSelectSegment,
  minSeverity = "all",
  defaultServices,
}: StackedRowProps) {
  const sevThreshold = minSeverity === "all" ? 0 : minSeverity === "high" ? 1 : 2;
  const total = STEP_LABELS.reduce((acc, { key }) => acc + (values[key] ?? 0), 0);
  const denom = Math.max(scaleMax, total, dispersion?.max ?? 0, 1);
  const targetPct = target ? Math.min(100, (target / denom) * 100) : null;
  const overTarget = target ? total > target : false;

  const showRange = !!dispersion && dispersion.n >= 2 && dispersion.max > dispersion.min;
  const minPct = showRange ? (dispersion!.min / denom) * 100 : 0;
  const maxPct = showRange ? Math.min(100, (dispersion!.max / denom) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          {dispersion && dispersion.n >= 2 && (
            <span
              className="text-[10px] font-mono text-muted-foreground"
              title={`${dispersion.n} tour(s) — min ${fmtMs(dispersion.min)} · max ${fmtMs(
                dispersion.max,
              )} · σ ${fmtMs(dispersion.stddev)}`}
            >
              [{fmtMs(dispersion.min)} – {fmtMs(dispersion.max)}] · σ {fmtMs(dispersion.stddev)}
            </span>
          )}
          <span
            className={`text-xs font-mono font-semibold ${
              overTarget ? "text-destructive" : "text-foreground"
            }`}
          >
            {fmtMs(total)}
          </span>
        </div>
      </div>
      <div className="relative h-6 w-full bg-muted/40 rounded overflow-hidden">
        <div className="absolute inset-0 flex">
          {STEP_LABELS.map(({ key, label: stepLabel }) => {
            const v = values[key] ?? 0;
            if (v <= 0) return null;
            const pct = (v / denom) * 100;
            const diag = analyzeStep(key, v, total, baselines?.[key]);
            const service = resolveLatencyServiceInfo(defaultServices?.[key], values.segmentServices?.[key]);
            const dimmed = SEVERITY_RANK[diag.severity] < sevThreshold;
            return (
              <Tooltip key={key} delayDuration={120}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSegment?.({
                        rowLabel: label,
                        rowKind,
                        stepKey: key,
                        stepLabel,
                        stepColor: STEP_HEX[key],
                        value: v,
                        total,
                        diagnostic: diag,
                        baseline: baselines?.[key],
                        service,
                      })
                    }
                    className={`h-full flex items-center justify-center text-[10px] text-white/95 font-medium overflow-hidden cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground/40 hover:brightness-110 transition ${
                      dimmed ? "opacity-25 grayscale" : ""
                    }`}
                    style={{ width: `${pct}%`, backgroundColor: STEP_HEX[key] }}
                    aria-label={`${stepLabel}: ${fmtMs(v)} — ${diag.severityLabel}. Cliquer pour le détail.`}
                  >
                    {pct > 8 ? stepLabel : ""}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[340px] p-0 overflow-hidden">
                  <div className="space-y-2 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: STEP_HEX[key] }}
                        />
                        <span className="font-semibold text-sm">{stepLabel}</span>
                      </div>
                      <span className="font-mono font-semibold">{fmtMs(v)}</span>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${severityClasses(
                        diag.severity,
                      )}`}
                    >
                      {diag.severityLabel}
                    </div>

                    <div className="space-y-1 text-muted-foreground">
                      {service && (
                        <>
                          <div>
                            Service: <span className="text-foreground font-medium">{service.serviceProvider || service.serviceName || "Unknown"}</span>
                          </div>
                          <div>
                            Model: <span className="text-foreground font-medium">{service.model || "Unknown"}</span>
                          </div>
                          {service.mode && (
                            <div>
                              Mode: <span className="text-foreground font-medium">{service.mode}</span>
                            </div>
                          )}
                        </>
                      )}
                      {diag.shareOfTotalPct !== null && (
                        <div>
                          <span className="text-foreground font-medium">
                            {diag.shareOfTotalPct.toFixed(0)}%
                          </span>{" "}
                          de la latence{" "}
                          {rowKind === "turn" ? "du tour" : "moyenne de la session"} ({fmtMs(total)})
                        </div>
                      )}
                      <div>{diag.comparison}</div>
                      <div>{diag.distribution}</div>
                    </div>

                    {diag.severity !== "ok" && diag.hypotheses.length > 0 && (
                      <div className="border-t pt-2">
                        <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <Info className="h-3 w-3" />
                          <span>Pistes pour réduire</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-foreground/90">
                          {diag.hypotheses.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Min–max range bracket overlay */}
        {showRange && (
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0 h-1.5"
            title={`Plage min–max sur ${dispersion!.n} tour(s) : ${fmtMs(
              dispersion!.min,
            )} – ${fmtMs(dispersion!.max)}`}
          >
            {/* Range line */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-px bg-foreground/80"
              style={{
                left: `${minPct}%`,
                width: `${Math.max(0, maxPct - minPct)}%`,
              }}
            />
            {/* Min tick */}
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/80"
              style={{ left: `${minPct}%` }}
            />
            {/* Max tick */}
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/80"
              style={{ left: `${maxPct}%` }}
            />
          </div>
        )}

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
  expandedIds,
  onToggleExpanded,
  minSeverity = "all",
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
    dispersion?: DispersionStats | null;
    turns?: TurnTiming[];
  }>;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  minSeverity?: "all" | "high" | "critical";
}) {
  const expanded = expandedIds;
  const toggleExpanded = onToggleExpanded;

  const avgTotal = avg.total_ms ?? 0;
  const perSessionMax = perSessionRows.reduce((m, r) => {
    const t = r.avg.total_ms ?? 0;
    const dispMax = r.dispersion?.max ?? 0;
    const turnsMax = (r.turns ?? []).reduce(
      (mm, tt) => Math.max(mm, tt.total_ms ?? 0),
      0,
    );
    return Math.max(m, t, dispMax, turnsMax);
  }, 0);
  const scaleMax = Math.max(perSessionMax, avgTotal, TARGET_MS) * 1.05;
  const onTarget = avgTotal > 0 && avgTotal <= TARGET_MS;
  const isAggregate = perSessionRows.length > 1;

  // Baselines (médiane / p95 / moyenne par étape) calculées une fois sur tous
  // les tours visibles. Mémoïsé pour éviter tout recalcul au hover.
  const baselines = useMemo<StepBaselines>(() => {
    const allTurns = perSessionRows.flatMap((r) => r.turns ?? []);
    return computeBaselines(allTurns);
  }, [perSessionRows]);

  // Sélection courante pour le panneau latéral détaillé (clic sur un segment).
  const [selected, setSelected] = useState<SegmentSelection | null>(null);

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Latence réelle &amp; répartition</h3>
          <p className="text-xs text-muted-foreground">
            {isAggregate
              ? "Moyenne réelle par session, mesurée à partir de la conversation."
              : "Moyenne réelle des tours de la session."}{" "}
            Cible : &lt; {TARGET_MS / 1000}s end-to-end. Clique sur ▸ pour voir le détail par tour.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/80 flex items-center gap-1">
            <Info className="h-3 w-3" /> Survole un segment pour un aperçu, clique dessus pour ouvrir le panneau d'analyse détaillée.
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
      <div className="space-y-3">
        {perSessionRows.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune session à afficher.
          </p>
        )}
        {perSessionRows.map((row) => {
          const isOpen = expanded.has(row.id);
          const turns = row.turns ?? [];
          const canExpand = turns.length > 0;
          return (
            <div key={row.id} className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    className="mt-3 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label={isOpen ? "Masquer les tours" : "Afficher les tours"}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="mt-3 w-3.5 shrink-0 inline-block" />
                )}
                <div className="flex-1 min-w-0">
                  <StackedRow
                    label={row.sublabel ? `${row.label} · ${row.sublabel}` : row.label}
                    values={row.avg}
                    scaleMax={scaleMax}
                    target={TARGET_MS}
                    dispersion={row.dispersion}
                    baselines={baselines}
                    rowKind="session-avg"
                    onSelectSegment={setSelected}
                    minSeverity={minSeverity}
                    defaultServices={configuredLatencyServices}
                  />
                </div>
              </div>
              {isOpen && canExpand && (
                <div className="pl-5 space-y-1.5 border-l-2 border-border/60 ml-1.5">
                  {turns.map((t) => {
                    const stepValues: ConversationPipelineTimings = {
                      stt_ms: t.stt_ms,
                      rag_ms: t.rag_ms,
                      gm_pre_ms: t.gm_pre_ms,
                      max_ms: t.max_ms,
                      validator_ms: t.validator_ms,
                      tts_ms: t.tts_ms,
                      gm_post_ms: t.gm_post_ms,
                      segmentServices: t.segmentServices,
                    };
                    return (
                      <StackedRow
                        key={t.index}
                        label={`Tour #${t.index}${t.blocker ? ` · blocker: ${t.blocker}` : ""}`}
                        values={stepValues}
                        scaleMax={scaleMax}
                        target={TARGET_MS}
                        baselines={baselines}
                        rowKind="turn"
                        onSelectSegment={setSelected}
                        minSeverity={minSeverity}
                        defaultServices={configuredLatencyServices}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

      <SegmentDetailSheet
        selection={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function ServiceComparisonPanel({
  stats,
  metric,
  onMetricChange,
}: {
  stats: SegmentServiceStats[];
  metric: MetricMode;
  onMetricChange: (metric: MetricMode) => void;
}) {
  const sorted = [...stats].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const topOutliers = sorted.flatMap((s) =>
    s.outliers.map((o) => ({
      ...o,
      segmentLabel: s.segmentLabel,
      serviceProvider: s.serviceProvider,
      model: s.model,
    })),
  ).sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Comparaison par segment et service</h3>
          <p className="text-xs text-muted-foreground">
            Groupé par segment existant puis provider/model. P50 est la métrique principale par défaut.
          </p>
        </div>
        <Select value={metric} onValueChange={(v) => onMetricChange(v as MetricMode)}>
          <SelectTrigger className="h-8 text-xs w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p50">P50</SelectItem>
            <SelectItem value="p95">P95</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucun segment enrichi à comparer dans la sélection.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium text-muted-foreground">Segment</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Service</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Model</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Tours</th>
                <th className="text-right p-2 font-medium text-muted-foreground">{metric.toUpperCase()}</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Moy</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Max</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Blocages</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={`${s.segmentKey}-${s.serviceProvider}-${s.model}-${s.mode}`} className="border-t">
                  <td className="p-2 font-medium">{s.segmentLabel}</td>
                  <td className="p-2 font-mono">{s.serviceProvider}</td>
                  <td className="p-2 font-mono max-w-[220px] truncate" title={s.model}>{s.model}</td>
                  <td className="p-2 text-right font-mono">{s.count}</td>
                  <td className="p-2 text-right font-mono font-semibold">{fmtMs(s[metric])}</td>
                  <td className="p-2 text-right font-mono">{fmtMs(s.avg)}</td>
                  <td className="p-2 text-right font-mono">{fmtMs(s.max)}</td>
                  <td className="p-2 text-right font-mono">
                    {s.blockageCount} · {(s.blockageRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topOutliers.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs font-semibold mb-2">Cas extrêmes</div>
          <div className="grid gap-1">
            {topOutliers.map((o, i) => (
              <div key={`${o.key}-${o.context?.sessionId}-${o.context?.turnIndex}-${i}`} className="flex items-center gap-2 text-[11px] border rounded px-2 py-1">
                <Badge variant={o.aboveP95 ? "destructive" : "secondary"} className="text-[10px]">
                  {o.aboveP95 ? "> P95" : "top 5"}
                </Badge>
                <span className="font-medium">{o.segmentLabel}</span>
                <span className="font-mono">{fmtMs(o.durationMs)}</span>
                <span className="text-muted-foreground truncate">
                  {o.serviceProvider} · {o.model} · tour #{o.context?.turnIndex ?? "?"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function seconds(ms: number): number {
  return Number((ms / 1000).toFixed(2));
}

function buildEvolutionChartData(points: SegmentServiceEvolutionPoint[], serviceKeys: string[]) {
  const bySession = new Map<string, Record<string, string | number | null>>();
  for (const point of points) {
    const sessionKey = point.sessionId;
    if (!bySession.has(sessionKey)) {
      bySession.set(sessionKey, {
        sessionId: point.sessionId,
        sessionLabel: point.sessionLabel,
        sessionStartedAt: point.sessionStartedAt,
      });
    }
    const row = bySession.get(sessionKey)!;
    row[`${point.serviceKey}__min`] = seconds(point.minMs);
    row[`${point.serviceKey}__median`] = seconds(point.medianMs);
    row[`${point.serviceKey}__max`] = seconds(point.maxMs);
  }
  return [...bySession.values()].sort((a, b) => {
    const at = typeof a.sessionStartedAt === "string" ? new Date(a.sessionStartedAt).getTime() : 0;
    const bt = typeof b.sessionStartedAt === "string" ? new Date(b.sessionStartedAt).getTime() : 0;
    return at - bt || String(a.sessionLabel).localeCompare(String(b.sessionLabel));
  }).map((row, index) => {
    row.sessionNumber = `#${index + 1}`;
    for (const serviceKey of serviceKeys) {
      row[`${serviceKey}__min`] ??= null;
      row[`${serviceKey}__median`] ??= null;
      row[`${serviceKey}__max`] ??= null;
    }
    return row;
  });
}

function SegmentEvolutionChart({
  segment,
  points,
  selectedService,
  onServiceChange,
  highlightedSessionId,
  onHighlightSession,
}: {
  segment: { key: SegmentEvolutionKey; label: string; color: string };
  points: SegmentServiceEvolutionPoint[];
  selectedService: string;
  onServiceChange: (value: string) => void;
  highlightedSessionId: string | null;
  onHighlightSession: (sessionId: string) => void;
}) {
  const segmentPoints = points.filter((p) => p.segmentKey === segment.key);
  const serviceOptions = [...new Map(segmentPoints.map((p) => [p.serviceKey, p.serviceLabel])).entries()];
  const visibleServiceKeys = selectedService === "all" ? serviceOptions.map(([key]) => key) : [selectedService].filter(Boolean);
  const visiblePoints = segmentPoints.filter((p) => visibleServiceKeys.includes(p.serviceKey));
  const chartData = buildEvolutionChartData(visiblePoints, visibleServiceKeys);

  const detailRows = visiblePoints;
  const colorByService = new Map(serviceOptions.map(([key], index) => [key, SERVICE_COLORS[index % SERVICE_COLORS.length]]));
  const sessionNumberById = new Map(chartData.map((row) => [String(row.sessionId), String(row.sessionNumber)]));
  const highlightedX = highlightedSessionId ? sessionNumberById.get(highlightedSessionId) : undefined;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: segment.color }} />
          <div>
            <h4 className="text-sm font-semibold">{segment.label}</h4>
            <p className="text-[11px] text-muted-foreground">
              Axe vertical en secondes · min / médiane / max par session. Clique une ligne du tableau pour la repérer.
            </p>
          </div>
        </div>
        <Select value={selectedService} onValueChange={onServiceChange}>
          <SelectTrigger className="h-8 text-xs w-[230px]">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services superposés</SelectItem>
            {serviceOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          Aucune donnée {segment.label} enrichie dans les sessions sélectionnées.
        </p>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="sessionNumber"
                tick={{ fontSize: 11 }}
                interval={0}
                minTickGap={8}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(2)}
                label={{ value: "secondes", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
              />
              <RechartsTooltip
                formatter={(value: number | string, name: string) => [
                  typeof value === "number" ? `${value.toFixed(2)} s` : value,
                  name,
                ]}
                labelFormatter={(label) => `Session ${label}`}
              />
              {highlightedX && (
                <ReferenceLine
                  x={highlightedX}
                  stroke="hsl(var(--foreground))"
                  strokeDasharray="4 3"
                  label={{ value: highlightedX, position: "top", fontSize: 11, fill: "hsl(var(--foreground))" }}
                />
              )}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {visibleServiceKeys.map((serviceKey) => {
                const label = serviceOptions.find(([key]) => key === serviceKey)?.[1] || "Unknown";
                const color = colorByService.get(serviceKey) || segment.color;
                return (
                  <Fragment key={serviceKey}>
                    <Line
                      key={`${serviceKey}-min`}
                      type="monotone"
                      dataKey={`${serviceKey}__min`}
                      name={`${label} · min`}
                      stroke={color}
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      key={`${serviceKey}-median`}
                      type="monotone"
                      dataKey={`${serviceKey}__median`}
                      name={`${label} · médiane`}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                    <Line
                      key={`${serviceKey}-max`}
                      type="monotone"
                      dataKey={`${serviceKey}__max`}
                      name={`${label} · max`}
                      stroke={color}
                      strokeDasharray="5 2"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  </Fragment>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {detailRows.length > 0 && (
        <div className="overflow-x-auto border-t pt-2">
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-1 pr-2 font-medium">Session</th>
                <th className="text-left py-1 pr-2 font-medium">Service</th>
                <th className="text-right py-1 px-2 font-medium">Min</th>
                <th className="text-right py-1 px-2 font-medium">Médiane</th>
                <th className="text-right py-1 px-2 font-medium">Max</th>
                <th className="text-right py-1 pl-2 font-medium">Tours</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => {
                const sessionNumber = sessionNumberById.get(row.sessionId) || "#?";
                const isHighlighted = highlightedSessionId === row.sessionId;
                return (
                <tr
                  key={`${row.segmentKey}-${row.serviceKey}-${row.sessionId}`}
                  className={`border-t cursor-pointer hover:bg-accent/40 ${isHighlighted ? "bg-accent" : ""}`}
                  onClick={() => onHighlightSession(row.sessionId)}
                >
                  <td className="py-1 pr-2">
                    <span className="font-mono font-semibold">{sessionNumber}</span>{" "}
                    <span className="text-muted-foreground">{row.sessionLabel}</span>
                  </td>
                  <td className="py-1 pr-2 font-mono max-w-[220px] truncate" title={row.serviceLabel}>{row.serviceLabel}</td>
                  <td className="py-1 px-2 text-right font-mono">{seconds(row.minMs).toFixed(2)} s</td>
                  <td className="py-1 px-2 text-right font-mono font-semibold">{seconds(row.medianMs).toFixed(2)} s</td>
                  <td className="py-1 px-2 text-right font-mono">{seconds(row.maxMs).toFixed(2)} s</td>
                  <td className="py-1 pl-2 text-right font-mono">{row.count}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LatencyEvolutionPanel({
  points,
  serviceFilters,
  onServiceFilterChange,
  highlightedSessionId,
  onHighlightSession,
}: {
  points: SegmentServiceEvolutionPoint[];
  serviceFilters: Record<SegmentEvolutionKey, string>;
  onServiceFilterChange: (segment: SegmentEvolutionKey, value: string) => void;
  highlightedSessionId: string | null;
  onHighlightSession: (sessionId: string) => void;
}) {
  const hasUnknown = points.some((p) => p.serviceProvider === "Unknown" || p.model === "Unknown");
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Évolution temporelle par service</h3>
        <p className="text-xs text-muted-foreground">
          Compare STT, Max LLM et TTS dans le temps. Les services peuvent être superposés ou inspectés indépendamment.
        </p>
        {hasUnknown && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Unknown = session historique sans métadonnées provider/model dans <code>pipeline.segmentServices</code>. Les nouveaux tours instrumentés les renseignent.
          </p>
        )}
      </div>
      <div className="grid gap-4">
        {EVOLUTION_SEGMENTS.map((segment) => (
          <SegmentEvolutionChart
            key={segment.key}
            segment={segment}
            points={points}
            selectedService={serviceFilters[segment.key] || "all"}
            onServiceChange={(value) => onServiceFilterChange(segment.key, value)}
            highlightedSessionId={highlightedSessionId}
            onHighlightSession={onHighlightSession}
          />
        ))}
      </div>
    </div>
  );
}

function SegmentDetailSheet({
  selection,
  onOpenChange,
}: {
  selection: SegmentSelection | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = selection !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {selection && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: selection.stepColor }}
                  aria-hidden
                />
                <SheetTitle className="text-base">
                  {selection.stepLabel} · {fmtMs(selection.value)}
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs">
                {selection.rowKind === "turn" ? "Tour individuel" : "Moyenne de la session"} —{" "}
                <span className="font-medium text-foreground/80">{selection.rowLabel}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5 text-sm">
              {/* Sévérité */}
              <div
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${severityClasses(
                  selection.diagnostic.severity,
                )}`}
              >
                {selection.diagnostic.severityLabel}
              </div>

              {/* Chiffres clés */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Part du tour
                  </div>
                  <div className="font-mono font-semibold text-base">
                    {selection.diagnostic.shareOfTotalPct !== null
                      ? `${selection.diagnostic.shareOfTotalPct.toFixed(0)} %`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    sur {fmtMs(selection.total)} total
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Budget cible
                  </div>
                  <div className="font-mono font-semibold text-base">
                    {fmtMs(STEP_BUDGET_MS[selection.stepKey])}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    pour tenir &lt; {TARGET_MS / 1000}s end-to-end
                  </div>
                </div>
              </div>

              {/* Distribution / comparaison */}
              {selection.service && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Service
                  </div>
                  <div className="rounded-md border p-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Provider</div>
                      <div className="font-mono break-all">{selection.service.serviceProvider || selection.service.serviceName || "Unknown"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Model</div>
                      <div className="font-mono break-all">{selection.service.model || "Unknown"}</div>
                    </div>
                    {selection.service.mode && (
                      <div>
                        <div className="text-muted-foreground">Mode</div>
                        <div className="font-mono break-all">{selection.service.mode}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Distribution / comparaison */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comparaison dataset
                </div>
                <div className="rounded-md border p-3 space-y-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">vs médiane : </span>
                    <span className="text-foreground">{selection.diagnostic.comparison}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">distribution : </span>
                    <span className="text-foreground">{selection.diagnostic.distribution}</span>
                  </div>
                  {selection.baseline && selection.baseline.n >= 2 && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t mt-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground">n</div>
                        <div className="font-mono">{selection.baseline.n}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">moy</div>
                        <div className="font-mono">{fmtMs(selection.baseline.mean)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">méd</div>
                        <div className="font-mono">{fmtMs(selection.baseline.median)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">p95</div>
                        <div className="font-mono">{fmtMs(selection.baseline.p95)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Hypothèses d'optimisation */}
              {selection.diagnostic.hypotheses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Info className="h-3 w-3" /> Pistes pour réduire cette latence
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                    {selection.diagnostic.hypotheses.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Hypothèses indicatives — à valider par mesure A/B sur une nouvelle session.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
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
      sessionId: session.id,
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
type SeverityFilter = "all" | "high" | "critical";
type MetricMode = "p50" | "p95";
type SegmentEvolutionKey = "stt_ms" | "max_ms" | "tts_ms";

const EVOLUTION_SEGMENTS: Array<{ key: SegmentEvolutionKey; label: string; color: string }> = [
  { key: "stt_ms", label: "STT", color: STEP_HEX.stt_ms },
  { key: "max_ms", label: "Max LLM", color: STEP_HEX.max_ms },
  { key: "tts_ms", label: "TTS", color: STEP_HEX.tts_ms },
];

const SERVICE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
];
const DEFAULT_SELECTED_SESSION_COUNT = 8;

const SEVERITY_RANK: Record<StepDiagnostic["severity"], number> = {
  ok: 0,
  high: 1,
  critical: 2,
};

export default function LatencyBlockingTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showRelative, setShowRelative] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [minSeverity, setMinSeverity] = useState<SeverityFilter>("all");
  const [serviceMetric, setServiceMetric] = useState<MetricMode>("p50");
  const [evolutionServiceFilters, setEvolutionServiceFilters] = useState<Record<SegmentEvolutionKey, string>>({
    stt_ms: "all",
    max_ms: "all",
    tts_ms: "all",
  });
  const [highlightedEvolutionSessionId, setHighlightedEvolutionSessionId] = useState<string | null>(null);

  function handleFocus(id: string) {
    setFocusId(id);
    // Coche la session si pas encore sélectionnée et déplie ses tours dans la comparaison
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setExpandedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      .select("id, name, started_at, ended_at, conversation_log, game_over_reason")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) console.error(error);
    setSessions(((data as unknown) as SessionRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Sync focus from URL ?session=<id> (deep link from Sessions tab)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const sid = searchParams.get("session");
    if (!sid) return;
    if (!sessions.some((s) => s.id === sid)) return;
    setFocusId(sid);
    setSelectedIds((prev) => {
      if (prev.has(sid)) return prev;
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
    setExpandedIds((prev) => {
      if (prev.has(sid)) return prev;
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
  }, [searchParams, sessions]);

  const [conversationOpen, setConversationOpen] = useState(false);

  const configuredLatencyServices = useMemo(() => getConfiguredLatencyServices(), []);

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

  // Initialize selection: keep charts readable by selecting only the latest sessions.
  useEffect(() => {
    if (!hasInitialized && filteredAggregates.length > 0) {
      const defaultIds = filteredAggregates.slice(0, DEFAULT_SELECTED_SESSION_COUNT).map((a) => a.session.id);
      setSelectedIds(new Set(defaultIds));
      setHighlightedEvolutionSessionId(defaultIds[0] ?? null);
      setHasInitialized(true);
    }
  }, [filteredAggregates, hasInitialized]);

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
      if (changed && highlightedEvolutionSessionId && !visibleIds.has(highlightedEvolutionSessionId)) {
        setHighlightedEvolutionSessionId(next.values().next().value ?? null);
      }
      return changed ? next : prev;
    });
  }, [filteredAggregates, hasInitialized, highlightedEvolutionSessionId]);

  const selectedAggregates = useMemo(
    () => filteredAggregates.filter((a) => selectedIds.has(a.session.id)),
    [filteredAggregates, selectedIds],
  );

  const comparison = useMemo(() => aggregateMany(selectedAggregates), [selectedAggregates]);
  const selectedLatencySegments = useMemo(() => {
    return selectedAggregates.flatMap((a) =>
      a.turns.flatMap((turn) =>
        buildLatencySegmentsFromPipeline({
          sessionId: turn.sessionId,
          sessionLabel: sessionLabel(a.session),
          sessionStartedAt: a.session.started_at,
          turnIndex: turn.index,
          pipeline: turn,
          services: turn.segmentServices as Partial<Record<LatencySegmentKey, LatencyServiceInfo>> | undefined,
          defaultServices: configuredLatencyServices,
        }),
      ),
    );
  }, [configuredLatencyServices, selectedAggregates]);
  const serviceStats = useMemo(() => {
    const segments = selectedLatencySegments;
    return computeSegmentServiceStats(segments).filter((s) =>
      s.segmentKey === "stt_ms" || s.segmentKey === "max_ms" || s.segmentKey === "tts_ms" || s.segmentKey === "rag_ms",
    );
  }, [selectedLatencySegments]);
  const evolutionPoints = useMemo(
    () => computeSegmentServiceEvolution(selectedLatencySegments).filter((p) =>
      p.segmentKey === "stt_ms" || p.segmentKey === "max_ms" || p.segmentKey === "tts_ms",
    ),
    [selectedLatencySegments],
  );
  const focused = aggregates.find((a) => a.session.id === focusId) ?? null;

  function setEvolutionFilter(segment: SegmentEvolutionKey, value: string) {
    setEvolutionServiceFilters((prev) => ({ ...prev, [segment]: value }));
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.has(id)) setHighlightedEvolutionSessionId(id);
      else if (highlightedEvolutionSessionId === id) setHighlightedEvolutionSessionId(next.values().next().value ?? null);
      return next;
    });
  }
  function selectAll() {
    const ids = filteredAggregates.map((a) => a.session.id);
    setSelectedIds(new Set(ids));
    setHighlightedEvolutionSessionId(ids[0] ?? null);
  }
  function selectNone() {
    setSelectedIds(new Set());
    setHighlightedEvolutionSessionId(null);
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
            Sélectionne une ou plusieurs sessions pour comparer leurs latences cumulatives. Par défaut: les {DEFAULT_SELECTED_SESSION_COUNT} plus récentes.
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
                    onClick={() => handleFocus(a.session.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="font-semibold truncate" title={a.session.id}>
                        {sessionLabel(a.session)}
                      </span>
                      <span className="text-muted-foreground shrink-0">{a.turnCount} tour(s)</span>
                    </div>
                    {a.session.name && (
                      <div className="font-mono text-[10px] text-muted-foreground/70">
                        {a.session.id.slice(0, 8)}
                      </div>
                    )}
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Sévérité min.
                  </label>
                  <Select
                    value={minSeverity}
                    onValueChange={(v) => setMinSeverity(v as SeverityFilter)}
                  >
                    <SelectTrigger className="h-8 text-xs w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="high">Élevée et plus</SelectItem>
                      <SelectItem value="critical">Critique uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Checkbox
                    checked={showRelative}
                    onCheckedChange={(v) => setShowRelative(Boolean(v))}
                  />
                  <span>Répartition relative</span>
                </label>
              </div>
            </div>

            {comparison ? (
              <>
                <LatencyVisualization
                  avg={comparison.avg}
                  showRelative={showRelative}
                  minSeverity={minSeverity}
                  expandedIds={expandedIds}
                  onToggleExpanded={toggleExpanded}
                  perSessionRows={selectedAggregates.map((a) => ({
                    id: a.session.id,
                    label: sessionLabel(a.session),
                    sublabel: `${a.turnCount} tour(s)${
                      a.session.started_at
                        ? " · " + new Date(a.session.started_at).toLocaleDateString("fr-CH")
                        : ""
                    }${a.session.name ? " · " + a.session.id.slice(0, 8) : ""}`,
                    avg: a.avg,
                    turnCount: a.turnCount,
                    dispersion: computeDispersion(
                      a.turns
                        .map((t) => t.total_ms)
                        .filter((v): v is number => typeof v === "number"),
                    ),
                    turns: a.turns,
                  }))}
                />
                <div className="mt-4">
                  <ServiceComparisonPanel
                    stats={serviceStats}
                    metric={serviceMetric}
                    onMetricChange={setServiceMetric}
                  />
                </div>
                <div className="mt-4">
                  <LatencyEvolutionPanel
                    points={evolutionPoints}
                    serviceFilters={evolutionServiceFilters}
                    onServiceFilterChange={setEvolutionFilter}
                    highlightedSessionId={highlightedEvolutionSessionId}
                    onHighlightSession={setHighlightedEvolutionSessionId}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucune donnée à comparer. Coche des sessions dans la liste à gauche.
              </p>
            )}
          </div>

          {/* Focused session detail */}
          {focused && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold">{sessionLabel(focused.session)}</h3>
                  <p className="text-[10px] font-mono text-muted-foreground/70">{focused.session.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {focused.turnCount} tour(s) Max • Game over&nbsp;: {focused.session.game_over_reason || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {focused.lastBlocker?.step ? (
                    <Badge variant="destructive">Blocage : {focused.lastBlocker.step}</Badge>
                  ) : (
                    <Badge variant="secondary">Aucun blocage</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setConversationOpen(true)}
                    disabled={!Array.isArray(focused.session.conversation_log) || focused.session.conversation_log.length === 0}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" /> Voir la conversation
                  </Button>
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

              <Sheet open={conversationOpen} onOpenChange={setConversationOpen}>
                <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-base">
                      Conversation — {sessionLabel(focused.session)}
                    </SheetTitle>
                    <SheetDescription className="text-xs font-mono">
                      {focused.session.id}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-2">
                    {Array.isArray(focused.session.conversation_log) &&
                      focused.session.conversation_log.map((msg: ConversationMessage, i: number) => (
                        <div
                          key={i}
                          className={`text-sm rounded p-2 ${
                            msg.role === "max"
                              ? "bg-blue-500/10 border border-blue-500/20"
                              : "bg-emerald-500/10 border border-emerald-500/20"
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
                            <span className="font-semibold">{msg.role === "max" ? "Max" : "Utilisateur"}</span>
                            {msg.pipeline?.total_ms != null && (
                              <span className="font-mono">{fmtMs(msg.pipeline.total_ms)}</span>
                            )}
                            {msg.pipeline?.blocker && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                blocker: {msg.pipeline.blocker}
                              </Badge>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        </div>
                      ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
