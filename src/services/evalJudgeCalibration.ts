/**
 * Judge calibration against a human rater (lot K1). Pure: the script
 * `scripts/eval-judge/calibrate.ts` only wires it to the real judge.
 *
 * A calibration file holds answers already produced and rated by a human
 * (note /10). The judge re-rates the same answers, nothing is regenerated.
 */

export const CALIBRATION_GAP_THRESHOLD = 2;
/** Exit criteria of lot K1: fewer than 3 gaps above 2 points and a mean absolute gap of at most 1. */
export const CALIBRATION_MAX_LARGE_GAPS = 2;
export const CALIBRATION_MAX_MEAN_GAP = 1;
export const CALIBRATION_JUDGE_CALL_COST_USD = 0.02;

export interface CalibrationItem {
  sequence: string;
  turn: number;
  question: string;
  response: string;
  human: number;
  /** Judge note recorded when the human rated (previous grid). */
  judge: number | null;
  comments: string[];
}

export interface CalibrationFile {
  source: string | null;
  rater: string | null;
  ratedAt: string | null;
  items: CalibrationItem[];
}

export function parseCalibrationFile(raw: string): { file: CalibrationFile | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { file: null, errors: ["JSON illisible"] };
  }
  const value = parsed as Record<string, unknown> | null;
  if (!value || typeof value !== "object" || !Array.isArray(value.items)) {
    return { file: null, errors: ["Un objet { items: [...] } est attendu"] };
  }
  const errors: string[] = [];
  const items: CalibrationItem[] = [];
  value.items.forEach((entry, index) => {
    const item = entry as Record<string, unknown>;
    const label = `items[${index}]`;
    const text = (key: string) => (typeof item?.[key] === "string" ? (item[key] as string).trim() : "");
    const human = Number(item?.human);
    if (!text("sequence")) errors.push(`${label} : sequence manquante`);
    if (!Number.isInteger(item?.turn) || (item.turn as number) < 1) errors.push(`${label} : turn doit être un entier ≥ 1`);
    if (!text("response")) errors.push(`${label} : response manquante`);
    if (!Number.isFinite(human) || human < 0 || human > 10) errors.push(`${label} : human doit être une note de 0 à 10`);
    const judge = item?.judge == null ? null : Number(item.judge);
    items.push({
      sequence: text("sequence"),
      turn: Number(item?.turn),
      question: text("question"),
      response: text("response"),
      human,
      judge: judge !== null && Number.isFinite(judge) ? judge : null,
      comments: Array.isArray(item?.comments) ? item.comments.filter((comment): comment is string => typeof comment === "string") : [],
    });
  });
  if (!items.length) errors.push("Aucune réponse à rejuger");
  const str = (key: string) => (typeof value[key] === "string" ? value[key] as string : null);
  return { file: errors.length ? null : { source: str("source"), rater: str("rater"), ratedAt: str("ratedAt"), items }, errors };
}

export interface CalibrationRow {
  label: string;
  human: number;
  /** Mean of the readable judge notes; null when every pass was unreadable. */
  judge: number | null;
  gap: number | null;
  previousJudge: number | null;
  canonTimeline: number | null;
  rationale: string;
  corpusDoubt: string;
}

export interface CalibrationSummary {
  rows: CalibrationRow[];
  rated: number;
  unreadable: number;
  meanAbsGap: number | null;
  meanSignedGap: number | null;
  largeGaps: number;
  passed: boolean;
}

export function summarizeCalibration(rows: CalibrationRow[]): CalibrationSummary {
  const gaps = rows.map((row) => row.gap).filter((gap): gap is number => gap !== null);
  const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const meanAbs = mean(gaps.map(Math.abs));
  const largeGaps = gaps.filter((gap) => Math.abs(gap) > CALIBRATION_GAP_THRESHOLD).length;
  const unreadable = rows.length - gaps.length;
  return {
    rows,
    rated: gaps.length,
    unreadable,
    meanAbsGap: meanAbs === null ? null : Number(meanAbs.toFixed(2)),
    meanSignedGap: mean(gaps) === null ? null : Number(mean(gaps)!.toFixed(2)),
    largeGaps,
    // An unrated answer is not agreement: every answer must be rated to pass.
    passed: unreadable === 0 && meanAbs !== null && meanAbs <= CALIBRATION_MAX_MEAN_GAP && largeGaps <= CALIBRATION_MAX_LARGE_GAPS,
  };
}

const fr = (value: number | null, digits = 1) => (value === null ? "—" : value.toFixed(digits).replace(".", ","));
const signed = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1).replace(".", ",")}`);

export function formatCalibrationReport(input: {
  summary: CalibrationSummary;
  file: Pick<CalibrationFile, "rater" | "ratedAt" | "source">;
  calibrationPath: string;
  corpusPath: string;
  corpusStatus: string | null;
  environment: string;
  judgeModel: string;
  repeats: number;
  canonCap: string;
  estimatedCostUsd: number;
  generatedAt: string;
}): string {
  const { summary } = input;
  const lines = [
    `# Calibrage du juge — ${input.file.rater ?? "notation humaine"}${input.file.ratedAt ? ` (${input.file.ratedAt})` : ""}`,
    "",
    `- Réponses rejugées telles quelles : ${summary.rows.length} (${input.calibrationPath}) ; corpus ${input.corpusPath}${input.corpusStatus ? ` (${input.corpusStatus})` : ""}`,
    `- Juge ${input.judgeModel} · ${input.repeats} passage(s) · fiches ${input.environment} · ${input.canonCap}`,
    `- Coût estimé ${input.estimatedCostUsd.toFixed(2)} $ · généré ${input.generatedAt}`,
    "",
    `**${summary.passed ? "Critère atteint" : "Critère non atteint"}** : écart moyen ${fr(summary.meanAbsGap, 2)} (seuil ≤ ${CALIBRATION_MAX_MEAN_GAP}) ; ${summary.largeGaps} écart(s) > ${CALIBRATION_GAP_THRESHOLD} points (seuil < ${CALIBRATION_MAX_LARGE_GAPS + 1}) ; biais moyen ${signed(summary.meanSignedGap)}${summary.unreadable ? ` ; ${summary.unreadable} réponse(s) du juge illisible(s), exclue(s)` : ""}.`,
    "",
    "| Réponse | Humain | Juge | Écart | Juge avant | canon /5 | Raison du juge |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...summary.rows.map((row) => `| ${row.label} | ${fr(row.human, 0)} | ${fr(row.judge)} | ${row.gap !== null && Math.abs(row.gap) > CALIBRATION_GAP_THRESHOLD ? `**${signed(row.gap)}**` : signed(row.gap)} | ${fr(row.previousJudge)} | ${fr(row.canonTimeline, 0)} | ${row.rationale.replace(/\|/g, "/").replace(/\s+/g, " ")}${row.corpusDoubt ? ` — *Corpus douteux : ${row.corpusDoubt.replace(/\|/g, "/").replace(/\s+/g, " ")}*` : ""} |`),
    "",
  ];
  return lines.join("\n");
}
