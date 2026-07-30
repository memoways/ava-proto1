/**
 * Consommation Streaming Avatar — monitoring multi-providers (HeyGen, Tavus, …).
 *
 * Lit la table `sessions` (colonnes `streaming_avatar_*`, `output_mode`,
 * `duration_seconds`) et agrège par fournisseur : volumétrie, latences de
 * connexion / première image / première parole, taux de repli TTS et coût
 * estimé aux tarifs publics indicatifs.
 *
 * Read-only — n'impacte pas le pipeline temps réel.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listStreamingAvatarProviders } from "@/services/streamingAvatar/registry";

/** Tarifs publics indicatifs (USD / minute de streaming). À ajuster selon le plan réel. */
const COST_PER_MINUTE_USD: Record<string, number> = {
  heygen: 0.12,
  tavus: 0.25,
};
const DEFAULT_COST_PER_MINUTE_USD = 0.15;

const PROVIDER_LABELS: Record<string, string> = {
  heygen: "HeyGen LiveAvatar",
  tavus: "Tavus",
};

interface SessionRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  output_mode: string | null;
  streaming_avatar_provider: string | null;
  streaming_avatar_session_id: string | null;
  streaming_avatar_connect_ms: number | null;
  streaming_avatar_first_frame_ms: number | null;
  streaming_avatar_first_speech_ms: number | null;
  streaming_avatar_fallback_reason: string | null;
}

const fmtMs = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} ms`);
const fmtUsd = (v: number) =>
  v >= 1 ? `$${v.toFixed(2)}` : v >= 0.01 ? `$${v.toFixed(3)}` : `$${v.toFixed(4)}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("fr-CH") : "—");
