/**
 * Voice Usage / Consommation Voix — monitoring multi-providers TTS.
 *
 * Lit `audio_latencies` (direction = 'out') et agrège par provider depuis
 * `metadata_json` (provider, status_code, error_type, error_message) renseigné
 * par la façade TTS (src/services/tts/index.ts).
 *
 * Read-only — n'impacte pas le pipeline voix.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TTS_PROVIDER_LIST } from "@/services/tts/registry";
import type { TTSProviderId } from "@/services/tts/types";
import PeriodCostLines from "@/components/admin/PeriodCostLines";
import ServicePlanBoard, { type MeasuredPlans } from "@/components/admin/ServicePlanBoard";
import UsageRangeBar, { VOICE_VIDEO_RANGES } from "@/components/admin/UsageRangeBar";
import { emptyPlan, formatUsd, periodCostReading, requestedDays, serviceById, sumPeriodTotals } from "@/services/servicePlans";
import type { Json } from "@/integrations/supabase/types";

interface AudioRow {
  id: string;
  created_at: string;
  direction: string;
  t_tts_first_byte_ms: number | null;
  t_tts_total_ms: number | null;
  tts_text_len: number | null;
  metadata_json: {
    provider?: string;
    model?: string;
    status_code?: number;
    error_type?: string;
    error_message?: string;
  } | null;
}

const fmtMs = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} ms`);
const fmtDate = (d: string) => new Date(d).toLocaleString("fr-CH");

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export default function VoiceUsageTab() {
  const [rows, setRows] = useState<AudioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("7d");
  const [includeSandbox, setIncludeSandbox] = useState(true);
  const [serviceId, setServiceId] = useState("all");
  const [plans, setPlans] = useState<MeasuredPlans | null>(null);
  const [now] = useState(() => new Date());
  const onPlans = useCallback((state: MeasuredPlans) => setPlans(state), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audio_latencies" as never)
      .select("*")
      .eq("direction", "out")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!includeSandbox) query = query.neq("context_type", "sandbox");
    const { data, error } = await query;
    if (error) toast.error("Erreur chargement consommation voix: " + error.message);
    else setRows((data as unknown as AudioRow[]) || []);
    setLoading(false);
  }, [includeSandbox]);

  useEffect(() => { void loadData(); }, [loadData]);

  const periodStart = useMemo(() => {
    const now = Date.now();
    if (period === "24h") return new Date(now - 86400000);
    if (period === "7d") return new Date(now - 7 * 86400000);
    if (period === "30d") return new Date(now - 30 * 86400000);
    return new Date(0);
  }, [period]);

  const filtered = useMemo(
    () => rows.filter((r) => new Date(r.created_at) >= periodStart && (serviceId === "all" || r.metadata_json?.provider === serviceId)),
    [rows, periodStart, serviceId]
  );

  const loadPlanUsage = useCallback(async (fromIso: string) => {
    const { data, error } = await supabase
      .from("audio_latencies" as never)
      .select("created_at, tts_text_len, metadata_json")
      .eq("direction", "out")
      .gte("created_at", fromIso)
      .limit(5000);
    if (error) throw new Error(error.message);
    const list = (data as unknown as { created_at: string; tts_text_len: number | null; metadata_json: Json | null }[]) ?? [];
    return {
      capped: list.length >= 5000,
      events: list.flatMap((row) => {
        const meta = row.metadata_json;
        if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
        const record = meta as { provider?: unknown; error_type?: unknown };
        if (typeof record.provider !== "string") return [];
        if (typeof record.error_type === "string" && record.error_type !== "ok") return [];
        return [{ serviceId: record.provider, at: row.created_at, amount: row.tts_text_len ?? 0 }];
      }),
    };
  }, []);

  // Stats per provider
  const providerStats = useMemo(() => {
    return TTS_PROVIDER_LIST.map((p) => {
      const provRows = filtered.filter((r) => r.metadata_json?.provider === p.id);
      const success = provRows.filter((r) => (r.metadata_json?.error_type ?? "ok") === "ok");
      const errors = provRows.filter((r) => (r.metadata_json?.error_type ?? "ok") !== "ok");
      const codeCounts: Record<string, number> = {};
      provRows.forEach((r) => {
        const code = String(r.metadata_json?.status_code ?? 0);
        codeCounts[code] = (codeCounts[code] || 0) + 1;
      });
      const errorTypeCounts: Record<string, number> = {};
      errors.forEach((r) => {
        const t = r.metadata_json?.error_type ?? "unknown";
        errorTypeCounts[t] = (errorTypeCounts[t] || 0) + 1;
      });
      const firstByteVals = provRows.map((r) => r.t_tts_first_byte_ms).filter((v): v is number => v != null);
      const totalVals = provRows.map((r) => r.t_tts_total_ms).filter((v): v is number => v != null);
      const charsTotal = provRows.reduce((sum, r) => sum + (r.tts_text_len || 0), 0);
      const charsSuccess = success.reduce((sum, r) => sum + (r.tts_text_len || 0), 0);
      const service = serviceById(p.id);
      const visible = serviceId === "all" || serviceId === p.id;
      const reading = service && plans && visible
        ? periodCostReading(service, plans.plans[p.id] ?? emptyPlan(), plans.events, charsSuccess, now, requestedDays(period), plans.capped)
        : null;
      const lastError = errors[0];
      return {
        id: p.id as TTSProviderId,
        label: p.label,
        total: provRows.length,
        success: success.length,
        errors: errors.length,
        successRate: provRows.length ? (success.length / provRows.length) * 100 : null,
        codeCounts,
        errorTypeCounts,
        fbP50: percentile(firstByteVals, 50),
        fbP95: percentile(firstByteVals, 95),
        totalP50: percentile(totalVals, 50),
        totalP95: percentile(totalVals, 95),
        charsTotal,
        charsSuccess,
        service,
        reading,
        lastError: lastError
          ? {
              when: lastError.created_at,
              message: lastError.metadata_json?.error_message || lastError.metadata_json?.error_type || "—",
              code: lastError.metadata_json?.status_code,
            }
          : null,
      };
    });
  }, [filtered, plans, now, period, serviceId]);

  const totalReqs = filtered.length;
  const totalErrors = filtered.filter((r) => (r.metadata_json?.error_type ?? "ok") !== "ok").length;
  const globalErrorRate = totalReqs ? (totalErrors / totalReqs) * 100 : 0;
  const realCost = sumPeriodTotals(providerStats.map((provider) => provider.reading));
  const totalChars = providerStats.reduce((s, p) => s + p.charsTotal, 0);

  const recentErrors = filtered
    .filter((r) => (r.metadata_json?.error_type ?? "ok") !== "ok")
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <ServicePlanBoard family="voice" serviceId={serviceId} onServiceId={setServiceId} loadUsage={loadPlanUsage} onReady={onPlans} />
      <UsageRangeBar
        value={period}
        options={VOICE_VIDEO_RANGES}
        onChange={setPeriod}
        includeSandbox={includeSandbox}
        onIncludeSandbox={setIncludeSandbox}
        onRefresh={loadData}
        refreshing={loading}
      />
      {/* Header KPIs */}
      <div className="grid grid-cols-2 tablet:grid-cols-3 tablet-lg:grid-cols-6 gap-3">
        <KPI label="Requêtes (période)" value={String(totalReqs)} />
        <KPI label="Erreurs" value={String(totalErrors)} tone={totalErrors > 0 ? "warn" : "ok"} />
        <KPI
          label="Taux d'erreur global"
          value={`${globalErrorRate.toFixed(1)}%`}
          tone={globalErrorRate > 10 ? "err" : globalErrorRate > 2 ? "warn" : "ok"}
        />
        <KPI label="Providers actifs" value={String(providerStats.filter((p) => p.total > 0).length)} />
        <KPI label="Caractères TTS" value={totalChars.toLocaleString("fr-CH")} />
        <KPI
          label={realCost.partial ? "Coût réel (partiel)" : "Coût réel"}
          value={realCost.total == null ? "—" : formatUsd(realCost.total)}
          tone="warn"
        />
      </div>
      <p className="text-[11px] text-muted-foreground -mt-3">
        Le coût réel partage l'abonnement mensuel sur les jours choisis (1, 7 ou 30 sur 30) et ajoute
        seulement ce qui dépasse le forfait sur cette période. Les minutes sont une estimation
        (750 caractères ≈ 1 min). Le reste est le forfait du cycle en cours. « Tout » affiche le mois,
        sans prorata. Un crédit prépayé montre le consommé de la période et ce qui reste du solde.
        Un forfait non saisi reste vide. Le forfait inclut les sandboxes. Les statistiques aussi, tant
        que l'interrupteur reste activé.
      </p>

      {/* Alerte taux d'erreur */}
      {globalErrorRate > 10 && totalReqs >= 10 && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-3 text-sm">
          ⚠️ Taux d'erreur global supérieur à 10% sur la période sélectionnée — vérifie les clés API et quotas.
        </div>
      )}

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providerStats.map((s) => (
          <div key={s.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{s.label}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-muted/50 font-mono">{s.id}</span>
            </div>

            {s.total === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Aucun appel sur la période.</p>
                {s.reading && s.service && <PeriodCostLines reading={s.reading} service={s.service} />}
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="Req." value={String(s.total)} />
                  <Mini label="Succès" value={`${s.success}`} tone="ok" />
                  <Mini label="Erreurs" value={`${s.errors}`} tone={s.errors > 0 ? "err" : "ok"} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Taux succès : <span className="font-semibold text-foreground">{s.successRate?.toFixed(1)}%</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Latence first-byte</p>
                  <div className="flex justify-between text-sm font-mono">
                    <span>p50 {fmtMs(s.fbP50)}</span>
                    <span>p95 {fmtMs(s.fbP95)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Latence totale</p>
                  <div className="flex justify-between text-sm font-mono">
                    <span>p50 {fmtMs(s.totalP50)}</span>
                    <span>p95 {fmtMs(s.totalP95)}</span>
                  </div>
                </div>

                {s.reading && s.service ? (
                  <PeriodCostLines reading={s.reading} service={s.service} />
                ) : (
                  <div className="space-y-1 border-t border-border/40 pt-2">
                    <div className="flex justify-between text-sm font-mono">
                      <span>{s.charsSuccess.toLocaleString("fr-CH")} caractères</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Codes HTTP</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.codeCounts)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([code, count]) => (
                        <span
                          key={code}
                          className={`text-xs px-2 py-0.5 rounded font-mono ${
                            code === "200"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : code === "401" || code === "403"
                              ? "bg-red-500/10 text-red-400"
                              : code === "429"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-muted/50"
                          }`}
                        >
                          {code} × {count}
                        </span>
                      ))}
                  </div>
                </div>

                {Object.keys(s.errorTypeCounts).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Types d'erreur</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(s.errorTypeCounts).map(([t, c]) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                          {t} × {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {s.lastError && (
                  <div className="text-xs border-t border-border/40 pt-2 text-muted-foreground">
                    <span className="font-semibold text-red-400">Dernière erreur :</span>{" "}
                    {fmtDate(s.lastError.when)}
                    {s.lastError.code ? ` · ${s.lastError.code}` : ""} — {String(s.lastError.message).slice(0, 120)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Tableau comparatif */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-2 font-medium text-muted-foreground">Provider</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Req.</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Succès</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Erreurs</th>
              <th className="text-right p-2 font-medium text-muted-foreground">% succès</th>
              <th className="text-right p-2 font-medium text-muted-foreground">FB p50</th>
              <th className="text-right p-2 font-medium text-muted-foreground">FB p95</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Tot. p50</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Tot. p95</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Chars</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Coût réel</th>
            </tr>
          </thead>
          <tbody>
            {providerStats.map((s) => (
              <tr key={s.id} className="border-b hover:bg-accent/30">
                <td className="p-2 font-medium">{s.label}</td>
                <td className="p-2 text-right font-mono">{s.total}</td>
                <td className="p-2 text-right font-mono text-emerald-400">{s.success}</td>
                <td className="p-2 text-right font-mono text-red-400">{s.errors}</td>
                <td className="p-2 text-right font-mono">{s.successRate != null ? `${s.successRate.toFixed(1)}%` : "—"}</td>
                <td className="p-2 text-right font-mono">{fmtMs(s.fbP50)}</td>
                <td className="p-2 text-right font-mono">{fmtMs(s.fbP95)}</td>
                <td className="p-2 text-right font-mono">{fmtMs(s.totalP50)}</td>
                <td className="p-2 text-right font-mono">{fmtMs(s.totalP95)}</td>
                <td className="p-2 text-right font-mono">{s.charsTotal.toLocaleString("fr-CH")}</td>
                <td className="p-2 text-right font-mono text-amber-400">{s.reading?.totalUsd == null ? "—" : formatUsd(s.reading.totalUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Erreurs récentes */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Erreurs récentes</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Provider</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                <th className="text-right p-2 font-medium text-muted-foreground">HTTP</th>
                <th className="text-right p-2 font-medium text-muted-foreground">Latence</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Message</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map((r) => (
                <tr key={r.id} className="border-b hover:bg-accent/30">
                  <td className="p-2 text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="p-2 text-xs font-mono">{r.metadata_json?.provider || "—"}</td>
                  <td className="p-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                      {r.metadata_json?.error_type || "unknown"}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-right font-mono">{r.metadata_json?.status_code ?? "—"}</td>
                  <td className="p-2 text-xs text-right font-mono">{fmtMs(r.t_tts_total_ms)}</td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[420px] truncate">
                    {r.metadata_json?.error_message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentErrors.length === 0 && (
            <p className="p-4 text-muted-foreground text-sm text-center">Aucune erreur sur la période</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "err" }) {
  const toneClass =
    tone === "err" ? "text-red-400" : tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "";
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "ok" | "err" }) {
  const toneClass = tone === "err" ? "text-red-400" : tone === "ok" ? "text-emerald-400" : "";
  return (
    <div className="border border-border/40 rounded p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
