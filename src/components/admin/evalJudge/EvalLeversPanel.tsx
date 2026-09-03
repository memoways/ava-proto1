import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EvalCostEstimate, EvalLiveSnapshot } from "@/services/evalJudgePipeline";

export interface LeverToggles {
  tempZero: boolean;
  tempHigh: boolean;
  ragConservative: boolean;
  ragGenerous: boolean;
}

interface Props {
  live: EvalLiveSnapshot;
  liveModelLabel: string;
  catalog: Array<{ id: string; label: string }>;
  evalModels: Array<{ id: string; label: string }>;
  extraModels: string[];
  onExtraModelsChange: (models: string[]) => void;
  judgeModel: string;
  onJudgeModelChange: (model: string) => void;
  toggles: LeverToggles;
  onTogglesChange: (toggles: LeverToggles) => void;
  estimate: EvalCostEstimate;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  running: boolean;
  canResume: boolean;
  blocked: boolean;
  blockedReason: string | null;
  progress: number;
  progressLabel: string;
}

const SETTINGS_MAP: Array<{ label: string; value: (live: EvalLiveSnapshot) => string; where: string }> = [
  { label: "Modèle de Max", value: (live) => live.model, where: "Technique → LLM Config" },
  { label: "Température", value: (live) => String(live.temperature), where: "Technique → LLM Config" },
  { label: "Top-p", value: (live) => String(live.topP), where: "Technique → LLM Config" },
  { label: "Tokens max", value: (live) => String(live.maxTokens), where: "Technique → LLM Config" },
  { label: "Variante de prompt", value: (live) => live.promptVariant, where: "Expérience → Réglages personnages" },
  { label: "RAG — extraits retenus (k)", value: (live) => String(live.ragTopK), where: "Technique → RAG Config" },
  { label: "RAG — seuil de similarité", value: (live) => String(live.ragThreshold), where: "Technique → RAG Config" },
  {
    label: "RAG — reclassement",
    value: (live) => (live.ragRerank ? `activé (${live.ragRerankModel})` : "désactivé"),
    where: "Technique → RAG Config",
  },
];

export default function EvalLeversPanel({
  live,
  liveModelLabel,
  catalog,
  evalModels,
  extraModels,
  onExtraModelsChange,
  judgeModel,
  onJudgeModelChange,
  toggles,
  onTogglesChange,
  estimate,
  onStart,
  onPause,
  onResume,
  running,
  canResume,
  blocked,
  blockedReason,
  progress,
  progressLabel,
}: Props) {
  const minutes = Math.max(1, Math.round((estimate.turns * 12) / 60));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Étape 2 — Ce qui est testé, et ce qu'on compare</CardTitle>
        <CardDescription>
          Le test rejoue le vrai pipeline texte (recherche RAG → Game Master → Max → validateur), sans voix. La
          référence est toujours ta configuration actuelle ; on ne change qu'un paramètre à la fois.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Réglages utilisés par le test (ceux de ta sandbox)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SETTINGS_MAP.map((row) => (
              <div key={row.label} className="rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{row.label} : </span>
                <span className="font-medium">{row.value(live)}</span>
                <span className="block text-xs text-muted-foreground">Modifiable dans {row.where}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modèles de Max à comparer</Label>
          <p className="text-xs text-muted-foreground">
            Même catalogue que Technique → LLM Config. Ta configuration actuelle est toujours dans le test.
          </p>
          <label className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            <Checkbox checked disabled className="mt-0.5" />
            <span>
              <span className="font-medium">{liveModelLabel}</span>
              <span className="text-muted-foreground"> — référence actuelle</span>
            </span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {evalModels.map((model) => {
              const checked = extraModels.includes(model.id);
              return (
                <label key={model.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox
                    checked={checked}
                    className="mt-0.5"
                    onCheckedChange={(value) => {
                      const on = value === true;
                      if (on) {
                        onExtraModelsChange(extraModels.includes(model.id) ? extraModels : [...extraModels, model.id]);
                      } else {
                        onExtraModelsChange(extraModels.filter((id) => id !== model.id));
                      }
                    }}
                  />
                  <span>
                    <span className="font-medium">{model.label}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{model.id}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Autres variantes à comparer</Label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={toggles.tempZero}
              onCheckedChange={(value) => onTogglesChange({ ...toggles, tempZero: value === true })}
            />
            <span>
              Température 0
              <span className="block text-xs text-muted-foreground">Vérifie si des réponses plus stables sont mieux notées.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={toggles.tempHigh}
              onCheckedChange={(value) => onTogglesChange({ ...toggles, tempHigh: value === true })}
            />
            <span>
              Température 0.8
              <span className="block text-xs text-muted-foreground">Vérifie si plus de liberté rend la voix de Max plus juste.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={toggles.ragConservative}
              onCheckedChange={(value) => onTogglesChange({ ...toggles, ragConservative: value === true })}
            />
            <span>
              RAG conservateur (moins d'extraits)
              <span className="block text-xs text-muted-foreground">Vérifie si moins de contexte réduit les hors-sujet.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={toggles.ragGenerous}
              onCheckedChange={(value) => onTogglesChange({ ...toggles, ragGenerous: value === true })}
            />
            <span>
              RAG généreux (plus d'extraits)
              <span className="block text-xs text-muted-foreground">Vérifie si plus de contexte améliore les questions de lore.</span>
            </span>
          </label>
        </div>

        <div>
          <Label>Modèle juge (température 0)</Label>
          <Select value={judgeModel} onValueChange={onJudgeModelChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {catalog.map((model) => (
                <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Le juge ne joue pas Max : il note la réponse produite contre la cible Notion.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          {estimate.configs} configurations × {estimate.items} questions × {estimate.repeats} passages =
          {" "}<strong>{estimate.turns} tours</strong> · ~{estimate.llmCalls} appels LLM · coût estimé
          {" "}${estimate.estimatedCostUsd.toFixed(3)} · durée estimée ~{minutes} min.
        </div>

        {blocked && blockedReason ? (
          <p className="text-sm text-amber-300">{blockedReason}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onStart} disabled={running || blocked}>
            <Play className="mr-2 h-4 w-4" /> Lancer le test
          </Button>
          {running ? (
            <Button variant="outline" onClick={onPause}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          ) : null}
          {canResume && !running ? (
            <Button variant="secondary" onClick={onResume}>Reprendre</Button>
          ) : null}
        </div>

        {running || progressLabel ? (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">{progressLabel}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