const fmtMinutes = (s: number) => `${(s / 60).toFixed(1)} min`;

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function sessionSeconds(row: SessionRow): number {
  if (row.duration_seconds && row.duration_seconds > 0) return row.duration_seconds;
  if (row.started_at && row.ended_at) {
    const delta = (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000;
    return delta > 0 ? delta : 0;
  }
  return 0;
}

export default function StreamingAvatarUsageTab() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("7d");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id, started_at, ended_at, duration_seconds, output_mode, streaming_avatar_provider, streaming_avatar_session_id, streaming_avatar_connect_ms, streaming_avatar_first_frame_ms, streaming_avatar_first_speech_ms, streaming_avatar_fallback_reason"
      )
      .order("started_at", { ascending: false })
      .limit(1000);
    if (error) toast.error("Erreur chargement consommation avatar: " + error.message);
    else setRows((data as unknown as SessionRow[]) || []);
    setLoading(false);
  }

  const periodStart = useMemo(() => {
    const now = Date.now();
    if (period === "24h") return new Date(now - 86400000);
    if (period === "7d") return new Date(now - 7 * 86400000);
    if (period === "30d") return new Date(now - 30 * 86400000);
    return new Date(0);
  }, [period]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const ts = r.started_at;
        if (!ts || new Date(ts) < periodStart) return false;
        return (
          Boolean(r.streaming_avatar_provider) ||
          r.output_mode === "streaming_avatar" ||
          Boolean(r.streaming_avatar_fallback_reason)
        );
      }),
    [rows, periodStart]
  );

  // Fournisseurs connus (registre) + ceux réellement présents en base — extensible.
  const providerIds = useMemo(() => {
    const ids = new Set<string>(listStreamingAvatarProviders() as string[]);
    filtered.forEach((r) => { if (r.streaming_avatar_provider) ids.add(r.streaming_avatar_provider); });
    return [...ids];
  }, [filtered]);

  const providerStats = useMemo(() => {
    return providerIds.map((id) => {
      const provRows = filtered.filter((r) => r.streaming_avatar_provider === id);
      const connected = provRows.filter((r) => r.streaming_avatar_first_frame_ms != null);
      const fallbacks = provRows.filter((r) => Boolean(r.streaming_avatar_fallback_reason));
      const fallbackReasons: Record<string, number> = {};
      fallbacks.forEach((r) => {
        const reason = r.streaming_avatar_fallback_reason || "unknown";
        fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
      });
      const connectVals = provRows.map((r) => r.streaming_avatar_connect_ms).filter((v): v is number => v != null);
      const frameVals = provRows.map((r) => r.streaming_avatar_first_frame_ms).filter((v): v is number => v != null);
      const speechVals = provRows.map((r) => r.streaming_avatar_first_speech_ms).filter((v): v is number => v != null);
      const seconds = provRows.reduce((sum, r) => sum + sessionSeconds(r), 0);
      const rate = COST_PER_MINUTE_USD[id] ?? DEFAULT_COST_PER_MINUTE_USD;
      const lastFallback = fallbacks[0];
      return {
        id,
        label: PROVIDER_LABELS[id] ?? id,
        total: provRows.length,
        connected: connected.length,
        fallbacks: fallbacks.length,
        successRate: provRows.length ? (connected.length / provRows.length) * 100 : null,
        fallbackReasons,
        connectP50: percentile(connectVals, 50),
        connectP95: percentile(connectVals, 95),
        frameP50: percentile(frameVals, 50),
        frameP95: percentile(frameVals, 95),
        speechP50: percentile(speechVals, 50),
        speechP95: percentile(speechVals, 95),
        seconds,
        ratePerMinute: rate,
        costUsd: (seconds / 60) * rate,
        lastFallback: lastFallback
          ? { when: lastFallback.started_at, reason: lastFallback.streaming_avatar_fallback_reason }
          : null,
      };
    });
  }, [filtered, providerIds]);

  const totalSessions = filtered.length;
  const totalFallbacks = filtered.filter((r) => Boolean(r.streaming_avatar_fallback_reason)).length;
  const fallbackRate = totalSessions ? (totalFallbacks / totalSessions) * 100 : 0;
  const totalSeconds = providerStats.reduce((s, p) => s + p.seconds, 0);
  const totalCost = providerStats.reduce((s, p) => s + p.costUsd, 0);
  const activeProviders = providerStats.filter((p) => p.total > 0).length;

  const recentSessions = filtered.slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Consommation Streaming Avatar</h2>
        <p className="text-sm text-muted-foreground">
          Métriques des services vidéo temps réel (HeyGen, Tavus, et futurs fournisseurs) : connexion,
          première image, première parole, replis TTS et coût estimé.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Sessions avatar" value={String(totalSessions)} />
        <KPI label="Replis TTS" value={String(totalFallbacks)} tone={totalFallbacks > 0 ? "warn" : "ok"} />
        <KPI
          label="Taux de repli"
          value={`${fallbackRate.toFixed(1)}%`}
          tone={fallbackRate > 20 ? "err" : fallbackRate > 5 ? "warn" : "ok"}
        />
        <KPI label="Fournisseurs actifs" value={String(activeProviders)} />
        <KPI label="Minutes streamées" value={fmtMinutes(totalSeconds)} />
        <KPI label="Coût estimé" value={fmtUsd(totalCost)} tone="warn" />
      </div>
      <p className="text-[11px] text-muted-foreground -mt-3">
        Coûts estimés à partir de la durée des sessions et de tarifs publics indicatifs
        (HeyGen {fmtUsd(COST_PER_MINUTE_USD.heygen)}/min · Tavus {fmtUsd(COST_PER_MINUTE_USD.tavus)}/min ·
        autres fournisseurs {fmtUsd(DEFAULT_COST_PER_MINUTE_USD)}/min par défaut).
      </p>

      {fallbackRate > 20 && totalSessions >= 5 && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-3 text-sm">
          ⚠️ Plus de 20% des sessions avatar sont retombées en mode TTS — vérifie les quotas et les identifiants du fournisseur actif.
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 heures</SelectItem>
            <SelectItem value="7d">7 jours</SelectItem>
            <SelectItem value="30d">30 jours</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          {loading ? "..." : "Rafraîchir"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {providerStats.map((s) => (
          <div key={s.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{s.label}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-muted/50 font-mono">{s.id}</span>
            </div>

            {s.total === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune session sur la période.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="Sessions" value={String(s.total)} />
                  <Mini label="Vidéo OK" value={String(s.connected)} tone="ok" />
                  <Mini label="Replis" value={String(s.fallbacks)} tone={s.fallbacks > 0 ? "err" : "ok"} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Taux vidéo : <span className="font-semibold text-foreground">{s.successRate?.toFixed(1)}%</span>
                </div>

                <Metric label="Connexion" p50={s.connectP50} p95={s.connectP95} />
                <Metric label="Première image" p50={s.frameP50} p95={s.frameP95} />
                <Metric label="Première parole" p50={s.speechP50} p95={s.speechP95} />

                <div className="border-t pt-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durée cumulée</span>
                    <span className="font-mono">{fmtMinutes(s.seconds)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coût estimé ({fmtUsd(s.ratePerMinute)}/min)</span>
                    <span className="font-mono">{fmtUsd(s.costUsd)}</span>
                  </div>
                </div>

                {Object.keys(s.fallbackReasons).length > 0 && (
                  <div className="text-[11px] space-y-0.5">
                    <p className="text-muted-foreground">Motifs de repli</p>
                    {Object.entries(s.fallbackReasons).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between gap-2">
                        <span className="truncate font-mono">{reason}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.lastFallback && (
                  <p className="text-[11px] text-muted-foreground">
                    Dernier repli : {fmtDate(s.lastFallback.when)} — {s.lastFallback.reason}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30 text-sm font-medium">
          Sessions récentes ({recentSessions.length})
        </div>
        {recentSessions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune session avatar sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Fournisseur</th>
                  <th className="text-left px-3 py-2">Mode</th>
                  <th className="text-right px-3 py-2">Connexion</th>
                  <th className="text-right px-3 py-2">1re image</th>
                  <th className="text-right px-3 py-2">1re parole</th>
                  <th className="text-right px-3 py-2">Durée</th>
                  <th className="text-left px-3 py-2">Repli</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.started_at)}</td>
                    <td className="px-3 py-2 font-mono">{r.streaming_avatar_provider ?? "—"}</td>
                    <td className="px-3 py-2">{r.output_mode ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.streaming_avatar_connect_ms)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.streaming_avatar_first_frame_ms)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMs(r.streaming_avatar_first_speech_ms)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMinutes(sessionSeconds(r))}</td>
                    <td className="px-3 py-2 text-destructive">{r.streaming_avatar_fallback_reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, p50, p95 }: { label: string; p50: number | null; p95: number | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex justify-between text-sm font-mono">
        <span>p50 {fmtMs(p50)}</span>
        <span>p95 {fmtMs(p95)}</span>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "err" }) {
  const toneClass =
    tone === "err" ? "text-destructive" : tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-emerald-500" : "";
  return (
    <div className="border rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "ok" | "err" }) {
  const toneClass = tone === "err" ? "text-destructive" : tone === "ok" ? "text-emerald-500" : "";
  return (
    <div className="rounded bg-muted/30 py-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
