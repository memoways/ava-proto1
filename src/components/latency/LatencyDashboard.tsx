import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildServiceTimeline,
  buildStageTimeline,
  compareServices,
  halfPeriodTrend,
  LATENCY_DIMENSIONS,
  LATENCY_STAGES,
  OTHER_SERVICE,
  pickBucket,
  stageCoverage,
  summarizeStages,
  topServices,
  type LatencyDimensionKey,
  type LatencySample,
  type LatencyStageKey,
} from "@/services/latencyAnalytics";

// Categorical slots in fixed order; each stage keeps its colour everywhere.
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const NEUTRAL = "#8a8a86";
const STAGE_COLORS: Record<LatencyStageKey, string> = {
  stt: SERIES[0],
  rag: SERIES[1],
  llm: SERIES[2],
  tts: SERIES[3],
  video: SERIES[4],
  responseReady: SERIES[5],
  firstSound: SERIES[6],
  endToEnd: SERIES[7],
  playback: NEUTRAL,
};
const TILE_STAGES: LatencyStageKey[] = ["firstSound", "responseReady", "endToEnd", "stt", "rag", "llm", "tts", "video"];
const PIPELINE_STAGES = LATENCY_STAGES.filter((stage) => stage.pipeline).map((stage) => stage.key);
const DEFAULT_LINES: LatencyStageKey[] = ["stt", "rag", "llm", "tts", "video"];
const TOOLTIP_STYLE = { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

type Percentile = "p50" | "p95";

function fmtMs(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function fmtAxisMs(value: number): string {
  return value < 1000 ? `${Math.round(value)}` : `${(value / 1000).toFixed(1)} s`;
}

function stageLabel(key: LatencyStageKey): string {
  return LATENCY_STAGES.find((stage) => stage.key === key)?.label ?? key;
}

function bucketLabel(start: number, bucketMs: number): string {
  const date = new Date(start);
  return bucketMs >= 24 * 3_600_000
    ? date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
    : date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Panel({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function PercentileToggle({ value, onChange }: { value: Percentile; onChange: (value: Percentile) => void }) {
  return (
    <div className="flex rounded-md border p-0.5" role="group" aria-label="Percentile">
      {(["p50", "p95"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          className={`rounded px-2.5 py-1 text-xs font-medium ${value === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {item === "p50" ? "Médiane (p50)" : "Pire 5 % (p95)"}
        </button>
      ))}
    </div>
  );
}

function TrendBadge({ deltaRate }: { deltaRate: number | null }) {
  if (deltaRate == null) return <span className="text-[11px] text-muted-foreground">tendance non calculable</span>;
  const percent = Math.round(deltaRate * 100);
  if (Math.abs(percent) < 5) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" />stable ({percent >= 0 ? "+" : ""}{percent} %)</span>;
  }
  const worse = percent > 0;
  const Icon = worse ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${worse ? "text-red-400" : "text-emerald-400"}`}>
      <Icon className="h-3 w-3" />{worse ? "plus lent" : "plus rapide"} {percent > 0 ? "+" : ""}{percent} %
    </span>
  );
}

function Sparkline({ data, color }: { data: Array<{ value: number | null }>; color: string }) {
  if (data.filter((point) => point.value != null).length < 2) return <div className="h-8" />;
  return (
    <div className="h-8 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LatencyDashboard({
  samples,
  period,
  capped = false,
}: {
  samples: LatencySample[];
  period: { from: string; to: string };
  capped?: boolean;
}) {
  const [percentile, setPercentile] = useState<Percentile>("p50");
  const [visibleStages, setVisibleStages] = useState<LatencyStageKey[]>(DEFAULT_LINES);
  const [serviceStage, setServiceStage] = useState<LatencyStageKey>("llm");
  const [dimension, setDimension] = useState<LatencyDimensionKey>("model");
  const [servicePercentile, setServicePercentile] = useState<Percentile>("p50");

  const bucket = useMemo(() => pickBucket(period.from, period.to), [period.from, period.to]);
  const summary = useMemo(() => summarizeStages(samples), [samples]);
  const coverage = useMemo(() => stageCoverage(samples), [samples]);
  const timeline = useMemo(() => buildStageTimeline(samples, period.from, period.to, bucket.ms), [samples, period.from, period.to, bucket.ms]);

  const timelineData = useMemo(() => timeline.map((point) => ({
    label: bucketLabel(point.start, bucket.ms),
    turns: point.turns,
    ...Object.fromEntries(LATENCY_STAGES.map((stage) => [stage.key, point.stages[stage.key][percentile]])),
  })), [timeline, bucket.ms, percentile]);

  const compositionData = useMemo(() => timeline.map((point) => ({
    label: bucketLabel(point.start, bucket.ms),
    turns: point.turns,
    ...Object.fromEntries(PIPELINE_STAGES.map((key) => [key, point.stages[key].mean])),
  })), [timeline, bucket.ms]);

  const services = useMemo(() => compareServices(samples, serviceStage, dimension), [samples, serviceStage, dimension]);
  const kept = useMemo(() => topServices(services), [services]);
  // Colour follows the service name (alphabetical), not its rank by volume.
  const serviceColors = useMemo(() => Object.fromEntries(
    [...kept].sort((left, right) => left.localeCompare(right)).map((key, index) => [key, SERIES[index % SERIES.length]]),
  ) as Record<string, string>, [kept]);
  const serviceTimeline = useMemo(() => buildServiceTimeline(samples, serviceStage, dimension, kept, period.from, period.to, bucket.ms)
    .map((point) => ({
      label: bucketLabel(point.start, bucket.ms),
      ...Object.fromEntries(Object.entries(point.values).map(([key, stats]) => [key, stats[servicePercentile]])),
    })), [samples, serviceStage, dimension, kept, period.from, period.to, bucket.ms, servicePercentile]);
  const hasOther = services.length > kept.length;
  const serviceLines = hasOther ? [...kept, OTHER_SERVICE] : kept;

  const chooseServiceStage = (value: LatencyStageKey) => {
    setServiceStage(value);
    const linked = LATENCY_STAGES.find((stage) => stage.key === value)?.service;
    if (linked) setDimension(linked);
  };

  const toggleStage = (key: LatencyStageKey) => setVisibleStages((current) => (
    current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
  ));

  if (!samples.length) {
    return (
      <section className="rounded-xl border border-amber-700/40 bg-amber-950/10 p-5 text-sm text-amber-100">
        Aucun tour vocal interne mesuré sur cette période et ces filtres. Il s’agit d’une absence de données, pas d’une latence nulle.
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge>AVA interne</Badge>
        <span>{samples.length} tours vocaux · points {bucket.label}</span>
        {capped && <Badge variant="outline" className="border-amber-600/50 text-amber-300">Lecture limitée aux 20 000 premiers événements : réduisez la période</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILE_STAGES.map((key) => {
          const stats = summary[key];
          const trend = halfPeriodTrend(samples, key, period.from, period.to);
          return (
            <div key={key} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLORS[key] }} />{stageLabel(key)}
                </p>
                <TrendBadge deltaRate={trend.deltaRate} />
              </div>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{fmtMs(stats.p50)}</p>
              <p className="text-[11px] text-muted-foreground">p95 {fmtMs(stats.p95)} · {stats.count} mesure{stats.count > 1 ? "s" : ""} · {coverage[key] == null ? "—" : `${Math.round((coverage[key] ?? 0) * 100)} % des tours`}</p>
              <Sparkline data={timeline.map((point) => ({ value: point.stages[key].p50 }))} color={STAGE_COLORS[key]} />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Grand chiffre = médiane. Tendance = médiane de la moitié récente de la période comparée à la moitié ancienne.</p>

      <Panel
        title="Évolution des latences par étape"
        description="Chaque courbe suit une étape du tour vocal dans le temps. Survolez un point pour lire toutes les valeurs et le nombre de tours."
        action={<PercentileToggle value={percentile} onChange={setPercentile} />}
      >
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Étapes affichées">
          {LATENCY_STAGES.map((stage) => {
            const active = visibleStages.includes(stage.key);
            return (
              <button
                key={stage.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStage(stage.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${active ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground opacity-70 hover:opacity-100"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[stage.key] }} />{stage.label}
              </button>
            );
          })}
        </div>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={32} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtAxisMs} width={48} />
              <RechartsTooltip
                formatter={(value, name) => [fmtMs(value as number | null), name]}
                labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.turns ?? 0} tour(s)`}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {LATENCY_STAGES.filter((stage) => visibleStages.includes(stage.key)).map((stage) => (
                <Line key={stage.key} type="monotone" dataKey={stage.key} name={stage.label} stroke={STAGE_COLORS[stage.key]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Où passe le temps d’attente"
          description="Durée moyenne de chaque étape, empilée par période. La hauteur totale approche l’attente avant que le personnage parle."
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compositionData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtAxisMs} width={48} />
                <RechartsTooltip
                  formatter={(value, name) => [fmtMs(value as number | null), name]}
                  labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.turns ?? 0} tour(s)`}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {PIPELINE_STAGES.map((key, index) => (
                  <Bar key={key} dataKey={key} name={stageLabel(key)} stackId="wait" fill={STAGE_COLORS[key]} stroke="hsl(var(--card))" strokeWidth={1} radius={index === PIPELINE_STAGES.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Comparer les services"
          description="Latence d’une étape selon le service, le modèle ou le contexte utilisé."
          action={<>
            <Select value={serviceStage} onValueChange={(value) => chooseServiceStage(value as LatencyStageKey)}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Étape comparée"><SelectValue /></SelectTrigger>
              <SelectContent>{LATENCY_STAGES.map((stage) => <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={dimension} onValueChange={(value) => setDimension(value as LatencyDimensionKey)}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Regrouper par"><SelectValue /></SelectTrigger>
              <SelectContent>{LATENCY_DIMENSIONS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </>}
        >
          {services.length ? <>
            <div className="w-full" style={{ height: Math.max(160, Math.min(services.length, 8) * 44 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={services.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtAxisMs} />
                  <YAxis type="category" dataKey="key" width={130} tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.length > 22 ? `${value.slice(0, 20)}…` : value} />
                  <RechartsTooltip
                    formatter={(value, name) => [fmtMs(value as number | null), name]}
                    labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.count ?? 0} mesure(s)`}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="p50" name="Médiane (p50)" fill={SERIES[0]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  <Bar dataKey="p95" name="Pire 5 % (p95)" fill="#b5b4ad" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="py-1.5 text-left font-medium">{LATENCY_DIMENSIONS.find((item) => item.key === dimension)?.label}</th><th className="py-1.5 text-right font-medium">Mesures</th><th className="py-1.5 text-right font-medium">p50</th><th className="py-1.5 text-right font-medium">p95</th><th className="py-1.5 text-right font-medium">Moyenne</th></tr></thead>
                <tbody>{services.map((service) => <tr key={service.key} className="border-t"><td className="max-w-[220px] truncate py-1.5" title={service.key}>{service.key}</td><td className="py-1.5 text-right font-mono">{service.count}</td><td className="py-1.5 text-right font-mono">{fmtMs(service.p50)}</td><td className="py-1.5 text-right font-mono">{fmtMs(service.p95)}</td><td className="py-1.5 text-right font-mono">{fmtMs(service.mean)}</td></tr>)}</tbody>
              </table>
            </div>
          </> : <p className="py-16 text-center text-sm text-muted-foreground">L’étape {stageLabel(serviceStage)} n’est pas mesurée sur cette période.</p>}
        </Panel>
      </div>

      <Panel
        title={`Évolution par service — ${stageLabel(serviceStage)}`}
        description={`Une courbe par valeur de « ${LATENCY_DIMENSIONS.find((item) => item.key === dimension)?.label} » (les cinq plus utilisées, le reste regroupé dans « Autres »). Changez l’étape et le regroupement dans « Comparer les services ».`}
        action={<PercentileToggle value={servicePercentile} onChange={setServicePercentile} />}
      >
        {serviceLines.length ? <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serviceTimeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={32} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtAxisMs} width={48} />
              <RechartsTooltip formatter={(value, name) => [fmtMs(value as number | null), name]} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {serviceLines.map((key) => (
                <Line key={key} type="monotone" dataKey={key} name={key} stroke={key === OTHER_SERVICE ? NEUTRAL : serviceColors[key]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="py-16 text-center text-sm text-muted-foreground">Aucune mesure pour cette étape.</p>}
      </Panel>
    </div>
  );
}
