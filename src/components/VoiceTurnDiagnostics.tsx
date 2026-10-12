import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readVoiceTurnPage, type VoiceTurnFilters } from "@/lib/mcp/voiceTurnQuery";
import { getActiveEnvironment } from "@/services/environmentContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Page = Awaited<ReturnType<typeof readVoiceTurnPage>>;
const FILTERS = ["character", "provider", "model", "transport", "code_version", "prompt_version", "config_version", "turn_id"] as const;
export function VoiceTurnDiagnostics({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [filters, setFilters] = useState<Partial<VoiceTurnFilters>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try { setPage(await readVoiceTurnPage(supabase, { ...filters, from, to, environment: getActiveEnvironment(), offset, limit: 100 })); }
    catch { setPage(null); setError("Mesures V2 indisponibles. Vérifiez les droits admin et la publication Lovable."); }
    finally { setLoading(false); }
  }, [filters, from, to]);
  // Refresh on period changes only. Typing a filter does not launch a request.
  useEffect(() => { void load(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Chronologie vocale V2">
    <h3 className="font-semibold">Chronologie vocale V2 — {getActiveEnvironment()}</h3>
    <p className="text-xs text-muted-foreground">PRD4, tentatives et GM. Sortie audio estimée par le logiciel ; fin physique de parole non mesurée. Statistiques de la page affichée, séparées des historiques V1 ci-dessous.</p>
    <div className="grid gap-2 sm:grid-cols-4">
      {FILTERS.map((key) => <Input key={key} aria-label={`Filtre V2 ${key}`} placeholder={key} value={filters[key] ?? ""} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} />)}
    </div>
    <Button size="sm" disabled={loading} onClick={() => void load()}>Appliquer les filtres V2</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {page && <>
      <p className="text-sm">{page.summary.attempts} tentatives · {page.summary.gmObservations} observations GM · couverture : {JSON.stringify(page.summary.coverage)} · {page.invalidRows} lignes invalides</p>
      {Object.entries(page.summary.byOrigin).map(([origin, stats]) => <p key={origin} className="text-xs">{origin} → sortie estimée : p50 {stats.outputEstimatedMs.p50 ?? "—"} ms / p95 {stats.outputEstimatedMs.p95 ?? "—"} ms ({stats.outputEstimatedMs.count}/{stats.attempts} mesurées ; interpolation linéaire)</p>)}
      {!page.events.length && <p className="text-sm text-muted-foreground">Aucune donnée V2 dans cette fenêtre.</p>}
      {page.events.map((event) => <details key={event.id} className="rounded border p-2 text-xs">
        <summary className="cursor-pointer">{event.created_at} · {event.turn.character} · {event.turn.turn_id} · {event.turn.status} · {event.event_name}</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(event.turn, null, 2)}</pre>
      </details>)}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={loading || page.page.offset === 0} onClick={() => void load(Math.max(0, page.page.offset - 100))}>Page précédente</Button>
        <Button size="sm" variant="outline" disabled={loading || page.page.nextOffset === null} onClick={() => void load(page.page.nextOffset ?? 0)}>Page suivante</Button>
      </div>
      {page.page.capped && <p className="text-xs">Cap de 3 000 événements atteint ; réduisez la fenêtre.</p>}
    </>}
  </section>;
}
