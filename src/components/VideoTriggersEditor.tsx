import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Save, X, RefreshCw, ExternalLink } from "lucide-react";
import {
  listVideoTriggers,
  updateVideoTriggerOnNotion,
  type VideoTriggerRow,
  type UpdateVideoTriggerPatch,
} from "@/services/videoTriggerService";

const TYPE_OPTIONS = ["intro", "interlude", "mid_conversation"];
const TRANSITION_OPTIONS = ["fade_black", "glitch", "screen_share"];

export default function VideoTriggersEditor() {
  const [triggers, setTriggers] = useState<VideoTriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VideoTriggerRow>>({});
  const [newTheme, setNewTheme] = useState("");

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listVideoTriggers();
      setTriggers(rows);
    } catch (err) {
      toast.error("Erreur chargement triggers : " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTriggers(); }, [fetchTriggers]);

  function startEdit(t: VideoTriggerRow) {
    setEditingId(t.id);
    setDraft({ ...t });
    setNewTheme("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
    setNewTheme("");
  }

  function addTheme() {
    const tag = newTheme.trim().toLowerCase();
    if (!tag) return;
    const current = draft.themes ?? [];
    if (!current.includes(tag)) setDraft({ ...draft, themes: [...current, tag] });
    setNewTheme("");
  }

  function removeTheme(tag: string) {
    setDraft({ ...draft, themes: (draft.themes ?? []).filter((t) => t !== tag) });
  }

  async function saveTrigger() {
    if (!editingId || !draft.title?.trim()) return;
    const row = triggers.find((t) => t.id === editingId);
    if (!row?.notion_id) {
      toast.error("Cette ligne n'a pas d'ID Notion — re-synchronise la base d'abord.");
      return;
    }
    setSaving(true);
    try {
      const patch: UpdateVideoTriggerPatch = {
        title: draft.title,
        context: draft.context ?? "",
        description: draft.description ?? "",
        priority: draft.priority ?? 1,
        themes: draft.themes ?? [],
        type: draft.type ?? "interlude",
        transition_style: draft.transition_style ?? "fade_black",
        video_url: draft.video_url || null,
      };
      await updateVideoTriggerOnNotion(row.notion_id, patch);
      toast.success("Sauvegardé sur Notion ✓");
      cancelEdit();
      await fetchTriggers();
    } catch (err) {
      toast.error("Erreur sauvegarde Notion : " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des triggers…</p>;

  return (
    <section className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base mb-1">🎬 Triggers vidéo</h3>
          <p className="text-xs text-muted-foreground">
            Source : base Notion <span className="font-mono">🎬 Vidéos AVA</span>. Le Game Master choisit une vidéo selon les <em>thèmes</em> abordés dans la conversation. Édition d'un champ → <strong>Sauvegarder</strong> pousse la modification sur Notion.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTriggers}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {triggers.length === 0 && (
        <p className="text-sm text-muted-foreground/60 text-center py-4">
          Aucune vidéo en base. Lance une sync Notion depuis l'onglet <em>Contenu Notion → Vidéos</em>.
        </p>
      )}

      {triggers.map((t) => {
        const isEditing = editingId === t.id;

        if (isEditing) {
          return (
            <div key={t.id} className="border-2 border-primary/40 rounded-lg p-4 space-y-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Titre</label>
                  <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={draft.type ?? "interlude"}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Thèmes (déclencheurs pour le Game Master)</label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {(draft.themes ?? []).map((tag) => (
                    <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                      {tag}
                      <button onClick={() => removeTheme(tag)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    placeholder="Ajouter un thème…"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTheme())}
                  />
                  <Button variant="outline" size="sm" onClick={addTheme}>+</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">URL Gumlet</label>
                  <Input value={draft.video_url ?? ""} onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} placeholder="https://play.gumlet.io/…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                    <Input type="number" value={draft.priority ?? 1} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Transition</label>
                    <select
                      value={draft.transition_style ?? "fade_black"}
                      onChange={(e) => setDraft({ ...draft, transition_style: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {TRANSITION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Contexte (injecté dans Max après la vidéo)</label>
                <Textarea value={draft.context ?? ""} onChange={(e) => setDraft({ ...draft, context: e.target.value })} className="min-h-[60px] text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description (ce qui se passe dans la vidéo, factuel)</label>
                <Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-[80px] text-sm" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}><X className="h-3 w-3 mr-1" /> Annuler</Button>
                <Button size="sm" onClick={saveTrigger} disabled={saving}>
                  <Save className="h-3 w-3 mr-1" /> {saving ? "Sauvegarde…" : "Sauvegarder sur Notion"}
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div key={t.id} className="border rounded-lg p-3 bg-muted/10 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold">{t.title}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.type}</span>
                {t.priority != null && <span className="text-xs text-muted-foreground">P{t.priority}</span>}
                {t.notion_id && (
                  <a
                    href={`https://www.notion.so/${t.notion_id.replace(/-/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground/70 hover:text-primary inline-flex items-center gap-0.5"
                  >
                    Notion <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                <Pencil className="h-3 w-3 mr-1" /> Éditer
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {(t.themes ?? []).map((tag) => (
                <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{tag}</span>
              ))}
              {(!t.themes || t.themes.length === 0) && <span className="text-xs text-muted-foreground/50 italic">Aucun thème</span>}
            </div>
            {t.context && <p className="text-xs text-muted-foreground mt-2"><strong>Contexte :</strong> {t.context}</p>}
            {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2"><strong>Description :</strong> {t.description}</p>}
            {t.video_url && <p className="text-xs text-muted-foreground mt-1 truncate">🔗 {t.video_url}</p>}
          </div>
        );
      })}
    </section>
  );
}
