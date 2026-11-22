/**
 * Period and sandbox controls shared by the three consumption tabs.
 * The period is a row of buttons so the active window stays readable.
 */

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export interface UsageRangeOption {
  id: string;
  label: string;
}

interface Props {
  value: string;
  options: readonly UsageRangeOption[];
  onChange: (id: string) => void;
  includeSandbox: boolean;
  onIncludeSandbox: (value: boolean) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function UsageRangeBar({ value, options, onChange, includeSandbox, onIncludeSandbox, onRefresh, refreshing }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période">
        <span className="text-sm font-medium">Période</span>
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={value === option.id ? "default" : "outline"}
            className="h-10 min-w-[6.5rem] px-4 text-sm"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
        {onRefresh && (
          <Button type="button" variant="outline" className="h-10 px-4 text-sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "…" : "Rafraîchir"}
          </Button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={includeSandbox} onCheckedChange={onIncludeSandbox} />
        Inclure les sandboxes
      </label>
    </div>
  );
}

export const VOICE_VIDEO_RANGES: readonly UsageRangeOption[] = [
  { id: "24h", label: "24 heures" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "all", label: "Tout" },
];

export const LLM_RANGES: readonly UsageRangeOption[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "all", label: "Tout" },
];
