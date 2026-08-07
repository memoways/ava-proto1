import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  evaluateCanaryReadiness,
  INTERNAL_CANARY_THRESHOLDS,
  type CanaryCheckStatus,
} from "@/services/releaseReadiness";
import {
  loadInternalLatencyComparison,
  loadPosthogLatencyStats,
  type InternalLatencyComparison,
  type PercentileMetric,
  type PosthogLatencyStats,
  type PosthogPeriod,
} from "@/services/posthogLatencyStats";

const PERIODS: Array<{ key: PosthogPeriod; label: string }> = [
  { key: "24h", label: "24 heures" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "custom", label: "Personnalisée" },
];

function fmtMs(value: number | null): string {
  if (value == null) return "non mesuré";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function fmtRate(value: number | null): string {
  return value == null ? "non mesuré" : `${(value * 100).toFixed(2)} %`;
}

function MetricCard({ label, metric, source = "PostHog" }: { label: string; metric: PercentileMetric; source?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><Badge variant="outline" className="text-[10px]">{source}</Badge></div>
      <p className="mt-2 font-mono text-sm">p50 {fmtMs(metric.p50)} · p95 {fmtMs(metric.p95)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{metric.measured} mesure(s)</p>
    </div>
  );
}

function statusClass(status: CanaryCheckStatus): string {
  if (status === "pass") return "border-emerald-600/50 text-emerald-400";
  if (status === "fail") return "border-red-600/50 text-red-400";
  return "border-amber-600/50 text-amber-300";
}

export default function LatencyTelemetryTab() {
  const [period, setPeriod] = useState<PosthogPeriod>("24h");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState({ character: "", model: "", stt: "", tts: "", browser: "" });
  const [stats, setStats] = useState<PosthogLatencyStats | null>(null);
  const [internal, setInternal] = useState<InternalLatencyComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costBudget, setCostBudget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const posthog = await loadPosthogLatencyStats({
        period,
        ...(period === "custom" ? { from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined } : {}),
        filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim())),
      });
      setStats(posthog);
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
  }, [filters, from, period, to]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Latences PostHog</h2><Badge>PostHog</Badge></div>
          <p className="text-xs text-muted-foreground">Mesures analytics distantes, séparées des mesures internes Supabase.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Chargement…" : "Actualiser"}</Button>
      </div>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => <Button key={item.key} size="sm" variant={period === item.key ? "default" : "outline"} onClick={() => setPeriod(item.key)}>{item.label}</Button>)}
        </div>
        {period === "custom" && <div className="grid gap-2 sm:grid-cols-2"><Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Début" /><Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fin" /></div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Object.keys(filters).map((key) => <Input key={key} value={filters[key as keyof typeof filters]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} placeholder={key === "character" ? "Personnage" : key === "model" ? "Modèle Max" : key.toUpperCase()} aria-label={`Filtre ${key}`} />)}
        </div>
      </section>

      {error && (
        <section className="rounded-lg border border-red-700/50 bg-red-950/20 p-4">
          <h3 className="font-semibold text-red-300">PostHog indisponible</h3>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Aucune donnée Supabase n’est substituée silencieusement. Vérifiez le rôle admin, le secret Lovable, le quota et l’identifiant de projet.</p>
        </section>
      )}

      {stats && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs">
            <div><Badge variant="outline">Source PostHog</Badge> fraîcheur {new Date(stats.freshAt).toLocaleString("fr-FR")}</div>
            <div>Période interrogée : {new Date(stats.period.from).toLocaleString("fr-FR")} → {new Date(stats.period.to).toLocaleString("fr-FR")}</div>
            <a href={stats.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">Dashboard PostHog <ExternalLink className="h-3 w-3" /></a>
          </section>

          {!stats.hasData && (
            <section className="rounded-lg border border-amber-700/40 bg-amber-950/10 p-5 text-sm text-amber-100">
              PostHog a répondu correctement, mais aucun événement correspondant n’existe sur cette période. Il s’agit d’une absence de données, pas d’une mesure égale à zéro.
            </section>
          )}

          {stats.hasData && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Sessions / tours</p><p className="mt-2 text-xl font-semibold">{stats.totals.sessions} / {stats.totals.turns}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Erreurs</p><p className="mt-2 text-xl font-semibold">{stats.totals.errors} · {fmtRate(stats.totals.errorRate)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Fallbacks</p><p className="mt-2 text-xl font-semibold">{stats.totals.fallbacks} · {fmtRate(stats.totals.fallbackRate)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Blocker dominant</p><p className="mt-2 text-xl font-semibold">{stats.blockers[0]?.key ?? "non mesuré"}</p></div>
          </div>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Texte du personnage prêt" metric={stats.latency.responseReady} />
            <MetricCard label="Premier son" metric={stats.latency.firstSound} />
            <MetricCard label="End-to-end" metric={stats.latency.endToEnd} />
            <MetricCard label="STT" metric={stats.latency.stt} />
            <MetricCard label="RAG" metric={stats.latency.rag} />
            <MetricCard label="Max LLM" metric={stats.latency.max} />
            <MetricCard label="TTS fournisseur" metric={stats.latency.tts} />
            <MetricCard label="GM post-tour" metric={stats.latency.gmPost} />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Actions d’expérience</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Cinématiques</p><p>recommandées {stats.actions.cinematics.recommended} · jouées {stats.actions.cinematics.played} · passées {stats.actions.cinematics.skipped}</p></div>
                <div><p className="text-muted-foreground">Handoffs</p><p>proposés {stats.actions.handoffs.proposed} · acceptés {stats.actions.handoffs.accepted} · refusés {stats.actions.handoffs.refused} · exécutés {stats.actions.handoffs.executed} · bloqués {stats.actions.handoffs.blocked}</p></div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Répartition</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(stats.providers).map(([key, values]) => <div key={key}><p className="font-medium">{key}</p><p className="text-muted-foreground">{values.length ? values.slice(0, 4).map((item) => `${item.key} (${item.count})`).join(" · ") : "non mesuré"}</p></div>)}
              </div>
            </div>
          </section>

          <section className="rounded-lg border p-4 space-y-3">
            <div><h3 className="font-semibold">Comparaison sans fusion</h3><p className="text-xs text-muted-foreground">Chaque colonne conserve sa source. La parité utilise le même `turn_id`.</p></div>
            {internal ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm font-medium"><span>Mesure</span><span>PostHog</span><span>Supabase interne</span></div>
                {comparison.map((row) => <div key={row.label} className="grid grid-cols-3 gap-2 border-t pt-2 text-sm"><span>{row.label}</span><span>{row.posthog}</span><span>{row.internal}</span></div>)}
                <p className="text-xs text-muted-foreground">Absents de l’interne : {internal.missingInInternal} · uniquement internes : {internal.onlyInternal} · persistance : {fmtRate(internal.persistenceRate)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">Comparaison interne non disponible ; les statistiques PostHog restent valides et identifiées.</p>}
          </section>

          <section className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h3 className="font-semibold">Canary interne — décision de déploiement</h3><p className="text-xs text-muted-foreground">Performance et erreurs : PostHog · persistance : Supabase · coût : consommations LLM/voix.</p></div>
              <div className="w-56"><label className="text-xs text-muted-foreground">Budget maximum / session (USD)</label><Input type="number" min="0" step="0.001" value={costBudget} onChange={(event) => setCostBudget(event.target.value)} placeholder="à approuver" /></div>
            </div>
            {canary && <><Badge variant="outline">{canary.decision === "promote" ? "PROMOUVOIR" : canary.decision === "rollback" ? "REVENIR EN ARRIÈRE" : "DONNÉES MANQUANTES / ATTENTE"}</Badge><div className="grid gap-2 md:grid-cols-2">{canary.checks.map((check) => <div key={check.key} className={`rounded border p-2 text-xs ${statusClass(check.status)}`}>{check.detail}<span className="ml-1 opacity-70">({check.key === "persistenceRate" || check.key === "costPerSessionUsd" ? "Supabase" : "PostHog"})</span></div>)}</div></>}
          </section>
          </>}
        </>
      )}

      {!loading && !error && !stats && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Aucune donnée PostHog pour cette période. Cela ne signifie pas zéro.</p>}
    </div>
  );
}
