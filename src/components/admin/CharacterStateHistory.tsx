import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { CharacterStateRadar } from "@/components/admin/CharacterStateRadar";
import {
  STATE_AXES, STATE_AXIS_LABELS, STATE_LEVEL_MAX, STATE_LEVEL_MIN, stateSeriesByCharacter,
} from "@/services/characterState";

const AXIS_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#a855f7", "#f59e0b"];

/**
 * Sessions history, lot D: for each character, the radar of its last state and
 * one curve per dimension over the turns (state played at each turn).
 */
export function CharacterStateHistory({ log }: { log: unknown }) {
  const series = stateSeriesByCharacter(log);
  const characters = Object.keys(series);
  if (!characters.length) return null;
  return (
    <div className="mb-2 space-y-2" data-testid="state-history">
      {characters.map((key) => {
        const points = series[key];
        const last = points[points.length - 1];
        const data = points.map((p) => ({ turn: `T${p.turn}`, ...p.levels }));
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 rounded border bg-background/40 p-2">
            <div>
              <p className="text-[11px] font-semibold">État de {key} · dernier tour (T{last.turn})</p>
              <CharacterStateRadar levels={last.levels} size={150} compact />
            </div>
            {points.length > 1 ? (
              <LineChart width={360} height={150} data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="turn" tick={{ fontSize: 10 }} />
                <YAxis domain={[STATE_LEVEL_MIN, STATE_LEVEL_MAX]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {STATE_AXES.map((axis, i) => (
                  <Line key={axis} type="stepAfter" dataKey={axis} name={STATE_AXIS_LABELS[axis]} stroke={AXIS_COLORS[i]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                ))}
              </LineChart>
            ) : (
              <p className="text-[11px] text-muted-foreground">Un seul tour enregistré : pas encore de courbe.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
