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
import {
  compileRichCharacterSections,
  renderRichSections,
  RICH_V2_CONVERSATION_CONTRACT,
} from "@/agents/maxRichPromptCompiler";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import { supabase } from "@/integrations/supabase/client";
import { getGameplaySettings } from "@/services/settingsService";
import {
import { getCachedSession } from "@/services/gameAuth";
  observeCharacterPrompt,
  formatSyncDate,
  type CharacterSyncReport,
} from "@/services/characterSyncReport";


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
  const [legacyPrompt, setLegacyPrompt] = useState("");
  const [savedLegacyPrompt, setSavedLegacyPrompt] = useState("");
  const [savingLegacy, setSavingLegacy] = useState(false);
  const [syncReport, setSyncReport] = useState<CharacterSyncReport | null>(null);


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
    const [p, legacyResult] = await Promise.all([
      loadCharacterPrompt(id),
      supabase.from("characters").select("system_prompt").eq("id", id).maybeSingle(),
    ]);
    setPrompt(p);
    setDraft(p || {});
    setSyncReport(p ? observeCharacterPrompt(id, p) : null);

    const legacy = legacyResult.data?.system_prompt || "";
    setLegacyPrompt(legacy);
    setSavedLegacyPrompt(legacy);
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

      const cachedAuthSession = await getCachedSession();
      const token = cachedAuthSession?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          databases: { characters: AVA_NOTION_DATABASES.characters },
          only_notion_id: notionId,
          mode: "fields_only",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const item = data.per_character?.[0];
      toast.success(`Champs éditoriaux resyncés : ${item?.prompt_fields_filled || 0}/8 champs, résumé ${item?.summary_chars || 0} chars (RAG inchangé)`);
      clearSystemPromptCache();
      await loadActive(resolvedId);
    } catch (err: any) {
      toast.error("Resync échoué : " + (err.message || err));
    }
    setResyncing(false);
  }

  async function handleSaveLegacy() {
    if (!resolvedId) return;
    setSavingLegacy(true);
    const { error } = await supabase
      .from("characters")
      .update({ system_prompt: legacyPrompt })
      .eq("id", resolvedId);
    if (error) toast.error(`Sauvegarde legacy échouée : ${error.message}`);
    else {
      setSavedLegacyPrompt(legacyPrompt);
      clearSystemPromptCache();
      toast.success("Prompt legacy sauvegardé pour le rollback");
    }
    setSavingLegacy(false);
  }


  const preview = prompt ? buildCharacterPromptSections({ ...prompt, ...(draft as any) }) : "";
  const promptVariant = getGameplaySettings().MAX_PROMPT_VARIANT;
  const richPreview = prompt ? compileRichCharacterSections({ ...prompt, ...(draft as any) }) : null;

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
            {promptVariant !== "legacy" && (
              <p className="text-xs text-emerald-400 mt-1">
                {promptVariant === "rich_v2"
                  ? "Rich v2 actif : ces champs structurés sont l’unique source éditoriale du live ; characters.system_prompt est legacy et n’est pas lu."
                  : "Compact v1 actif : ces champs structurés sont l’unique source éditoriale du live."}
              </p>
            )}
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

      {/* Dernier sync + diff */}
      <div className="border rounded-lg p-4 space-y-2 bg-muted/10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Label className="text-sm font-semibold">Dernier sync Notion</Label>
          <span className="text-xs text-muted-foreground">
            {formatSyncDate(prompt.updated_at)}
          </span>
        </div>
        {syncReport && syncReport.at === (prompt.updated_at || "") ? (
          syncReport.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sync effectué, aucun changement de contenu détecté (versions comparées :{" "}
              {formatSyncDate(syncReport.previousAt)} → {formatSyncDate(syncReport.at)}).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Comparé à la version précédente vue ici ({formatSyncDate(syncReport.previousAt)}) ·
                total {syncReport.totalBefore} → {syncReport.totalAfter} caractères (
                {syncReport.totalAfter - syncReport.totalBefore >= 0 ? "+" : ""}
                {syncReport.totalAfter - syncReport.totalBefore}).
              </p>
              <ul className="text-xs space-y-1">
                {syncReport.changes.map((c) => (
                  <li key={c.key} className="flex justify-between gap-3">
                    <span>{c.label}</span>
                    <span className={c.delta > 0 ? "text-emerald-400" : "text-amber-400"}>
                      {c.before} → {c.after} car. ({c.delta > 0 ? "+" : ""}
                      {c.delta})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            Aucun diff disponible : la version actuelle sert de référence. Le prochain sync affichera
            ici le détail des champs modifiés (nombre de caractères).
          </p>
        )}
      </div>


      {/* Situation summary (read-only) */}
      <div className="space-y-2 border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Situation actuelle (résumé pour le Game Master)</Label>
          <span className="text-xs text-muted-foreground">{prompt.situation_summary.length} chars</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Généré automatiquement à partir du corps de la page Notion lors du sync.
          Max reçoit ce texte dans son noyau factuel à chaque tour.
        </p>
        <ScrollArea className="h-32 border rounded p-3 bg-background/50">
          <pre className="text-xs whitespace-pre-wrap">{prompt.situation_summary || "(vide — relance un sync)"}</pre>
        </ScrollArea>
      </div>

      {/* 8 champs éditoriaux + situation actuelle = 9 champs structurés */}
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

      {/* Preview rich_v2 */}
      <details className="border border-emerald-700/40 rounded-lg p-3">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-300">
          Prévisualiser le noyau statique <code>rich_v2</code>
          {richPreview ? ` — ${richPreview.staticChars} caractères statiques` : ""}
        </summary>
        {richPreview && (
          <div className="mt-3 space-y-2">
            <ul className="text-xs text-muted-foreground space-y-1">
              {richPreview.sections.map((section) => (
                <li key={section.key}>
                  <strong>{section.title}</strong> — source {section.originalChars} car., injecté {section.includedChars} car.,{" "}
                  {section.subparts.filter((sub) => sub.included).length}/{section.subparts.length} sous-parties
                  {section.subparts.filter((sub) => !sub.included).length
                    ? ` · omis : ${section.subparts.filter((sub) => !sub.included).map((sub) => sub.label).join(" | ")}`
                    : ""}
                </li>
              ))}
            </ul>
            {richPreview.depthSelection && (
              <p className="text-xs text-emerald-300">
                Profondeur ancrée : {richPreview.depthSelection.level} ({richPreview.depthSelection.reason}) · niveaux représentés :{" "}
                {richPreview.depthSelection.levelsRepresented.join(", ")}
              </p>
            )}
            {richPreview.timelineEvents.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Timeline retenue : {richPreview.timelineEvents.length} événements, aujourd’hui/hier en priorité.
              </p>
            )}
            <ScrollArea className="h-72 border rounded p-3 bg-background/50">
              <pre className="text-xs whitespace-pre-wrap">{renderRichSections(richPreview.sections)}\n\n{RICH_V2_CONVERSATION_CONTRACT}</pre>
            </ScrollArea>
          </div>
        )}
      </details>

      {/* Preview system prompt */}
      <details className="border rounded-lg p-3">
        <summary className="cursor-pointer text-sm font-semibold">Prévisualiser les sections injectées dans le system prompt</summary>
        <ScrollArea className="h-72 mt-3 border rounded p-3 bg-background/50">
          <pre className="text-xs whitespace-pre-wrap">{preview || "(aucune section non vide)"}</pre>
        </ScrollArea>
      </details>

      <details className="border border-amber-700/40 rounded-lg p-3">
        <summary className="cursor-pointer text-sm font-semibold text-amber-300">
          Prompt legacy <span className="font-normal text-muted-foreground">— characters.system_prompt</span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {promptVariant === "compact_v1"
              ? "Non lu par le live en compact_v1. Conservé et modifiable uniquement pour un rollback temporaire."
              : "Variante legacy active : ce texte est à nouveau concaténé au prompt live."}
          </p>
          <Textarea
            value={legacyPrompt}
            onChange={(event) => setLegacyPrompt(event.target.value)}
            className="min-h-[220px] font-mono text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{legacyPrompt.length} caractères</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveLegacy}
              disabled={savingLegacy || legacyPrompt === savedLegacyPrompt}
            >
              {savingLegacy ? "Sauvegarde…" : "Sauvegarder le rollback legacy"}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
