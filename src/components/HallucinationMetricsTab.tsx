import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { ConversationValidationTrace } from "@/types";

interface SessionRow {
  id: string;
  started_at: string | null;
  conversation_log: any;
}

interface SessionMetric {
  sessionId: string;
  startedAt: string | null;
  totalTurns: number;
  withTrace: number;
  regenerated: number;
  fallbacks: number;
  avgAttempts: number;
}

const LOCAL_TRACE_KEY = "ava_pipeline_last_trace";

function extractTraces(log: any): ConversationValidationTrace[] {
  if (!Array.isArray(log)) return [];
  const traces: ConversationValidationTrace[] = [];
  for (const entry of log) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.role && entry.role !== "max") continue;
    if (entry.validation && typeof entry.validation === "object") {
      traces.push(entry.validation as ConversationValidationTrace);
    }
  }
  return traces;
}

function buildMetric(row: SessionRow): SessionMetric {
  const traces = extractTraces(row.conversation_log);
  const regenerated = traces.filter((t) => t.regenerated).length;
  const fallbacks = traces.filter((t) => t.finalStatus === "fallback").length;
  const totalAttempts = traces.reduce((sum, t) => sum + (t.attempts || 0), 0);
  return {
    sessionId: row.id,
    startedAt: row.started_at,
    totalTurns: Array.isArray(row.conversation_log) ? row.conversation_log.length : 0,
    withTrace: traces.length,
    regenerated,
    fallbacks,
    avgAttempts: traces.length ? Number((totalAttempts / traces.length).toFixed(2)) : 0,
  };
}

export default function HallucinationMetricsTab() {
  const [metrics, setMetrics] = useState<SessionMetric[]>([]);
  const [lastTrace, setLastTrace] = useState<ConversationValidationTrace | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("sessions")
      .select("id, started_at, conversation_log")
      .order("started_at", { ascending: false })
      .limit(50);
    setMetrics((data || []).map((row) => buildMetric(row as SessionRow)));
    try {
      const raw = localStorage.getItem(LOCAL_TRACE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLastTrace(parsed?.validation || null);
      }
    } catch {
      setLastTrace(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totals = metrics.reduce(
    (acc, m) => ({
      turns: acc.turns + m.totalTurns,
      withTrace: acc.withTrace + m.withTrace,
      regen: acc.regen + m.regenerated,
      fallback: acc.fallback + m.fallbacks,
    }),
    { turns: 0, withTrace: 0, regen: 0, fallback: 0 }
  );
  const regenRate = totals.withTrace ? Math.round((totals.regen / totals.withTrace) * 100) : 0;
  const fallbackRate = totals.withTrace ? Math.round((totals.fallback / totals.withTrace) * 100) : 0;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">📈 Métriques anti-hallucination</h2>
          <p className="text-sm text-muted-foreground">
            Mesure des régénérations et fallbacks du validateur sur les 50 dernières sessions.
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          {loading ? "Chargement…" : "Rafraîchir"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Tours analysés" value={totals.withTrace} hint={`${totals.turns} entrées brutes`} />
        <SummaryCard label="Régénérations" value={`${totals.regen} (${regenRate}%)`} hint="Tours avec retry" />
        <SummaryCard label="Fallbacks" value={`${totals.fallback} (${fallbackRate}%)`} hint="Réponse de prudence" tone={fallbackRate > 10 ? "danger" : "ok"} />
        <SummaryCard label="Sessions" value={metrics.length} hint="50 max" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernier tour local</CardTitle>
          <CardDescription>Snapshot du validateur enregistré côté navigateur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!lastTrace && <p className="text-muted-foreground">Aucune trace locale. Joue un tour puis reviens ici.</p>}
          {lastTrace && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">status: {lastTrace.finalStatus}</Badge>
              <Badge variant="outline">tentatives: {lastTrace.attempts}</Badge>
              <Badge variant={lastTrace.regenerated ? "destructive" : "outline"}>
                régénéré: {lastTrace.regenerated ? "oui" : "non"}
              </Badge>
              <Badge variant="outline">rapports: {lastTrace.reports?.length || 0}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail par session</CardTitle>
          <CardDescription>Sessions ayant des traces de validation persistées.</CardDescription>
        </CardHeader>
        <CardContent>
          {!metrics.length && <p className="text-sm text-muted-foreground">Aucune session.</p>}
          <div className="space-y-1 text-xs">
            {metrics
              .filter((m) => m.withTrace > 0)
              .slice(0, 30)
              .map((m) => (
                <div key={m.sessionId} className="grid grid-cols-6 gap-2 rounded border p-2">
                  <span className="font-mono truncate col-span-2">{m.sessionId.slice(0, 8)}…</span>
                  <span>{m.startedAt ? new Date(m.startedAt).toLocaleString("fr-FR") : "—"}</span>
                  <span>tours: {m.withTrace}</span>
                  <span>regen: {m.regenerated}</span>
                  <span className={m.fallbacks ? "text-destructive font-semibold" : ""}>fallback: {m.fallbacks}</span>
                </div>
              ))}
            {metrics.every((m) => m.withTrace === 0) && (
              <p className="text-muted-foreground">
                Aucune session ne contient encore de trace de validation. Le tracking par session s'active quand l'orchestrator persiste la validation dans `conversation_log`.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, tone = "ok" }: { label: string; value: string | number; hint?: string; tone?: "ok" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
