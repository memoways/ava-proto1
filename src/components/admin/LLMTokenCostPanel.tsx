import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface UsageRow {
  session_id: string | null;
  feature_key: string;
  request_type: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  status: string;
}

interface Group {
  key: string;
  feature: string;
  model: string;
  calls: number;
  prompt: number;
  completion: number;
  total: number;
  cost: number;
}

function fmtInt(value: number): string {
  return value.toLocaleString("fr-CH");
}

function fmtUsd(value: number): string {
  if (!value) return "—";
  return `$${value < 0.01 ? value.toFixed(5) : value.toFixed(4)}`;
}

export default function LLMTokenCostPanel({ sessionIds }: { sessionIds: string[] }) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idsKey = sessionIds.join(",");

  const load = useCallback(async () => {
    if (!sessionIds.length) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("llm_usage")
      .select("session_id, feature_key, request_type, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, status")
      .in("session_id", sessionIds)
      .limit(5000);
    if (loadError) setError(loadError.message);
    setRows(((data as unknown) as UsageRow[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const row of rows) {
      const feature = row.feature_key || row.request_type || "inconnu";
      const key = `${feature}::${row.model}`;
      const current = map.get(key) || {
        key,
        feature,
        model: row.model,
        calls: 0,
        prompt: 0,
        completion: 0,
        total: 0,
        cost: 0,
      };
      current.calls += 1;
      current.prompt += row.prompt_tokens || 0;
      current.completion += row.completion_tokens || 0;
      current.total += row.total_tokens || (row.prompt_tokens || 0) + (row.completion_tokens || 0);
      current.cost += row.cost_usd || 0;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, g) => ({
          calls: acc.calls + g.calls,
          prompt: acc.prompt + g.prompt,
          completion: acc.completion + g.completion,
          total: acc.total + g.total,
          cost: acc.cost + g.cost,
        }),
        { calls: 0, prompt: 0, completion: 0, total: 0, cost: 0 },
      ),
    [groups],
  );

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Coût en tokens — usage LLM</h3>
          <p className="text-xs text-muted-foreground">
            Tokens réellement facturés par OpenRouter pour les sessions sélectionnées (entrée = prompt envoyé au modèle,
            sortie = réponse générée).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || !sessionIds.length}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">Erreur chargement tokens : {error}</p>}

      {!sessionIds.length ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Coche des sessions pour voir leur coût en tokens.</p>
      ) : !groups.length ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {loading ? "Chargement…" : "Aucun relevé de tokens pour ces sessions."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 tablet:grid-cols-4 gap-2">
            {[
              ["Appels LLM", fmtInt(totals.calls)],
              ["Tokens entrée", fmtInt(totals.prompt)],
              ["Tokens sortie", fmtInt(totals.completion)],
              ["Tokens totaux", fmtInt(totals.total)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border bg-muted/10 p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="font-mono text-sm">{value}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Coût estimé cumulé : <strong className="font-mono text-foreground">{fmtUsd(totals.cost)}</strong> ·{" "}
            {totals.calls ? `${fmtInt(Math.round(totals.total / totals.calls))} tokens / appel en moyenne` : "—"}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Agent / fonction</th>
                  <th className="py-1 pr-2 font-medium">Modèle</th>
                  <th className="py-1 pr-2 font-medium text-right">Appels</th>
                  <th className="py-1 pr-2 font-medium text-right">Entrée</th>
                  <th className="py-1 pr-2 font-medium text-right">Sortie</th>
                  <th className="py-1 pr-2 font-medium text-right">Total</th>
                  <th className="py-1 pr-2 font-medium text-right">Moy./appel</th>
                  <th className="py-1 font-medium text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-t">
                    <td className="py-1 pr-2">
                      <Badge variant="secondary" className="text-[10px]">{g.feature}</Badge>
                    </td>
                    <td className="py-1 pr-2 font-mono text-[11px]">{g.model}</td>
                    <td className="py-1 pr-2 text-right font-mono">{fmtInt(g.calls)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{fmtInt(g.prompt)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{fmtInt(g.completion)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{fmtInt(g.total)}</td>
                    <td className="py-1 pr-2 text-right font-mono">{fmtInt(Math.round(g.total / Math.max(1, g.calls)))}</td>
                    <td className="py-1 text-right font-mono">{fmtUsd(g.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
