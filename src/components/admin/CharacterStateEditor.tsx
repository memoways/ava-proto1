import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  STATE_AXES, STATE_AXIS_LABELS, STATE_AXIS_POLES, STATE_LEVEL_MAX, STATE_LEVEL_MIN,
  compileCharacterStateBlock, defaultStateProfile, normalizeStateProfile, stateAxisLabel,
  type CharacterStateProfile, type StateAxis,
} from "@/services/characterState";
import { CharacterStateRadar } from "@/components/admin/CharacterStateRadar";

/**
 * Back-office editor of a character's state radar (lot D): initial level and
 * min/max zone per axis, editable labels, GM evolution switch and step, and the
 * exact fragment the character receives. `value` is the raw jsonb column.
 */
export function CharacterStateEditor({ characterName, value, onChange }: {
  characterName: string;
  value: unknown;
  onChange: (next: CharacterStateProfile | null) => void;
}) {
  const profile = normalizeStateProfile(value);

  if (!profile) {
    return (
      <div className="space-y-2 rounded border p-3" data-testid="state-editor-off">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium">État du personnage (radar)</p>
            <p className="text-xs text-muted-foreground">
              Désactivé : {characterName} ne reçoit aucun état et le GM n'en fait évoluer aucun (comportement actuel).
            </p>
          </div>
          <Switch aria-label={`Activer l'état de ${characterName}`} checked={false} onCheckedChange={() => onChange(defaultStateProfile())} />
        </div>
      </div>
    );
  }

  const update = (patch: Partial<CharacterStateProfile>) => onChange(normalizeStateProfile({ ...profile, ...patch }));
  const setAxis = (axis: StateAxis, field: "initial" | "min" | "max", level: number) =>
    update({ [field]: { ...profile[field], [axis]: level } } as Partial<CharacterStateProfile>);
  const setLabel = (axis: StateAxis, text: string) => {
    const labels = { ...(profile.labels ?? {}) };
    if (text.trim()) labels[axis] = text; else delete labels[axis];
    update({ labels });
  };

  return (
    <div className="space-y-3 rounded border p-3" data-testid="state-editor">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">État du personnage (radar)</p>
          <p className="text-xs text-muted-foreground">
            Cinq dimensions de 0 à 5 transmises à {characterName} à chaque tour. Le GM les fait évoluer pas à pas dans la zone
            min–max ; en mode GM « off », l'état initial reste fixe. Aucun appel IA ajouté.
          </p>
        </div>
        <Switch aria-label={`Désactiver l'état de ${characterName}`} checked onCheckedChange={() => onChange(null)} />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <CharacterStateRadar levels={profile.initial} profile={profile} size={260} />
        <div className="min-w-[260px] flex-1 space-y-3">
          {STATE_AXES.map((axis) => (
            <div key={axis} className="space-y-1" data-testid={`state-axis-${axis}`}>
              <div className="flex items-center gap-2">
                <Input
                  className="h-7 w-36 text-xs"
                  aria-label={`Libellé ${STATE_AXIS_LABELS[axis]}`}
                  placeholder={STATE_AXIS_LABELS[axis]}
                  value={profile.labels?.[axis] ?? ""}
                  maxLength={24}
                  onChange={(event) => setLabel(axis, event.target.value)}
                />
                <span className="font-mono text-xs" aria-label={`Niveau initial ${stateAxisLabel(axis, profile)}`}>{profile.initial[axis]}</span>
                <span className="text-[11px] text-muted-foreground">
                  {STATE_AXIS_POLES[axis][0]} 0 ↔ {STATE_AXIS_POLES[axis][1]} 5
                </span>
              </div>
              <Slider
                aria-label={`Niveau initial ${stateAxisLabel(axis, profile)}`}
                value={[profile.initial[axis]]}
                min={STATE_LEVEL_MIN} max={STATE_LEVEL_MAX} step={1}
                onValueChange={([level]) => setAxis(axis, "initial", level)}
              />
              <div className="grid grid-cols-[3rem_1fr_3rem_1fr] items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Min {profile.min[axis]}</span>
                <Slider
                  aria-label={`Minimum ${stateAxisLabel(axis, profile)}`}
                  value={[profile.min[axis]]}
                  min={STATE_LEVEL_MIN} max={STATE_LEVEL_MAX} step={1}
                  onValueChange={([level]) => setAxis(axis, "min", level)}
                />
                <span className="text-[11px] text-muted-foreground">Max {profile.max[axis]}</span>
                <Slider
                  aria-label={`Maximum ${stateAxisLabel(axis, profile)}`}
                  value={[profile.max[axis]]}
                  min={STATE_LEVEL_MIN} max={STATE_LEVEL_MAX} step={1}
                  onValueChange={([level]) => setAxis(axis, "max", level)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={profile.gmCanEvolve} onCheckedChange={(checked) => update({ gmCanEvolve: checked })} aria-label="Le GM peut faire évoluer l'état" />
          Le GM peut faire évoluer l'état
        </label>
        <label className="flex items-center gap-2 text-xs">
          Pas maximum par tour
          <Select value={String(profile.maxStepPerTurn)} onValueChange={(v) => update({ maxStepPerTurn: Number(v) })} disabled={!profile.gmCanEvolve}>
            <SelectTrigger className="h-7 w-16"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">➜ Envoyé au personnage au premier tour (état initial)</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px]" data-testid="state-preview">
          {compileCharacterStateBlock(profile.initial, profile)}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Fixé sur la session au premier tour : une modification ne change pas les appels déjà commencés. L'état règle l'attitude ;
          la rugosité continue de régler la forme de la parole.
        </p>
      </div>
    </div>
  );
}
