import type { EvalTurnConfig } from "@/services/evalJudgePipeline";
import { formatCandidatePresents } from "@/services/evalJudgeReport";
import type { SequenceComparison, SequenceCostEstimate, SequenceRunResult, SequenceDeltaRow } from "@/services/evalJudgeSequence";

/**
 * Markdown report of a J3 sequence run (the J2 report extended to sequences):
 * Δ per sequence, per turn and per sequence criterion, GM loop, cost per
 * sequence and cap. Pure formatting: no network, no clock.
 */
export interface SequenceReportInput {
  runId: string;
  environment: string;
  corpusFile: string;
  corpusStatus: string | null;
  judgeModel: string;
  repeats: number;
  configs: EvalTurnConfig[];
  comparison: SequenceComparison;
  results: SequenceRunResult[];
  estimate: SequenceCostEstimate;
  capUsd: number;
  committedUsd: number;
  actual: { usd: number; pricedCalls: number; pendingCalls: number; failedCalls: number } | null;
  /** Measured cost of each played sequence (llm_usage window), keyed `config::sequence::repeat`. */
  costBySequenceRun: Record<string, number>;
  outcome: string;
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

function cell(text: string, limit = 400): string {
  const clean = text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function minutes(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
}

function deltaCells(row: SequenceDeltaRow): string {
  return `${plain(row.reference)} | ${plain(row.candidate)} | ${signed(row.delta)}`;
}

export function sequenceRunCostKey(result: Pick<SequenceRunResult, "configLabel" | "sequenceId" | "repeatIndex">): string {
  return `${result.configLabel}::${result.sequenceId}::${result.repeatIndex}`;
}

export function formatSequenceReportMarkdown(input: SequenceReportInput): string {
  const c = input.comparison;
  const lines: string[] = [];
  const played = input.results.length;
  const turnsPlayed = input.results.reduce((sum, result) => sum + result.turns.length, 0);
  lines.push(`# LLM juge J3 — séquences, référence contre candidat`);
  lines.push("");
  lines.push(`- Run local \`${input.runId}\` (${input.outcome}) · environnement \`${input.environment}\` · ${input.generatedAt}`);
  lines.push(`- Corpus : \`${input.corpusFile}\`${input.corpusStatus ? ` (statut : ${input.corpusStatus})` : ""} · ${input.estimate.sequences} séquences × ${input.configs.length} configurations × ${input.repeats} passages`);
  lines.push(`- Juge : \`${input.judgeModel}\` · ${played} séquences jouées, ${turnsPlayed} tours · durée ${minutes(input.durationMs)}`);
  for (const config of input.configs) {
    const extras = [config.streamContract ? `contrat ${config.streamContract}` : "", config.situationSummarySource ? `PRÉSENT ${config.situationSummarySource}` : ""].filter(Boolean).join(", ");
    lines.push(`- ${config.factor === "baseline" ? "Référence" : "Candidat"} : ${config.label} — \`${config.model}\`, température ${config.temperature}, ${config.maxTokens} tokens${extras ? ` (${extras})` : ""}`);
  }
  const actual = input.actual
    ? `${input.actual.usd.toFixed(2)} $ mesurés (\`llm_usage\`, ${input.actual.pricedCalls} appels chiffrés${input.actual.pendingCalls ? `, ${input.actual.pendingCalls} encore sans prix` : ""}${input.actual.failedCalls ? `, ${input.actual.failedCalls} sans prix disponible` : ""})`
    : "coût réel non lu";
  lines.push(`- Coût : estimation ${input.estimate.estimatedCostUsd.toFixed(2)} $ · engagé ${input.committedUsd.toFixed(2)} $ · ${actual} · plafond ${input.capUsd.toFixed(2)} $`);
  if (input.blockedSettingsWrites > 0) lines.push(`- ⚠️ ${input.blockedSettingsWrites} écriture(s) vers \`admin_settings\` refusée(s).`);
  lines.push(`- Aucune session, aucune ligne \`eval_runs\` : réponses et notes complètes dans le JSON joint au rapport.`);
  lines.push("");

  lines.push(`## Verdict`);
  lines.push("");
  lines.push(`**${c.verdict}**`);
  lines.push("");
  if (input.repeats < 2) {
    lines.push(`> ⚠️ Un seul passage : le bruit multi-tours n'est pas mesuré, verdict indicatif.`);
    lines.push("");
  }
  lines.push(`| | Référence | Candidat | Δ | Bruit entre passages |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  lines.push(`| Note par tour /10 (grille J1) | ${deltaCells(c.overall.turn)} | ± ${c.overall.turnNoise.toFixed(2)} |`);
  lines.push(`| Note de séquence /10 (continuité) | ${deltaCells(c.overall.sequence)} | ± ${c.overall.sequenceNoise.toFixed(2)} |`);
  lines.push(`| Séquences jouées | ${c.overall.referencePasses} | ${c.overall.candidatePasses} | | |`);
  lines.push("");
  lines.push(`Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : ${c.errors}.`);
  lines.push("");

  lines.push(`## Par séquence (/10)`);
  lines.push("");
  lines.push(`| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|`);
  for (const row of c.bySequence) {
    lines.push(`| ${cell(row.title)} | ${deltaCells(row.turn)} | ${deltaCells(row.sequence)} | ± ${row.turnSpread.toFixed(2)} / ${row.sequenceSpread.toFixed(2)} |`);
  }
  lines.push("");

  lines.push(`## Critères de séquence (/5)`);
  lines.push("");
  lines.push(`| Critère | Référence | Candidat | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const row of c.bySequenceCriterion) lines.push(`| ${cell(row.label)} (\`${row.key}\`) | ${deltaCells(row)} |`);
  lines.push("");

  lines.push(`## Critères par tour, grille J1 (/5)`);
  lines.push("");
  lines.push(`| Critère | Référence | Candidat | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const row of c.byTurnCriterion) lines.push(`| ${cell(row.label)} (\`${row.key}\`) | ${deltaCells(row)} |`);
  lines.push("");

  lines.push(`## Par tour (/10, de la plus forte baisse à la plus forte hausse)`);
  lines.push("");
  lines.push(`| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |`);
  lines.push(`|---|---|---:|---:|---:|---:|`);
  for (const row of c.byTurn) {
    lines.push(`| ${row.sequenceId} · ${row.turnIndex} | ${cell(row.question, 90)} | ${deltaCells(row.turn)} | ± ${row.spread.toFixed(2)} |`);
  }
  lines.push("");

  lines.push(`## Boucle Game Master → personnage et mémoire`);
  lines.push("");
  lines.push(`| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |`);
  lines.push(`|---|---|---:|---:|---:|---:|---:|`);
  for (const result of input.results) {
    const gmExecuted = result.turns.filter((turn) => turn.gmStatus === "executed").length;
    const cost = input.costBySequenceRun[sequenceRunCostKey(result)];
    lines.push(`| ${result.sequenceId} | ${result.factor === "baseline" ? "référence" : "candidat"} | ${result.repeatIndex} | ${gmExecuted}/${result.turns.length} | ${result.guidanceTransmitted}/${Math.max(0, result.turns.length - 1)} | ${result.turns.at(-1)?.memoryLastTurnAfter ?? 0} | ${typeof cost === "number" ? `${cost.toFixed(2)} $` : "—"} |`);
  }
  lines.push("");
  lines.push(`« Conseils transmis » : tours dont l'entrée contenait le \`next_turn_guidance\` du post-tour précédent (le premier tour n'en reçoit jamais).`);
  const issues = new Map<string, number>();
  for (const turn of input.results.flatMap((result) => result.turns)) {
    if (turn.gmIssue) issues.set(turn.gmIssue, (issues.get(turn.gmIssue) ?? 0) + 1);
  }
  if (issues.size) {
    lines.push("");
    lines.push(`Post-tours non exécutés (aucun conseil transmis au tour suivant, comme en jeu) : ${[...issues.entries()].map(([issue, count]) => `${cell(issue, 120)} × ${count}`).join(" ; ")}.`);
  }
  lines.push("");

  lines.push(`## Ce que dit le juge de séquence (premier passage)`);
  lines.push("");
  for (const result of input.results.filter((entry) => entry.repeatIndex === 1)) {
    const score = result.sequenceScore === null ? "—" : result.sequenceScore.toFixed(2);
    lines.push(`- **${result.sequenceId}** · ${result.factor === "baseline" ? "référence" : "candidat"} · ${score}/10 — ${cell(result.sequenceJudge?.rationale ?? "juge de séquence en erreur", 600)}`);
  }
  lines.push("");

  lines.push(`## Transcriptions (premier passage, référence)`);
  lines.push("");
  for (const result of input.results.filter((entry) => entry.repeatIndex === 1 && entry.factor === "baseline")) {
    lines.push(`### ${cell(result.title)}`);
    lines.push("");
    for (const turn of result.turns) {
      lines.push(`**Tour ${turn.turnIndex}** — ${cell(turn.question, 600)}`);
      lines.push("");
      lines.push(`> ${cell(turn.response || "(pas de réponse)", 1200)}`);
      lines.push("");
      lines.push(`Note ${turn.score === null ? "—" : turn.score.toFixed(2)}/10 · GM ${turn.gmStatus}${turn.gmGuidanceIn ? " · conseil reçu" : ""}${turn.error ? ` · ⚠️ ${cell(turn.error, 200)}` : ""}`);
      lines.push("");
    }
  }
  lines.push(...formatCandidatePresents(input.configs));
  return `${lines.join("\n")}\n`;
}
