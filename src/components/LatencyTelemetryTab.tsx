import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  FilterX,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Timer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  evaluateCanaryReadiness,
  INTERNAL_CANARY_THRESHOLDS,
  type CanaryCheckStatus,
} from "@/services/releaseReadiness";
import {
  loadInternalLatencyComparison,
  loadPosthogLatencyStats,
  type InternalLatencyComparison,
  type PosthogLatencyStats,
  type PosthogPeriod,
  type PosthogSlowTurn,
  type PosthogTimelinePoint,
} from "@/services/posthogLatencyStats";

const POSTHOG_DASHBOARD_URL = "https://eu.posthog.com/project/137897/dashboard";
const ALL_FILTER_VALUE = "__all__";

const PERIODS: Array<{ key: PosthogPeriod; label: string }> = [
  { key: "24h", label: "24 heures" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "custom", label: "Personnalisée" },
];

const FILTER_CONFIG = [
  { key: "character", label: "Personnage", providerKey: "characters" },
  { key: "model", label: "Modèle Max", providerKey: "models" },
  { key: "stt", label: "STT", providerKey: "stt" },
  { key: "tts", label: "TTS", providerKey: "tts" },
  { key: "browser", label: "Navigateur", providerKey: "browsers" },
] as const;

type FilterKey = (typeof FILTER_CONFIG)[number]["key"];
type ProviderKey = (typeof FILTER_CONFIG)[number]["providerKey"];
type FilterState = Record<FilterKey, string>;
type FilterOptions = Record<FilterKey, string[]>;
type TimelineMetric = "responseReady" | "firstSound" | "endToEnd";

const EMPTY_FILTERS: FilterState = { character: "", model: "", stt: "", tts: "", browser: "" };
const EMPTY_FILTER_OPTIONS: FilterOptions = { character: [], model: [], stt: [], tts: [], browser: [] };

const LATENCY_STAGES = [
  { key: "responseReady", label: "Texte prêt" },
  { key: "firstSound", label: "Premier son" },
  { key: "endToEnd", label: "End-to-end" },
  { key: "stt", label: "STT" },
  { key: "rag", label: "RAG" },
  { key: "max", label: "Max LLM" },
  { key: "tts", label: "TTS fournisseur" },
  { key: "gmPost", label: "GM post-tour" },
] as const;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--trust-color))",
  "hsl(var(--cinema-blue))",
  "hsl(var(--muted-foreground))",
];

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  models: "Modèles Max",
  stt: "Providers STT",
  tts: "Providers TTS",
  browsers: "Navigateurs",
  characters: "Personnages",
};

