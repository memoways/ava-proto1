import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { retryCostForRow } from "@/services/llmUsageTracker";

interface UsageRow {
  id: string;
  created_at: string;
  session_id: string | null;
  feature_key: string;
  request_type: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  generation_id: string | null;
  cost_usd: number;
  status: string;
  metadata_json: any;
  error_message: string | null;
}

interface CostErrorRow {
  id: string;
  occurred_at: string;
  session_id: string | null;
  generation_id: string | null;
  error_type: string;
  status_code: number | null;
  error_message: string | null;
  source: string;
  metadata_json: any;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#10b981"];

const fmtCost = (v: number) => `$${v.toFixed(6)}`;
const fmtTokens = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
const fmtDate = (d: string) => new Date(d).toLocaleString("fr-CH");

export default function LLMUsageTab() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [costErrors, setCostErrors] = useState<CostErrorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModel, setFilterModel] = useState("all");
  const [filterFeature, setFilterFeature] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("30d");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data, error }, { data: errorData, error: costErrorLoadError }] = await Promise.all([
      supabase
        .from("llm_usage" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("openrouter_cost_error_logs" as any)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500),
    ]);
    if (error) {
      toast.error("Erreur chargement consommation: " + error.message);
    } else {
      setRows((data as any[]) || []);
    }
    if (costErrorLoadError) {
      toast.error("Erreur chargement journal coûts: " + costErrorLoadError.message);
    } else {
      setCostErrors((errorData as any[]) || []);
    }
    setLoading(false);
  }

  async function retryAllFailedCosts() {
    const failed = rows.filter(r => r.status === "cost_fetch_failed" && r.generation_id);
    if (failed.length === 0) { toast.info("Aucune entrée à recalculer"); return; }
    setLoading(true);
    let ok = 0;
    for (const r of failed) {
      const success = await retryCostForRow({
        id: r.id,
        session_id: r.session_id,
        generation_id: r.generation_id,
        prompt_tokens: r.prompt_tokens,
        completion_tokens: r.completion_tokens,
        total_tokens: r.total_tokens,
      });
      if (success) ok++;
    }
    toast.success(`${ok}/${failed.length} coûts récupérés`);
    await loadData();
    setLoading(false);
  }

  // Filters
  const periodStart = useMemo(() => {
    const now = new Date();
    if (filterPeriod === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filterPeriod === "7d") return new Date(now.getTime() - 7 * 86400000);
    if (filterPeriod === "30d") return new Date(now.getTime() - 30 * 86400000);
    return new Date(0); // all
  }, [filterPeriod]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (new Date(r.created_at) < periodStart) return false;
      if (filterModel !== "all" && r.model !== filterModel) return false;
      if (filterFeature !== "all" && r.feature_key !== filterFeature) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, periodStart, filterModel, filterFeature, filterStatus]);

  const uniqueModels = [...new Set(rows.map(r => r.model))];
  const uniqueFeatures = [...new Set(rows.map(r => r.feature_key))];
  const uniqueStatuses = [...new Set(rows.map(r => r.status))];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const errorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    costErrors.forEach((row) => {
      counts[row.error_type] = (counts[row.error_type] || 0) + 1;
    });
    return counts;
  }, [costErrors]);
  const errorsToday = useMemo(() => costErrors.filter((row) => new Date(row.occurred_at) >= todayStart).length, [costErrors]);
  const uniqueErrorTypes = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // KPIs
  const totalCost = filtered.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const costToday = rows.filter(r => new Date(r.created_at) >= todayStart).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const cost30d = rows.filter(r => new Date(r.created_at) >= new Date(Date.now() - 30 * 86400000)).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const totalRequests = filtered.length;
  const totalTokensSum = filtered.reduce((s, r) => s + (r.total_tokens || 0), 0);

  // Chart data: cost per day
  const costPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const day = r.created_at.slice(0, 10);
      map[day] = (map[day] || 0) + (Number(r.cost_usd) || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([day, cost]) => ({ day, cost }));
  }, [filtered]);

  // Chart data: cost per model
  const costPerModel = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const shortModel = r.model.split("/").pop() || r.model;
      map[shortModel] = (map[shortModel] || 0) + (Number(r.cost_usd) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Chart data: cost per feature
  const costPerFeature = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      map[r.feature_key] = (map[r.feature_key] || 0) + (Number(r.cost_usd) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="Coût total (filtre)" value={fmtCost(totalCost)} />
        <KPICard label="Coût aujourd'hui" value={fmtCost(costToday)} />
        <KPICard label="Coût 30 jours" value={fmtCost(cost30d)} />
        <KPICard label="Requêtes" value={String(totalRequests)} />
        <KPICard label="Tokens total" value={fmtTokens(totalTokensSum)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPICard label="Erreurs coût total" value={String(costErrors.length)} />
        <KPICard label="Erreurs aujourd'hui" value={String(errorsToday)} />
        <KPICard label="404 coût" value={String(errorCounts.not_found || 0)} />
        <KPICard label="Timeouts / 5xx" value={String((errorCounts.timeout || 0) + (errorCounts.server_error || 0))} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="7d">7 jours</SelectItem>
            <SelectItem value="30d">30 jours</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterModel} onValueChange={setFilterModel}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Modèle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modèles</SelectItem>
            {uniqueModels.map(m => <SelectItem key={m} value={m}>{m.split("/").pop()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFeature} onValueChange={setFilterFeature}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Feature" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes features</SelectItem>
            {uniqueFeatures.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {uniqueStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          {loading ? "..." : "Rafraîchir"}
        </Button>
        <Button size="sm" variant="outline" onClick={retryAllFailedCosts} disabled={loading}>
          Recalculer coûts manquants
        </Button>
      </div>

      {/* Charts */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cost per day */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Coût / jour</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costPerDay}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                <Tooltip formatter={(v: number) => fmtCost(v)} />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cost per model */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Coût / modèle</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costPerModel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${fmtCost(value)}`}>
                  {costPerModel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCost(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Cost per feature */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Coût / feature</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costPerFeature} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${fmtCost(value)}`}>
                  {costPerFeature.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCost(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Aucune donnée de consommation LLM pour la période sélectionnée.
          <br />
          <span className="text-xs">Les données apparaîtront après les prochains appels au LLM.</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Feature</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Modèle</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Prompt</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Compl.</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Coût</th>
              <th className="text-center p-2 font-medium text-muted-foreground">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(r => (
              <tr key={r.id} className="border-b hover:bg-accent/30">
                <td className="p-2 text-xs">{fmtDate(r.created_at)}</td>
                <td className="p-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{r.feature_key}</span>
                </td>
                <td className="p-2 text-xs font-mono">{r.model.split("/").pop()}</td>
                <td className="p-2 text-right text-xs">{fmtTokens(r.prompt_tokens)}</td>
                <td className="p-2 text-right text-xs">{fmtTokens(r.completion_tokens)}</td>
                <td className="p-2 text-right text-xs font-medium">{fmtTokens(r.total_tokens)}</td>
                <td className="p-2 text-right text-xs font-mono">{fmtCost(Number(r.cost_usd) || 0)}</td>
                <td className="p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "success" || r.status === "completed"
                      ? "bg-green-900/40 text-green-300"
                      : r.status === "error"
                      ? "bg-red-900/40 text-red-300"
                      : "bg-yellow-900/40 text-yellow-300"
                  }`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-4 text-muted-foreground text-sm text-center">Aucune donnée</p>
        )}
        {filtered.length > 100 && (
          <p className="p-2 text-xs text-muted-foreground text-center">Affichage limité aux 100 dernières entrées</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-4">
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Erreurs de coût par type</h3>
          {uniqueErrorTypes.length > 0 ? uniqueErrorTypes.map(({ type, count }) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="capitalize">{type.split("_").join(" ")}</span>
              <span className="font-mono text-xs px-2 py-1 rounded bg-muted/50">{count}</span>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">Aucune erreur de coût journalisée.</p>
          )}
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Source</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Generation ID</th>
                <th className="text-left p-2 font-medium text-muted-foreground">HTTP</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Message</th>
              </tr>
            </thead>
            <tbody>
              {costErrors.slice(0, 100).map((row) => (
                <tr key={row.id} className="border-b hover:bg-accent/30 align-top">
                  <td className="p-2 text-xs whitespace-nowrap">{fmtDate(row.occurred_at)}</td>
                  <td className="p-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{row.error_type}</span>
                  </td>
                  <td className="p-2 text-xs">{row.source}</td>
                  <td className="p-2 text-xs font-mono max-w-[220px] truncate">{row.generation_id || "—"}</td>
                  <td className="p-2 text-xs font-mono">{row.status_code ?? "—"}</td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[420px] truncate">{row.error_message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {costErrors.length === 0 && (
            <p className="p-4 text-muted-foreground text-sm text-center">Aucune erreur de coût</p>
          )}
          {costErrors.length > 100 && (
            <p className="p-2 text-xs text-muted-foreground text-center">Affichage limité aux 100 dernières erreurs</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
