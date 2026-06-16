import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { listVideoTriggers, type VideoTriggerRow } from "@/services/videoTriggerService";
import { AVA_NOTION_DATABASES } from "@/services/ragService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function VideosListTab() {
  const [rows, setRows] = useState<VideoTriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listVideoTriggers());
    } catch (err) {
      toast.error("Chargement échoué : " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncFromNotion() {
    setSyncing(true);
    toast.info("Sync Vidéos AVA…");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databases: { videos: AVA_NOTION_DATABASES.videos } }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Sync OK : ${data.videos_synced} vidéo(s)`);
      await load();
    } catch (err) {
      toast.error("Erreur sync : " + (err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base mb-1">🎬 Vidéos AVA (Notion)</h3>
          <p className="text-xs text-muted-foreground">
            Liste des vidéos synchronisées depuis la base Notion « 🎬 Vidéos AVA ». Les détails et l'édition sont dans <em>Mécanique → Triggers vidéo</em>.
          </p>
        </div>
        <Button size="sm" onClick={syncFromNotion} disabled={syncing}>
          <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sync…" : "Sync Notion"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 text-center py-6">
          Aucune vidéo synchronisée. Clique sur <strong>Sync Notion</strong>.
        </p>
      ) : (
        <ul className="divide-y border rounded-md">
          {rows.map((r) => (
            <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{r.title}</span>
                  {r.notion_id && (
                    <a
                      href={`https://www.notion.so/${r.notion_id.replace(/-/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground/70 hover:text-primary inline-flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(r.themes ?? []).map((t) => (
                    <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                  {(!r.themes || r.themes.length === 0) && (
                    <span className="text-[10px] text-muted-foreground/50 italic">aucun thème</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