function fmtMs(value: number | null): string {
  if (value == null) return "non mesuré";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function fmtRate(value: number | null): string {
  return value == null ? "non mesuré" : `${(value * 100).toFixed(2)} %`;
}

function shortId(value: string | null): string {
  if (!value) return "—";
  return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function statusClass(status: CanaryCheckStatus): string {
  if (status === "pass") return "border-emerald-600/50 text-emerald-400";
  if (status === "fail") return "border-red-600/50 text-red-400";
  return "border-amber-600/50 text-amber-300";
}

function mergeFilterOptions(current: FilterOptions, stats: PosthogLatencyStats): FilterOptions {
  const next = { ...current };
  for (const config of FILTER_CONFIG) {
    const incoming = stats.providers[config.providerKey].map((item) => item.key);
    next[config.key] = [...new Set([...current[config.key], ...incoming])].sort((left, right) => left.localeCompare(right));
  }
  return next;
}

function timelineValue(point: PosthogTimelinePoint, metric: TimelineMetric, percentile: "P50" | "P95") {
  if (metric === "responseReady") return percentile === "P50" ? point.responseReadyP50 : point.responseReadyP95;
  if (metric === "firstSound") return percentile === "P50" ? point.firstSoundP50 : point.firstSoundP95;
  return percentile === "P50" ? point.endToEndP50 : point.endToEndP95;
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneClass = tone === "danger"
    ? "border-red-500/35 bg-red-500/5 text-red-300"
    : tone === "warning"
      ? "border-amber-500/35 bg-amber-500/5 text-amber-200"
      : "border-border bg-card";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="rounded-lg border bg-background/60 p-2"><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  );
}

function ChartShell({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function LatencyTelemetryTab({ initialStats }: { initialStats?: PosthogLatencyStats }) {
  const [period, setPeriod] = useState<PosthogPeriod>("24h");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS);
  const [stats, setStats] = useState<PosthogLatencyStats | null>(() => initialStats ?? null);
  const [internal, setInternal] = useState<InternalLatencyComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costBudget, setCostBudget] = useState("");
  const [timelineMetric, setTimelineMetric] = useState<TimelineMetric>("endToEnd");
  const [providerDimension, setProviderDimension] = useState<ProviderKey>("models");
  const [selectedSlowTurn, setSelectedSlowTurn] = useState<PosthogSlowTurn | null>(null);
  const [includeSandbox, setIncludeSandbox] = useState(false);

  const load = useCallback(async (requestedFilters: FilterState = filters) => {
    if (initialStats) {
      setStats(initialStats);
      setFilterOptions((current) => mergeFilterOptions(current, initialStats));
      setSelectedSlowTurn(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const posthog = await loadPosthogLatencyStats({
        period,
        ...(period === "custom" ? { from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined } : {}),
        filters: Object.fromEntries(Object.entries(requestedFilters).filter(([, value]) => value.trim())),
        include_sandbox: includeSandbox,
      });
      setStats(posthog);
      setFilterOptions((current) => mergeFilterOptions(current, posthog));
      setSelectedSlowTurn(null);
      try {
        setInternal(await loadInternalLatencyComparison(posthog));
      } catch (comparisonError) {
        console.warn("[Latency PostHog] internal comparison unavailable", comparisonError);
        setInternal(null);
      }
    } catch (loadError) {
      setStats(null);
      setInternal(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters, from, includeSandbox, initialStats, period, to]);

  useEffect(() => {
    if (initialStats) {
      setFilterOptions((current) => mergeFilterOptions(current, initialStats));
      return;
    }
    void load();
  }, [includeSandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  const canary = useMemo(() => stats ? evaluateCanaryReadiness({
    sessionCount: stats.totals.sessions,
    turnCount: stats.totals.turns,
    p95FirstSoundMs: stats.latency.firstSound.p95,
    turnErrorRate: stats.totals.errorRate,
    persistenceRate: internal?.persistenceRate ?? null,
    costPerSessionUsd: internal?.costPerSessionUsd ?? null,
  }, {
    ...INTERNAL_CANARY_THRESHOLDS,
    maximumCostPerSessionUsd: costBudget ? Number(costBudget) : null,
  }) : null, [costBudget, internal, stats]);

  const comparison = stats && internal ? [
    { label: "Tours", posthog: String(stats.totals.turns), internal: String(internal.turnCount) },
    { label: "p50 texte prêt", posthog: fmtMs(stats.latency.responseReady.p50), internal: fmtMs(internal.p50ResponseReadyMs) },
    { label: "p95 texte prêt", posthog: fmtMs(stats.latency.responseReady.p95), internal: fmtMs(internal.p95ResponseReadyMs) },
    { label: "p50 premier son", posthog: fmtMs(stats.latency.firstSound.p50), internal: fmtMs(internal.p50FirstSoundMs) },
    { label: "p95 premier son", posthog: fmtMs(stats.latency.firstSound.p95), internal: fmtMs(internal.p95FirstSoundMs) },
  ] : [];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const latencyChartData = useMemo(() => stats ? LATENCY_STAGES.map((stage) => ({
    label: stage.label,
    p50: stats.latency[stage.key].p50,
    p95: stats.latency[stage.key].p95,
    measured: stats.latency[stage.key].measured,
  })) : [], [stats]);
  const timelineChartData = useMemo(() => (stats?.timeline ?? []).map((point) => ({
    timestamp: new Date(point.timestamp).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    p50: timelineValue(point, timelineMetric, "P50"),
    p95: timelineValue(point, timelineMetric, "P95"),
    turns: point.turns,
  })), [stats, timelineMetric]);
  const providerChartData = stats?.providers[providerDimension] ?? [];
  const blockerChartData = (stats?.blockers ?? []).slice(0, 8);
  const actionChartData = stats ? [
    { label: "Vidéos recommandées", count: stats.actions.cinematics.recommended },
    { label: "Vidéos jouées", count: stats.actions.cinematics.played },
    { label: "Vidéos passées", count: stats.actions.cinematics.skipped },
    { label: "Handoffs proposés", count: stats.actions.handoffs.proposed },
    { label: "Handoffs acceptés", count: stats.actions.handoffs.accepted },
    { label: "Handoffs refusés", count: stats.actions.handoffs.refused },
    { label: "Handoffs exécutés", count: stats.actions.handoffs.executed },
    { label: "Handoffs bloqués", count: stats.actions.handoffs.blocked },
  ] : [];

  const resetFilters = () => {
    const empty = { ...EMPTY_FILTERS };
    setFilters(empty);
    void load(empty);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Latences PostHog</h2><Badge>PostHog</Badge></div>
          <p className="text-xs text-muted-foreground">Diagnostic des parcours voix à partir des mesures analytics distantes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={includeSandbox} onCheckedChange={setIncludeSandbox} /> Inclure les sandboxes
          </label>
          <Button size="sm" variant="outline" asChild>
            <a href={POSTHOG_DASHBOARD_URL} target="_blank" rel="noreferrer">Ouvrir dans PostHog <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Chargement…" : "Actualiser"}</Button>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((item) => <Button key={item.key} size="sm" variant={period === item.key ? "default" : "outline"} onClick={() => setPeriod(item.key)}>{item.label}</Button>)}
          </div>
          {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}</Badge>}
        </div>
        {period === "custom" && <div className="grid gap-2 sm:grid-cols-2"><Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Début" /><Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fin" /></div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {FILTER_CONFIG.map((config) => (
            <Select
              key={config.key}
              value={filters[config.key] || ALL_FILTER_VALUE}
              onValueChange={(value) => setFilters((current) => ({ ...current, [config.key]: value === ALL_FILTER_VALUE ? "" : value }))}
            >
              <SelectTrigger aria-label={`Filtre ${config.label}`}><SelectValue placeholder={config.label} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>Tous — {config.label}</SelectItem>
                {filterOptions[config.key].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Les choix proviennent des valeurs réellement observées dans PostHog.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={resetFilters} disabled={!activeFilterCount || loading}><FilterX className="mr-1 h-3.5 w-3.5" />Réinitialiser</Button>
            <Button size="sm" onClick={() => void load()} disabled={loading}>Appliquer les filtres</Button>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-xl border border-red-700/50 bg-red-950/20 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-red-300"><AlertTriangle className="h-4 w-4" />PostHog indisponible</h3>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Aucune donnée Supabase n’est substituée silencieusement. Vérifiez le rôle admin, le secret Lovable, le quota et l’identifiant de projet.</p>
        </section>
      )}

      {stats && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3 text-xs">
            <div className="flex items-center gap-2"><Badge variant="outline">Source PostHog</Badge><span>fraîcheur {new Date(stats.freshAt).toLocaleString("fr-FR")}</span></div>
            <div>Période : {new Date(stats.period.from).toLocaleString("fr-FR")} → {new Date(stats.period.to).toLocaleString("fr-FR")}</div>
            <a href={POSTHOG_DASHBOARD_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Dashboard projet 137897 <ExternalLink className="h-3 w-3" /></a>
          </section>

          {!stats.hasData && (
            <section className="rounded-xl border border-amber-700/40 bg-amber-950/10 p-5 text-sm text-amber-100">
              PostHog a répondu correctement, mais aucun événement correspondant n’existe sur cette période. Il s’agit d’une absence de données, pas d’une mesure égale à zéro.
            </section>
          )}

          {stats.hasData && <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Sessions analysées" value={String(stats.totals.sessions)} detail={`${stats.totals.turns} tours voix`} icon={Activity} />
              <SummaryCard label="Erreurs" value={fmtRate(stats.totals.errorRate)} detail={`${stats.totals.errors} tour${stats.totals.errors > 1 ? "s" : ""} en échec`} icon={AlertTriangle} tone={stats.totals.errors ? "danger" : "neutral"} />
              <SummaryCard label="Fallbacks" value={fmtRate(stats.totals.fallbackRate)} detail={`${stats.totals.fallbacks} récupération${stats.totals.fallbacks > 1 ? "s" : ""}`} icon={RotateCcw} tone={stats.totals.fallbacks ? "warning" : "neutral"} />
              <SummaryCard label="Blocker dominant" value={stats.blockers[0]?.key ?? "Aucun"} detail={stats.blockers[0] ? `${stats.blockers[0].count} occurrence${stats.blockers[0].count > 1 ? "s" : ""}` : "aucun blocker remonté"} icon={GitBranch} tone={stats.blockers[0] ? "warning" : "neutral"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartShell
                title="Évolution des latences"
                description="P50 et p95 par tranche de temps — survolez un point pour voir le nombre de tours."
                action={(
                  <Select value={timelineMetric} onValueChange={(value) => setTimelineMetric(value as TimelineMetric)}>
                    <SelectTrigger className="h-9 w-[190px] text-xs" aria-label="Mesure de la chronologie"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="endToEnd">End-to-end</SelectItem>
                      <SelectItem value="firstSound">Premier son</SelectItem>
                      <SelectItem value="responseReady">Texte prêt</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              >
                {timelineChartData.length ? <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => fmtMs(value)} width={60} />
                      <RechartsTooltip formatter={(value) => fmtMs(Number(value))} labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.turns ?? 0} tour(s)`} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="p95" name="p95" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" strokeWidth={2} connectNulls />
                      <Area type="monotone" dataKey="p50" name="p50" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.08)" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div> : <p className="py-20 text-center text-sm text-muted-foreground">Pas assez de points horodatés pour afficher l’évolution.</p>}
              </ChartShell>

              <ChartShell title="Décomposition de la latence" description="Comparez la médiane au p95 : un grand écart révèle des expériences irrégulières.">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={latencyChartData} layout="vertical" margin={{ top: 0, right: 18, left: 12, bottom: 0 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value: number) => fmtMs(value)} />
                      <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(value) => fmtMs(Number(value))} labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.measured ?? 0} mesure(s)`} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="p50" name="p50" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="p95" name="p95" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartShell>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <ChartShell title="Top blockers" description="Étapes les plus souvent signalées comme responsables.">
                {blockerChartData.length ? <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={blockerChartData} layout="vertical" margin={{ left: 10, right: 20 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="key" width={78} tick={{ fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Occurrences" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div> : <p className="py-20 text-center text-sm text-muted-foreground">Aucun blocker remonté.</p>}
              </ChartShell>

              <ChartShell
                title="Répartition technique"
                description="Changez de dimension pour repérer une concentration."
                action={(
                  <Select value={providerDimension} onValueChange={(value) => setProviderDimension(value as ProviderKey)}>
                    <SelectTrigger className="h-9 w-[160px] text-xs" aria-label="Dimension technique"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PROVIDER_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              >
                {providerChartData.length ? <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={providerChartData.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="key" width={105} tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 16)}…` : value} />
                      <RechartsTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Tours" radius={[0, 4, 4, 0]}>{providerChartData.slice(0, 8).map((item, index) => <Cell key={item.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div> : <p className="py-20 text-center text-sm text-muted-foreground">Cette dimension n’est pas mesurée.</p>}
              </ChartShell>

              <ChartShell title="Actions d’expérience" description="Volumes de cinématiques et de handoffs sur la période.">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionChartData} layout="vertical" margin={{ left: 22, right: 20 }} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 9 }} />
                      <RechartsTooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Actions" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartShell>
            </div>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold"><Timer className="h-4 w-4" />Tours les plus lents</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Cliquez une ligne pour détailler la chaîne STT → RAG → LLM → TTS.</p>
                </div>
                <Badge variant="outline">top {(stats.slowestTurns ?? []).length}</Badge>
              </div>
              {(stats.slowestTurns ?? []).length ? <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr><th className="p-3 text-left font-medium">Heure</th><th className="p-3 text-left font-medium">Tour</th><th className="p-3 text-left font-medium">Session</th><th className="p-3 text-left font-medium">End-to-end</th><th className="p-3 text-left font-medium">Premier son</th><th className="p-3 text-left font-medium">Blocker</th><th className="p-3 text-left font-medium">Modèle</th><th className="p-3 text-left font-medium">TTS</th><th className="p-3 text-left font-medium">État</th></tr>
                    </thead>
                    <tbody>
                      {(stats.slowestTurns ?? []).map((turn, index) => {
                        const selected = selectedSlowTurn?.turnId === turn.turnId && selectedSlowTurn?.timestamp === turn.timestamp;
                        return <tr
                          key={`${turn.turnId ?? turn.timestamp}-${index}`}
                          className={`cursor-pointer border-t transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${selected ? "bg-primary/10" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          onClick={() => setSelectedSlowTurn(selected ? null : turn)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSlowTurn(selected ? null : turn); } }}
                        >
                          <td className="p-3">{new Date(turn.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                          <td className="p-3 font-mono">#{turn.turnIndex ?? "?"}</td>
                          <td className="p-3 font-mono text-muted-foreground">{shortId(turn.sessionId)}</td>
                          <td className="p-3 font-mono font-semibold">{fmtMs(turn.endToEndMs)}</td>
                          <td className="p-3 font-mono">{fmtMs(turn.firstSoundMs)}</td>
                          <td className="p-3"><Badge variant="secondary">{turn.blocker ?? "—"}</Badge></td>
                          <td className="max-w-[180px] truncate p-3" title={turn.model ?? undefined}>{turn.model ?? "—"}</td>
                          <td className="p-3">{turn.tts ?? "—"}</td>
                          <td className="p-3">{turn.severity === "failed" ? <Badge variant="destructive">Erreur</Badge> : turn.fallback ? <Badge variant="outline">Fallback</Badge> : <Badge variant="secondary">OK</Badge>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                {selectedSlowTurn && <div className="border-t bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-sm font-semibold">Détail du tour #{selectedSlowTurn.turnIndex ?? "?"}</p><p className="text-xs text-muted-foreground">{selectedSlowTurn.character ?? "personnage inconnu"} · {selectedSlowTurn.browser ?? "navigateur inconnu"} · id {shortId(selectedSlowTurn.turnId)}</p></div>
                    <Badge variant="outline">{selectedSlowTurn.stt ?? "STT ?"} → {selectedSlowTurn.tts ?? "TTS ?"}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                    {[
                      ["STT", selectedSlowTurn.sttMs], ["RAG", selectedSlowTurn.ragMs], ["Max LLM", selectedSlowTurn.maxMs], ["TTS", selectedSlowTurn.ttsMs],
                      ["Texte prêt", selectedSlowTurn.responseReadyMs], ["Premier son", selectedSlowTurn.firstSoundMs], ["End-to-end", selectedSlowTurn.endToEndMs],
                    ].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-background p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-semibold">{fmtMs(value as number | null)}</p></div>)}
                  </div>
                </div>}
              </> : <p className="p-8 text-center text-sm text-muted-foreground">Aucun tour détaillé n’est disponible pour cette période.</p>}
            </section>

            <section className="rounded-xl border bg-card p-4 space-y-3">
              <div><h3 className="font-semibold">Comparaison sans fusion</h3><p className="text-xs text-muted-foreground">Chaque colonne conserve sa source. La parité utilise le même `turn_id`.</p></div>
              {internal ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-sm font-medium"><span>Mesure</span><span>PostHog</span><span>Supabase interne</span></div>
                  {comparison.map((row) => <div key={row.label} className="grid grid-cols-3 gap-2 border-t pt-2 text-sm"><span>{row.label}</span><span>{row.posthog}</span><span>{row.internal}</span></div>)}
                  <p className="text-xs text-muted-foreground">Absents de l’interne : {internal.missingInInternal} · uniquement internes : {internal.onlyInternal} · persistance : {fmtRate(internal.persistenceRate)}</p>
                </>
              ) : <p className="text-sm text-muted-foreground">Comparaison interne non disponible ; les statistiques PostHog restent valides et identifiées.</p>}
            </section>

            <section className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-semibold">Canary interne — décision de déploiement</h3><p className="text-xs text-muted-foreground">Performance et erreurs : PostHog · persistance : Supabase · coût : consommations LLM/voix.</p></div>
                <div className="w-56"><label className="text-xs text-muted-foreground">Budget maximum / session (USD)</label><Input type="number" min="0" step="0.001" value={costBudget} onChange={(event) => setCostBudget(event.target.value)} placeholder="à approuver" /></div>
              </div>
              {canary && <><Badge variant="outline">{canary.decision === "promote" ? "PROMOUVOIR" : canary.decision === "rollback" ? "REVENIR EN ARRIÈRE" : "DONNÉES MANQUANTES / ATTENTE"}</Badge><div className="grid gap-2 md:grid-cols-2">{canary.checks.map((check) => <div key={check.key} className={`rounded border p-2 text-xs ${statusClass(check.status)}`}>{check.detail}<span className="ml-1 opacity-70">({check.key === "persistenceRate" || check.key === "costPerSessionUsd" ? "Supabase" : "PostHog"})</span></div>)}</div></>}
            </section>
          </>}
        </>
      )}

      {!loading && !error && !stats && <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Aucune donnée PostHog pour cette période. Cela ne signifie pas zéro.</p>}
    </div>
  );
}
