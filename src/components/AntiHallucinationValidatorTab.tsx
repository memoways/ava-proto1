import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getAntiHallucinationValidatorSettings,
  loadAntiHallucinationValidatorSettingsFromDB,
  resetAntiHallucinationValidatorSettings,
  saveAntiHallucinationValidatorSettings,
  saveAntiHallucinationValidatorSettingsToDB,
  type AntiHallucinationValidatorSettings,
} from "@/services/settingsService";

function splitLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function countLines(value: string) {
  return splitLines(value).length;
}

function mergeUnique(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      const key = item.trim();
      if (!key) continue;
      const dedupKey = key.toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      out.push(key);
    }
  }
  return out;
}

type PipelineSnapshot = {
  updatedAt?: string;
  preTurnBrief?: {
    allowed_knowledge?: string[];
    forbidden_topics?: string[];
    blocked_assertions?: string[];
  };
};

function readLastTrace(): PipelineSnapshot | null {
  try {
    const raw = localStorage.getItem("ava_pipeline_last_trace");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AntiHallucinationValidatorTab() {
  const [settings, setSettings] = useState<AntiHallucinationValidatorSettings>(getAntiHallucinationValidatorSettings());
  const [savedSettings, setSavedSettings] = useState<AntiHallucinationValidatorSettings>(getAntiHallucinationValidatorSettings());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAntiHallucinationValidatorSettingsFromDB().then((loaded) => {
      setSettings(loaded);
      setSavedSettings(loaded);
    });
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const stats = useMemo(() => ({
    facts: countLines(settings.authorizedFacts),
    rules: countLines(settings.blockedAssertionRules),
  }), [settings]);

  const [trace, setTrace] = useState<PipelineSnapshot | null>(() => readLastTrace());

  function refreshTrace() {
    setTrace(readLastTrace());
  }

  const merged = useMemo(() => {
    const globalFacts = splitLines(settings.authorizedFacts);
    const globalRules = splitLines(settings.blockedAssertionRules);
    const turnAllowed = trace?.preTurnBrief?.allowed_knowledge ?? [];
    const turnForbidden = trace?.preTurnBrief?.forbidden_topics ?? [];
    const turnBlocked = trace?.preTurnBrief?.blocked_assertions ?? [];
    return {
      globalFacts,
      globalRules,
      turnAllowed,
      turnForbidden,
      turnBlocked,
      mergedFacts: mergeUnique(globalFacts, turnAllowed),
      mergedBlocked: mergeUnique(globalRules, turnBlocked),
      mergedForbidden: mergeUnique(turnForbidden),
    };
  }, [settings, trace]);

  function updateField(key: keyof AntiHallucinationValidatorSettings, value: string) {
    const updated = saveAntiHallucinationValidatorSettings({ [key]: value });
    setSettings(updated);
  }

  async function handleSave() {
    setSaving(true);
    await saveAntiHallucinationValidatorSettingsToDB(settings);
    setSavedSettings(settings);
    toast.success("Règles du validateur sauvegardées ✓");
    setSaving(false);
  }

  function handleReset() {
    const defaults = resetAntiHallucinationValidatorSettings();
    setSettings(defaults);
    setSavedSettings(defaults);
    toast.success("Règles du validateur réinitialisées");
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">🛡️ Validateur anti-hallucination</h2>
          <p className="text-sm text-muted-foreground">
            Définissez la base globale des faits autorisés et les règles qui bloquent toute affirmation non autorisée avant TTS.
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
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">Faits globaux</p>
            <p className="mt-1 font-medium">{stats.facts} entrée(s)</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">Règles de blocage</p>
            <p className="mt-1 font-medium">{stats.rules} règle(s)</p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          Le validateur combine ces listes globales avec le contexte autorisé du tour (RAG + brief GM) pour décider si une réponse peut être diffusée ou doit être régénérée.
        </div>

        <div className="space-y-2">
          <Label htmlFor="validator-authorized-facts">Faits autorisés globaux</Label>
          <p className="text-xs text-muted-foreground">Une ligne = un fait durable que Max peut mobiliser si le tour reste cohérent.</p>
          <Textarea
            id="validator-authorized-facts"
            value={settings.authorizedFacts}
            onChange={(event) => updateField("authorizedFacts", event.target.value)}
            className="min-h-[220px] font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="validator-blocked-rules">Règles d’assertions bloquées</Label>
          <p className="text-xs text-muted-foreground">Une ligne = une règle opérationnelle que le validateur doit faire respecter.</p>
          <Textarea
            id="validator-blocked-rules"
            value={settings.blockedAssertionRules}
            onChange={(event) => updateField("blockedAssertionRules", event.target.value)}
            className="min-h-[220px] font-mono text-sm"
          />
        </div>
      </section>
    </div>
  );
}