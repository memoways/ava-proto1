import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVAL_PROMPT_VARIANTS, type EvalPromptVariant } from "@/services/evalJudgePipeline";

export interface CompareSideState {
  variant: EvalPromptVariant;
  snapshotJson: string;
}

interface Props {
  liveVariant: EvalPromptVariant;
  reference: CompareSideState;
  candidate: CompareSideState;
  onReferenceChange: (next: CompareSideState) => void;
  onCandidateChange: (next: CompareSideState) => void;
  errors: string[];
}

const SNAPSHOT_HINT = '{"model": "…", "temperature": 0.7, "ragTopK": 6}';

function Side({
  title,
  hint,
  liveVariant,
  value,
  onChange,
  idPrefix,
}: {
  title: string;
  hint: string;
  liveVariant: EvalPromptVariant;
  value: CompareSideState;
  onChange: (next: CompareSideState) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Label htmlFor={`${idPrefix}-variant`}>Variante de prompt</Label>
      <Select value={value.variant} onValueChange={(variant) => onChange({ ...value, variant: variant as EvalPromptVariant })}>
        <SelectTrigger id={`${idPrefix}-variant`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {EVAL_PROMPT_VARIANTS.map((variant) => (
            <SelectItem key={variant} value={variant}>
              {variant}{variant === liveVariant ? " (actuelle)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${idPrefix}-snapshot`}>Instantané de réglages (JSON, facultatif)</Label>
      <Textarea
        id={`${idPrefix}-snapshot`}
        className="font-mono text-xs"
        rows={3}
        placeholder={SNAPSHOT_HINT}
        value={value.snapshotJson}
        onChange={(event) => onChange({ ...value, snapshotJson: event.target.value })}
      />
    </div>
  );
}

export default function EvalCompareSetup({
  liveVariant,
  reference,
  candidate,
  onReferenceChange,
  onCandidateChange,
  errors,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Les deux côtés partent des réglages de ta sandbox. Ce qui est choisi ici s’applique en mémoire, pour le test
        seulement : rien n’est écrit dans les réglages. Clés acceptées dans le JSON : model, temperature, topP,
        maxTokens, ragTopK, ragRetrieveK, ragRerank, ragThreshold, promptVariant.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Side
          title="Référence"
          hint="Ce qui joue aujourd’hui."
          liveVariant={liveVariant}
          value={reference}
          onChange={onReferenceChange}
          idPrefix="eval-ref"
        />
        <Side
          title="Candidat"
          hint="Ce qu’on veut tester ; part de la référence, seuls les changements diffèrent."
          liveVariant={liveVariant}
          value={candidate}
          onChange={onCandidateChange}
          idPrefix="eval-cand"
        />
      </div>
      {errors.length ? (
        <p className="text-sm text-amber-300">Instantané invalide, test bloqué : {errors.join(" ; ")}</p>
      ) : null}
    </div>
  );
}
