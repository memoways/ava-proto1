import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import {
  STATE_AXES, STATE_LEVEL_MAX, STATE_LEVEL_MIN, stateAxisLabel,
  type CharacterStateProfile, type StateLevels,
} from "@/services/characterState";

/**
 * Radar of the five state axes (lot D). Fixed pixel size on purpose: it is used
 * both as a full editor chart and as a mini-radar in the sessions history.
 */
export function CharacterStateRadar({ levels, profile, size = 220, compact = false, label }: {
  levels: StateLevels;
  /** Draws the min/max zone and the custom labels when given. */
  profile?: CharacterStateProfile | null;
  size?: number;
  compact?: boolean;
  label?: string;
}) {
  const data = STATE_AXES.map((axis) => ({
    axis: stateAxisLabel(axis, profile),
    value: levels[axis],
    min: profile?.min[axis] ?? STATE_LEVEL_MIN,
    max: profile?.max[axis] ?? STATE_LEVEL_MAX,
  }));
  return (
    <div role="img" aria-label={label ?? `Radar d'état : ${data.map((d) => `${d.axis} ${d.value}`).join(", ")}`} data-testid="state-radar">
      <RadarChart width={size} height={size} data={data} outerRadius={compact ? "70%" : "62%"} margin={compact ? undefined : { top: 14, right: 44, bottom: 14, left: 44 }}>
        <PolarGrid />
        {compact ? null : <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "currentColor" }} />}
        <PolarRadiusAxis domain={[STATE_LEVEL_MIN, STATE_LEVEL_MAX]} tick={false} axisLine={false} />
        {profile ? <Radar name="Max" dataKey="max" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" fill="none" isAnimationActive={false} /> : null}
        {profile ? <Radar name="Min" dataKey="min" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" fill="none" isAnimationActive={false} /> : null}
        <Radar name="État" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} isAnimationActive={false} />
      </RadarChart>
    </div>
  );
}
