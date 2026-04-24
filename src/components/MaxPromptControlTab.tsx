import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getMaxPromptControlSettings,
  loadMaxPromptControlSettingsFromDB,
  resetMaxPromptControlSettings,
  saveMaxPromptControlSettings,
  saveMaxPromptControlSettingsToDB,
  type MaxPromptControlSettings,
} from "@/services/settingsService";
import { clearSystemPromptCache } from "@/agents/maxAgent";

const FIELD_CONFIG: Array<{ key: keyof MaxPromptControlSettings; label: string; hint: string }> = [
  { key: "persona", label: "Persona", hint: "Identité stable, manière d'être, posture de Max." },
  { key: "objectives", label: "Objectifs", hint: "Ce que Max cherche à obtenir ou éviter dans la conversation." },
  { key: "roleContext", label: "Contexte de rôle", hint: "Cadre narratif, position dans l'expérience, mission." },
  { key: "longTermMemory", label: "Historique stable", hint: "Mémoire durable et contexte historique de fond." },
  { key: "responseStyle", label: "Style de réponse", hint: "Ton, longueur, rythme, niveau de retenue." },
  { key: "allowedKnowledgePolicy", label: "Politique de savoir autorisé", hint: "Ce que Max a le droit d'utiliser comme source." },
  { key: "forbiddenAssertions", label: "Affirmations interdites", hint: "Ce que Max ne doit jamais affirmer sans source." },
  { key: "forbiddenTopics", label: "Sujets interdits", hint: "Sujets à esquiver, bloquer ou différer." },
  { key: "uncertaintyPolicy", label: "Politique d'incertitude", hint: "Comment Max doit répondre quand il ne sait pas." },
];

export default function MaxPromptControlTab() {
  const [settings, setSettings] = useState<MaxPromptControlSettings>(getMaxPromptControlSettings());
  const [savedSettings, setSavedSettings] = useState<MaxPromptControlSettings>(getMaxPromptControlSettings());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMaxPromptControlSettingsFromDB().then((loaded) => {
      setSettings(loaded);
      setSavedSettings(loaded);
    });
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function updateField(key: keyof MaxPromptControlSettings, value: string) {
    const updated = saveMaxPromptControlSettings({ [key]: value });
    setSettings(updated);
  }

  async function handleSave() {
    setSaving(true);
    await saveMaxPromptControlSettingsToDB(settings);
    clearSystemPromptCache();
    setSavedSettings(settings);
    toast.success("Contrat de prompt Max sauvegardé ✓");
    setSaving(false);
  }

  function handleReset() {
    const defaults = resetMaxPromptControlSettings();
    clearSystemPromptCache();
    setSettings(defaults);
    setSavedSettings(defaults);
    toast.success("Contrat de prompt Max réinitialisé");
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">🎭 Contrôle éditorial de Max</h2>
          <p className="text-sm text-muted-foreground">
            Séparez persona, objectifs, historique et garde-fous de vérité pour contrôler précisément ce que Max sait et ce qu’il n’affirme jamais.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>Réinitialiser</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-300">
          ⚠️ Modifications non sauvegardées — cliquez sur “Sauvegarder” pour les persister.
        </div>
      )}

      <section className="space-y-5 rounded-lg border p-4">
        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          Le prompt final de Max est désormais construit en couches : <strong>persona</strong>, <strong>objectifs</strong>, <strong>historique stable</strong>, <strong>politique de savoir autorisé</strong>, puis <strong>contexte du tour</strong> issu du RAG. Cela réduit fortement les inventions et rend les réglages éditoriaux plus prévisibles.
        </div>

        {FIELD_CONFIG.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>{field.label}</Label>
            <p className="text-xs text-muted-foreground">{field.hint}</p>
            <Textarea
              id={field.key}
              value={settings[field.key]}
              onChange={(event) => updateField(field.key, event.target.value)}
              className="min-h-[110px] font-mono text-sm"
            />
          </div>
        ))}
      </section>
    </div>
  );
}