/**
 * Five-axis radar (1–5) for the conversational questionnaire.
 *
 * Single series in the primary token; texts in ink tokens. A dimension without
 * a score is never drawn at 0: its axis is dashed, it gets no point, and it is
 * listed apart under the chart. The shape is filled only when the five axes
 * are scored; otherwise only segments between adjacent scored axes are drawn.
 */
import { useId } from "react";
import type { ConversationalDimensionKey } from "@/types";
import { CONVERSATIONAL_DIMENSIONS } from "@/services/conversationalQuestionnaire";
import { DIMENSION_LABELS } from "@/services/conversationalQuestionnaireFlow";

const RADAR_SHORT_LABELS: Record<ConversationalDimensionKey, string> = {
  fluidity: "Fluidité",
  interest: "Intérêt",
  immersion: "Immersion",
  character_credibility: "Crédibilité",
  emotional_engagement: "Émotion",
};

interface Props {
  /** Score 1–5 per dimension (decimals allowed for means); null = not rated. */
  values: Partial<Record<ConversationalDimensionKey, number | null>>;
  title: string;
  /** Text after the value in the tooltip, e.g. "/5" or "/5 (moyenne, 4 notes)". */
  describe?: (key: ConversationalDimensionKey, value: number) => string;
  notRatedLabel?: string;
  className?: string;
}

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 96;
const MAX = 5;
/** Horizontal room for the side labels (« Émotion », « Intérêt »). */
const PAD_X = 36;

function point(index: number, value: number) {
  const angle = (-90 + index * (360 / CONVERSATIONAL_DIMENSIONS.length)) * (Math.PI / 180);
  const r = (value / MAX) * RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

const valid = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= MAX;

export default function ConversationalRadar({ values, title, describe, notRatedLabel = "Non évalué", className }: Props) {
  const titleId = useId();
  const keys = CONVERSATIONAL_DIMENSIONS;
  const rated = keys.map((key) => (valid(values[key]) ? (values[key] as number) : null));
  const notRated = keys.filter((_, i) => rated[i] === null);
  const allRated = notRated.length === 0;
  const format = (key: ConversationalDimensionKey, value: number) =>
    describe ? describe(key, value) : `${Number.isInteger(value) ? value : value.toFixed(1)}/5`;

  const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
  if (!allRated) {
    keys.forEach((_, i) => {
      const j = (i + 1) % keys.length;
      if (rated[i] !== null && rated[j] !== null) segments.push({ a: point(i, rated[i]!), b: point(j, rated[j]!) });
    });
  }
  const polygon = allRated ? rated.map((v, i) => point(i, v!)).map((p) => `${p.x},${p.y}`).join(" ") : "";

  return (
    <figure className={className} aria-label={title}>
      <svg viewBox={`${-PAD_X} 0 ${SIZE + 2 * PAD_X} ${SIZE}`} className="mx-auto block h-auto w-full max-w-[360px]" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{title}</title>
        {[1, 2, 3, 4, 5].map((ring) => (
          <polygon
            key={ring}
            points={keys.map((_, i) => point(i, ring)).map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        ))}
        {keys.map((key, i) => {
          const end = point(i, MAX);
          const label = point(i, MAX + 1.15);
          const anchor = Math.abs(label.x - CENTER) < 4 ? "middle" : label.x > CENTER ? "start" : "end";
          const missing = rated[i] === null;
          return (
            <g key={key}>
              <line
                x1={CENTER} y1={CENTER} x2={end.x} y2={end.y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray={missing ? "3 4" : undefined}
              />
              <text
                x={label.x} y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={14}
                fill={missing ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))"}
              >
                {RADAR_SHORT_LABELS[key]}
              </text>
            </g>
          );
        })}
        {allRated && (
          <polygon points={polygon} fill="hsl(var(--primary) / 0.18)" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" />
        )}
        {segments.map((s, i) => (
          <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" />
        ))}
        {keys.map((key, i) => {
          const value = rated[i];
          if (value === null) return null;
          const p = point(i, value);
          return (
            <g key={key} data-testid={`radar-point-${key}`}>
              <circle cx={p.x} cy={p.y} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
              <circle cx={p.x} cy={p.y} r={14} fill="transparent">
                <title>{`${DIMENSION_LABELS[key]} : ${format(key, value)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
        {notRated.length > 0 && (
          <p data-testid="radar-not-rated">
            {notRatedLabel} : {notRated.map((key) => DIMENSION_LABELS[key]).join(", ")}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
