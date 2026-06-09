import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CHARACTER_PROMPT_FIELDS,
  type CharacterPrompt,
  type CharacterListEntry,
  listCharactersWithPrompts,
  loadCharacterPrompt,
  saveCharacterPrompt,
  buildCharacterPromptSections,
} from "@/services/characterPromptService";
import { clearSystemPromptCache } from "@/agents/maxAgent";
import { AVA_NOTION_DATABASES } from "@/services/ragService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function CharacterEditorTab() {
  const [list, setList] = useState<CharacterListEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<CharacterPrompt | null>(null);
  const [draft, setDraft] = useState<Partial<CharacterPrompt>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => { void refreshList(); }, []);

  async function refreshList() {
    const entries = await listCharactersWithPrompts();
    setList(entries);
    if (!activeId && entries.length > 0) {
      const max = entries.find((e) => e.name === "Max") || entries[0];
      setActiveId(max.character_id);
    }
  }

  useEffect(() => { if (activeId) void loadActive(activeId); }, [activeId]);

  async function loadActive(id: string) {
    setLoading(true);
    const p = await loadCharacterPrompt(id);
    setPrompt(p);
    setDraft(p || {});
    setLoading(false);
  }

  const hasChanges = prompt && CHARACTER_PROMPT_FIELDS.some(
    (f) => (draft as any)[f.key] !== (prompt as any)[f.key],
  );

  async function handleSave() {
    if (!activeId) return;
    setSaving(true);
    try {
      const partial: any = {};
      CHARACTER_PROMPT_FIELDS.forEach((f) => { partial[f.key] = (draft as any)[f.key] || ""; });
      await saveCharacterPrompt(activeId, partial);
      clearSystemPromptCache();
      toast.success("Champs éditoriaux sauvegardés ✓");
      await loadActive(activeId);
    } catch (err: any) {
      toast.error("Erreur sauvegarde: " + (err.message || err));
    }
    setSaving(false);
  }

  async function handleResync() {
    if (!prompt) return;
    setResyncing(true);
    try {
      // Find Notion ID via characters table
      const { data: charRow } = await (await import("@/integrations/supabase/client")).supabase
        .from("characters")
        .select("notion_id")
        .eq("id", prompt.character_id)
        .maybeSingle();
      const notionId = (charRow as any)?.notion_id;
      if (!notionId) throw new Error("Personnage sans notion_id");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databases: { characters: AVA_NOTION_DATABASES.characters },
          only_notion_id: notionId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const item = data.per_character?.[0];
      toast.success(`Resync OK : ${item?.chunks_created || 0} chunks, ${item?.prompt_fields_filled || 0}/7 champs, résumé ${item?.summary_chars || 0} chars`);
      clearSystemPromptCache();
      await refreshList();
      await loadActive(prompt.character_id);
    } catch (err: any) {
      toast.error("Resync échoué : " + (err.message || err));
    }
    setResyncing(false);
  }

  const preview = prompt ? buildCharacterPromptSections({ ...prompt, ...(draft as any) }) : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sélecteur personnage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Personnages</h3>
          <Button size="sm" variant="outline" onClick={() => void refreshList()}>↻</Button>
        </div>
        {list.map((c) => (
          <button
            key={c.character_id}
            onClick={() => setActiveId(c.character_id)}
            className={`w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors ${
              activeId === c.character_id ? "bg-accent border-primary" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{c.name}</span>
              <span className={`text-xs ${c.has_prompt ? "text-green-400" : "text-muted-foreground"}`}>
                {c.has_prompt ? "✓" : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.prompt_chars} chars éditoriaux</p>
          </button>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun personnage. Lance une sync Notion.</p>
        )}
      </div>

      {/* Éditeur */}
      <div className="space-y-5">
        {!activeId || loading ? (
          <p className="text-sm text-muted-foreground">Sélectionne un personnage…</p>
        ) : !prompt ? (
          <div className="border rounded-lg p-6 space-y-3">
            <p className="text-sm">Ce personnage n'a pas encore de champs éditoriaux.</p>
            <Button onClick={handleResync} disabled={resyncing}>
              {resyncing ? "Sync en cours…" : "Resync depuis Notion"}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">🎭 {prompt.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Les champs ci-dessous sont synchronisés depuis Notion et injectés dans le system prompt à chaque tour.
                  Les modifs locales seront écrasées au prochain sync.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResync} disabled={resyncing}>
                  {resyncing ? "Sync…" : "↻ Resync Notion"}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving ? "Sauvegarde…" : "Sauvegarder"}
                </Button>
              </div>
            </div>

            {hasChanges && (
              <div className="rounded border border-yellow-700/50 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-300">
                ⚠️ Modifications non sauvegardées.
              </div>
            )}

            {/* Situation summary (read-only) */}
            <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Situation actuelle (résumé pour le Game Master)</Label>
                <span className="text-xs text-muted-foreground">{prompt.situation_summary.length} chars</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Généré automatiquement à partir du corps de la page Notion lors du sync.
                Le Game Master reçoit ce texte à chaque tour pour orchestrer l'expérience.
              </p>
              <ScrollArea className="h-32 border rounded p-3 bg-background/50">
                <pre className="text-xs whitespace-pre-wrap">{prompt.situation_summary || "(vide — relance un sync)"}</pre>
              </ScrollArea>
            </div>

            {/* 7 champs éditoriaux */}
            <div className="space-y-5 border rounded-lg p-4">
              {CHARACTER_PROMPT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <p className="text-xs text-muted-foreground">{f.hint}</p>
                  <Textarea
                    id={f.key}
                    value={(draft as any)[f.key] || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="min-h-[100px] font-mono text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Preview system prompt */}
            <details className="border rounded-lg p-3">
              <summary className="cursor-pointer text-sm font-semibold">Prévisualiser les sections injectées dans le system prompt</summary>
              <ScrollArea className="h-72 mt-3 border rounded p-3 bg-background/50">
                <pre className="text-xs whitespace-pre-wrap">{preview || "(aucune section non vide)"}</pre>
              </ScrollArea>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
