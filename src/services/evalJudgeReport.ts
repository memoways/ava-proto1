import type { EvalCostEstimate, EvalRun, EvalTurnConfig } from "@/services/evalJudgePipeline";
import type { ReferenceCandidateComparison } from "@/services/evalJudgeScoring";

/**
 * Markdown report of a reference/candidate run, written by the headless judge
 * (file + GitHub job summary). Pure formatting: no network, no clock.
 */

export interface EvalReportInput {
  run: Pick<EvalRun, "id" | "judge_model" | "repeats" | "status" | "error_message">;
  environment: string;
  configs: EvalTurnConfig[];
  itemCount: number;
  characterFilter: string;
  comparison: ReferenceCandidateComparison | null;
  estimate: EvalCostEstimate;
  capUsd: number;
  committedUsd: number;
  actual: { usd: number; pricedCalls: number; pendingCalls: number; failedCalls: number } | null;
  outcome: string;
  completedTurns: number;
  errorTurns: number;
  durationMs: number;
  blockedSettingsWrites: number;
  generatedAt: string;
}

function signed(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function plain(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function minutes(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
}

export function formatEvalReportMarkdown(input: EvalReportInput): string {
  const { comparison: c } = input;
  const lines: string[] = [];
  lines.push(`# LLM juge — référence contre candidat`);
  lines.push("");
  lines.push(`- Run : \`${input.run.id}\` (${input.outcome}) · environnement \`${input.environment}\` · ${input.generatedAt}`);
  lines.push(`- Juge : \`${input.run.judge_model}\` · ${input.itemCount} questions (${input.characterFilter}) × ${input.configs.length} configurations × ${input.run.repeats} passages`);
  lines.push(`- Tours : ${input.completedTurns}/${input.estimate.turns} terminés, ${input.errorTurns} en erreur · durée ${minutes(input.durationMs)}`);
  for (const config of input.configs) {
    lines.push(`- ${config.factor === "baseline" ? "Référence" : "Candidat"} : ${config.label} — \`${config.model}\`, température ${config.temperature}, ${config.maxTokens} tokens`);
  }
  const actual = input.actual
    ? `${input.actual.usd.toFixed(2)} $ mesurés (\`llm_usage\`, ${input.actual.pricedCalls} appels chiffrés${input.actual.pendingCalls ? `, ${input.actual.pendingCalls} encore sans prix` : ""}${input.actual.failedCalls ? `, ${input.actual.failedCalls} sans prix disponible` : ""})`
    : "coût réel non lu";
  lines.push(`- Coût : estimation ${input.estimate.estimatedCostUsd.toFixed(2)} $ · engagé ${input.committedUsd.toFixed(2)} $ · ${actual} · plafond ${input.capUsd.toFixed(2)} $`);
  if (input.blockedSettingsWrites > 0) {
    lines.push(`- ⚠️ ${input.blockedSettingsWrites} écriture(s) vers \`admin_settings\` refusée(s) : les réglages sont restés intacts.`);
  }
  if (input.run.error_message) lines.push(`- Arrêt : ${input.run.error_message}`);
  lines.push("");

  if (!c) {
    lines.push("Pas de comparaison : aucun résultat candidat enregistré.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`## Verdict`);
  lines.push("");
  lines.push(`**${c.verdict.text}**`);
  lines.push("");
  if (input.run.repeats < 2) {
    lines.push(`> ⚠️ Un seul passage par question : le bruit n'est pas mesuré, ce verdict est indicatif. Relancer avec \`--repeats 3\` avant de décider.`);
    lines.push("");
  }
  lines.push(`| | Référence | Candidat | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  lines.push(`| Note pondérée /10 | ${plain(c.overall.reference)} | ${plain(c.overall.candidate)} | ${signed(c.overall.delta)} |`);
  lines.push(`| Réponses notées | ${c.overall.referenceN} | ${c.overall.candidateN} | |`);
  lines.push("");
  lines.push(`Bruit entre passages d'une même question : ± ${c.overall.repeatSpread.toFixed(2)} · ${c.overall.itemsBetter} question(s) en hausse, ${c.overall.itemsWorse} en baisse (|Δ| ≥ 0,3).`);
  lines.push("");

  lines.push(`## Par critère (/5)`);
  lines.push("");
  lines.push(`| Critère | Référence | Candidat | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const row of c.byCriterion) {
    lines.push(`| ${cell(row.label)} (\`${row.key}\`) | ${plain(row.reference)} | ${plain(row.candidate)} | ${signed(row.delta)} |`);
  }
  lines.push("");

  lines.push(`## Par personnage (/10)`);
  lines.push("");
  lines.push(`| Personnage | Référence | Candidat | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const row of c.byCharacter) {
    lines.push(`| ${cell(row.character)} | ${plain(row.reference)} | ${plain(row.candidate)} | ${signed(row.delta)} |`);
  }
  lines.push("");

  lines.push(`## Par question (/10, de la plus forte baisse à la plus forte hausse)`);
  lines.push("");
  lines.push(`| Question | Personnage | Référence | Candidat | Δ | Critères les plus mobiles |`);
  lines.push(`|---|---|---:|---:|---:|---|`);
  for (const row of c.byItem) {
    const moving = [...row.criteria]
      .filter((criterion) => criterion.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map((criterion) => `${criterion.key} ${signed(criterion.delta, 1)}`)
      .join(", ");
    lines.push(`| ${cell(row.question)} | ${cell(row.character)} | ${plain(row.reference)} | ${plain(row.candidate)} | ${signed(row.delta)} | ${moving || "—"} |`);
  }
  lines.push("");
  lines.push(...formatCandidatePresents(input.configs));
  lines.push(`Détail des réponses et des notes : Admin › Qualité › LLM as judge, run \`${input.run.id}\`.`);
  return `${lines.join("\n")}\n`;
}

/** Lot P: the in-memory PRÉSENT each side was played with, so the run can be read and replayed. */
export function formatCandidatePresents(configs: EvalReportInput["configs"]): string[] {
  const lines: string[] = [];
  for (const config of configs) {
    const summaries = config.situationSummaries;
    if (!summaries || !Object.keys(summaries).length) continue;
    lines.push(`## PRÉSENT joué en mémoire — ${config.factor === "baseline" ? "référence" : "candidat"} (${config.situationSummarySource ?? "instantané"})`);
    lines.push("");
    for (const [character, text] of Object.entries(summaries)) {
      lines.push(`**${character === "emma" ? "Emma" : "Max"}**`);
      lines.push("");
      lines.push(...String(text).split(/\r?\n/).map((line) => `> ${line}`));
      lines.push("");
    }
  }
  return lines;
}
