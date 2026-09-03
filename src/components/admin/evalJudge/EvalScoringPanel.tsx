import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_SCORE_WEIGHTS,
  EVAL_SCORE_CRITERIA,
  type EvalScoreWeights,
} from "@/services/evalJudgeScoring";

interface Props {
  weights: EvalScoreWeights;
  onChange: (weights: EvalScoreWeights) => void;
  onSave: () => void;
  saving: boolean;
}

export default function EvalScoringPanel({ weights, onChange, onSave, saving }: Props) {
  const total = EVAL_SCORE_CRITERIA.reduce((sum, criterion) => sum + (weights[criterion.key] ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Étape 3 — Régler la grille de notation</CardTitle>
        <CardDescription>
          Le juge note six critères de 0 à 5. La note finale sur 10 est la moyenne de ces six notes, pondérée par les
          curseurs ci-dessous. Changer un poids recalcule immédiatement tous les classements, sans relancer un seul
          test et sans coût.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {EVAL_SCORE_CRITERIA.map((criterion) => {
          const value = weights[criterion.key] ?? 0;
          const share = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={criterion.key} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{criterion.label}</span>
                <span className="text-xs text-muted-foreground">poids {value.toFixed(1)} · {share} % de la note</span>
              </div>
              <p className="text-xs text-muted-foreground">{criterion.description}</p>
              <Slider
                value={[value]}
                min={0}
                max={5}
                step={0.5}
                onValueChange={(next) => onChange({ ...weights, [criterion.key]: next[0] ?? 0 })}
              />
            </div>
          );
        })}

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Exemple de calcul</p>
          <p>
            Une réponse qui respecte les interdits (5/5) et sonne juste (4/5) mais oublie un fait exigé (2/5) obtient
            une bonne note si « Interdits » et « Voix du personnage » pèsent lourd, et une note moyenne si tu remontes
            « Éléments exigés ». À toi de dire ce qui compte pour l'expérience.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer ces poids
          </Button>
          <Button variant="outline" onClick={() => onChange({ ...DEFAULT_SCORE_WEIGHTS })}>
            <RotateCcw className="mr-2 h-4 w-4" /> Revenir aux poids conseillés
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
