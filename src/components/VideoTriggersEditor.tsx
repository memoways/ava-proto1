import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Save, X, Plus, Trash2, RefreshCw } from "lucide-react";

interface VideoTrigger {
  id: string;
  title: string;
  type: string;
  themes: string[];
  video_url: string | null;
  placeholder_text: string | null;
  post_video_context: string | null;
  duration_seconds: number | null;
  priority: number | null;
  transition_style: string | null;
}

export default function VideoTriggersEditor() {
  const [triggers, setTriggers] = useState<VideoTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VideoTrigger>>({});
  const [newTheme, setNewTheme] = useState("");

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("video_triggers")
      .select("id, title, type, themes, video_url, placeholder_text, post_video_context, duration_seconds, priority, transition_style")
      .order("priority", { ascending: true });
    if (error) {
      toast.error("Erreur chargement triggers : " + error.message);
    } else {
      setTriggers(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTriggers(); }, [fetchTriggers]);

  function startEdit(t: VideoTrigger) {
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
    if (!current.includes(tag)) {
      setDraft({ ...draft, themes: [...current, tag] });
    }
    setNewTheme("");
  }

  function removeTheme(tag: string) {
    setDraft({ ...draft, themes: (draft.themes ?? []).filter((t) => t !== tag) });
  }

  async function saveTrigger() {
    if (!editingId || !draft.title?.trim()) return;
    const { error } = await supabase
      .from("video_triggers")
      .update({
        title: draft.title,
        themes: draft.themes ?? [],
        video_url: draft.video_url || null,
        placeholder_text: draft.placeholder_text || null,
        post_video_context: draft.post_video_context || null,
        duration_seconds: draft.duration_seconds ?? 10,
        priority: draft.priority ?? 1,
        transition_style: draft.transition_style || "fade_black",
      })
      .eq("id", editingId);
    if (error) {
      toast.error("Erreur sauvegarde : " + error.message);
    } else {
      toast.success("Trigger mis à jour ✓");
      cancelEdit();
      fetchTriggers();
    }
  }

  async function addTrigger() {
    const { error } = await supabase.from("video_triggers").insert({
      title: "Nouveau trigger",
      type: "cinematic",
      themes: [],
      priority: (triggers.length + 1),
    });
    if (error) {
      toast.error("Erreur création : " + error.message);
    } else {
      toast.success("Trigger créé");
      fetchTriggers();
    }
  }

  async function deleteTrigger(id: string) {
    if (!confirm("Supprimer ce trigger ?")) return;
    const { error } = await supabase.from("video_triggers").delete().eq("id", id);
    if (error) {
      toast.error("Erreur suppression : " + error.message);
    } else {
      toast.success("Trigger supprimé");
      if (editingId === id) cancelEdit();
      fetchTriggers();
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des triggers…</p>;

  return (
    <section className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base mb-1">🎬 Triggers vidéo</h3>
          <p className="text-xs text-muted-foreground">
            Thématiques de conversation déclenchant des séquences vidéo cinématiques. Éditez les thèmes, URLs et paramètres.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTriggers}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={addTrigger}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      {triggers.length === 0 && (
        <p className="text-sm text-muted-foreground/60 text-center py-4">Aucun trigger vidéo en base.</p>
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
                  <Input value={draft.type ?? "cinematic"} disabled className="opacity-60" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Thèmes (mots-clés déclencheurs)</label>
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
                  <label className="text-xs font-medium text-muted-foreground">URL vidéo</label>
                  <Input value={draft.video_url ?? ""} onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} placeholder="https://…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Texte placeholder</label>
                  <Input value={draft.placeholder_text ?? ""} onChange={(e) => setDraft({ ...draft, placeholder_text: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Durée (s)</label>
                  <Input type="number" value={draft.duration_seconds ?? 10} onChange={(e) => setDraft({ ...draft, duration_seconds: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                  <Input type="number" value={draft.priority ?? 1} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Transition</label>
                  <Input value={draft.transition_style ?? "fade_black"} onChange={(e) => setDraft({ ...draft, transition_style: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Contexte post-vidéo (injecté dans la conversation)</label>
                <Textarea value={draft.post_video_context ?? ""} onChange={(e) => setDraft({ ...draft, post_video_context: e.target.value })} className="min-h-[60px] text-sm" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}><X className="h-3 w-3 mr-1" /> Annuler</Button>
                <Button size="sm" onClick={saveTrigger}><Save className="h-3 w-3 mr-1" /> Sauvegarder</Button>
              </div>
            </div>
          );
        }

        return (
          <div key={t.id} className="border rounded-lg p-3 bg-muted/10 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{t.title}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.type}</span>
                {t.priority && <span className="text-xs text-muted-foreground">P{t.priority}</span>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => startEdit(t)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTrigger(t.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {(t.themes ?? []).map((tag) => (
                <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{tag}</span>
              ))}
              {(!t.themes || t.themes.length === 0) && <span className="text-xs text-muted-foreground/50 italic">Aucun thème</span>}
            </div>
            {t.video_url && <p className="text-xs text-muted-foreground mt-1 truncate">🔗 {t.video_url}</p>}
          </div>
        );
      })}
    </section>
  );
}
