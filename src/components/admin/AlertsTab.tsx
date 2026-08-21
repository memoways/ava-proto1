import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, RefreshCw, ShieldAlert, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminEnvironment } from "@/contexts/AdminEnvironmentContext";

interface VoiceErrorRow {
  id: string;
  created_at: string;
  component: string;
  error_type: string;
  provider: string | null;
}

interface TurnEventRow {
  severity: string | null;
  metadata_json: { had_fallback?: boolean } | null;
}

interface LatencyRow {
  t_turn_total_ms: number | null;
}

interface LlmUsageRow {
  total_tokens: number | null;
  model: string;
  session_id: string | null;
}

const P95_TARGET_MS = 2_000;
const LLM_BUDGET_WARNING_TOKENS = 12_000;

export default function AlertsTab() {
  const { environmentId } = useAdminEnvironment();
  const [errors, setErrors] = useState<VoiceErrorRow[]>([]);
  const [turns, setTurns] = useState<TurnEventRow[]>([]);
  const [latencies, setLatencies] = useState<LatencyRow[]>([]);
  const [usage, setUsage] = useState<LlmUsageRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("id")
      .eq("environment_id", environmentId)
      .gte("started_at", since);
    const sessionIds = (sessionRows ?? []).map((row) => row.id);
    const [errorResult, turnResult, latencyResult, usageResult] = await Promise.all([
      supabase.from("voice_error_events" as never)
        .select("id,created_at,component,error_type,provider")
        .eq("environment_id", environmentId).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("voice_turn_events" as never)
        .select("severity,metadata_json")
        .eq("environment_id", environmentId).gte("created_at", since).limit(500),
      supabase.from("turn_latencies" as never)
        .select("t_turn_total_ms")
        .eq("environment_id", environmentId).gte("created_at", since).limit(500),
      sessionIds.length > 0
        ? supabase.from("llm_usage").select("total_tokens,model,session_id").in("session_id", sessionIds).gte("created_at", since).limit(500)
        : Promise.resolve({ data: [] as LlmUsageRow[] }),
    ]);
    setErrors((errorResult.data ?? []) as VoiceErrorRow[]);
    setTurns((turnResult.data ?? []) as TurnEventRow[]);
    setLatencies((latencyResult.data ?? []) as LatencyRow[]);
    setUsage((usageResult.data ?? []) as LlmUsageRow[]);
    setLoading(false);
  }, [environmentId]);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const values = latencies
      .map((row) => row.t_turn_total_ms)
      .filter((value): value is number => typeof value === "number")
      .sort((left, right) => left - right);
    const p95 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] : null;
    return {
      p95,
      fallbacks: turns.filter((turn) => turn.metadata_json?.had_fallback === true).length,
      criticalTurns: turns.filter((turn) => turn.severity === "critical" || turn.severity === "failed").length,
      budgetWarnings: usage.filter((row) => (row.total_tokens ?? 0) >= LLM_BUDGET_WARNING_TOKENS).length,
    };
  }, [latencies, turns, usage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alertes — dernières 24 h</h2>
          <p className="text-sm text-muted-foreground">Signaux internes pour l'environnement actif.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={ShieldAlert} label="Erreurs voix" value={errors.length} alert={errors.length > 0} />
        <MetricCard icon={Waves} label="Fallbacks" value={metrics.fallbacks} alert={metrics.fallbacks >= 3} />
        <MetricCard icon={Clock3} label="p95 latence" value={metrics.p95 === null ? "—" : `${metrics.p95} ms`} alert={(metrics.p95 ?? 0) > P95_TARGET_MS} />
        <MetricCard icon={AlertTriangle} label="Budgets LLM" value={metrics.budgetWarnings} alert={metrics.budgetWarnings > 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Erreurs voix récentes</CardTitle>
          <CardDescription>{metrics.criticalTurns} tour(s) critique(s) ou échoué(s), objectif p95 ≤ 2 s.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {errors.slice(0, 15).map((error) => (
            <div key={error.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
              <span>{error.component} · {error.error_type}{error.provider ? ` · ${error.provider}` : ""}</span>
              <span className="text-xs text-muted-foreground">{new Date(error.created_at).toLocaleString("fr-CH")}</span>
            </div>
          ))}
          {!loading && errors.length === 0 ? <p className="text-sm text-muted-foreground">Aucune erreur voix récente.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, alert }: {
  icon: typeof AlertTriangle;
  label: string;
  value: string | number;
  alert: boolean;
}) {
  return (
    <Card className={alert ? "border-amber-500/50" : ""}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
