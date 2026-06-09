import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CHARACTER_PROMPT_FIELDS,
  type CharacterPrompt,
  loadCharacterPrompt,
  saveCharacterPrompt,
  buildCharacterPromptSections,
} from "@/services/characterPromptService";
import { clearSystemPromptCache } from "@/agents/maxAgent";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Props {
  /** UUID of the character to edit (from `characters` table). */
  characterId: string | null;
  /** When set and characterId is null, the panel will auto-resolve the character by name. */
  characterName?: string;
  /** Heading icon + label. Defaults to "🎭 {name}". */
  titlePrefix?: string;
  /** Hide the header entirely (when caller already provides one). */
  hideHeader?: boolean;
}

export default function CharacterPromptEditorPanel({ characterId, characterName, titlePrefix, hideHeader }: Props) {
  const [resolvedId, setResolvedId] = useState<string | null>(characterId);
  const [prompt, setPrompt] = useState<CharacterPrompt | null>(null);
  const [draft, setDraft] = useState<Partial<CharacterPrompt>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Resolve character id from name if necessary
  useEffect(() => {
    if (characterId) {
      setResolvedId(characterId);
      return;
    }
    if (!characterName) return;
    (async () => {
      const { data } = await supabase
        .from("characters")
        .select("id")
        .eq("name", characterName)
        .maybeSingle();
      setResolvedId((data as any)?.id || null);
    })();
  }, [characterId, characterName]);

  useEffect(() => {
    if (!resolvedId) return;
    void loadActive(resolvedId);
  }, [resolvedId]);

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
    if (!resolvedId) return;
    setSaving(true);
    try {
      const partial: any = {};
      CHARACTER_PROMPT_FIELDS.forEach((f) => { partial[f.key] = (draft as any)[f.key] || ""; });
      await saveCharacterPrompt(resolvedId, partial);
      clearSystemPromptCache();
      toast.success("Champs éditoriaux sauvegardés ✓");
      await loadActive(resolvedId);
    } catch (err: any) {
      toast.error("Erreur sauvegarde: " + (err.message || err));
    }
    setSaving(false);
  }

  async function handleResync() {
    if (!resolvedId) return;
    setResyncing(true);
    try {
      const { data: charRow } = await supabase
        .from("characters")
        .select("notion_id")
        .eq("id", resolvedId)
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
      await loadActive(resolvedId);
    } catch (err: any) {
      toast.error("Resync échoué : " + (err.message || err));
    }
    setResyncing(false);
  }

  const preview = prompt ? buildCharacterPromptSections({ ...prompt, ...(draft as any) }) : "";

  if (!resolvedId) {
    return <p className="text-sm text-muted-foreground">Personnage introuvable. Lance une sync Notion.</p>;
  }
  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!prompt) {
    return (
      <div className="border rounded-lg p-6 space-y-3">
        <p className="text-sm">Ce personnage n'a pas encore de champs éditoriaux.</p>
        <Button onClick={handleResync} disabled={resyncing}>
          {resyncing ? "Sync en cours…" : "Resync depuis Notion"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">{titlePrefix || `🎭 ${prompt.name}`}</h2>
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
      )}

      {hideHeader && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleResync} disabled={resyncing}>
            {resyncing ? "Sync…" : "↻ Resync Notion"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
        </div>
      )}

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
            <Label htmlFor={`${resolvedId}-${f.key}`}>{f.label}</Label>
            <p className="text-xs text-muted-foreground">{f.hint}</p>
            <Textarea
              id={`${resolvedId}-${f.key}`}
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
    </div>
  );
}
