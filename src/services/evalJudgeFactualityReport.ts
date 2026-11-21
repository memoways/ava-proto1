import { mean, stddev } from "@/services/evalJudgePipeline";
import { describeFactualityWeights, type FactStatus } from "@/services/evalJudgeFactuality";
import type { EvalSequence, SequenceRunResult } from "@/services/evalJudgeSequence";

/** Markdown report of a factuality-focus run: note per turn, per fact, noise across passes. Pure formatting. */
export interface FactualityReportInput {
  runId: string;
  environment: string;
  corpusFile: string;
  judgeModel: string;
  repeats: number;
  configLabel: string;
  sequences: EvalSequence[];
  results: SequenceRunResult[];
  capUsd: number;
  actualUsd: number | null;
  outcome: string;
  generatedAt: string;
}

const MARK: Record<FactStatus, string> = { correct: "✓", contradicted: "✗", invented: "⚠", uncertain_ok: "~", not_addressed: "∅" };
const fix = (value: number | null, digits = 2) => (value === null ? "—" : value.toFixed(digits));
const cell = (text: string, limit = 160) => {
  const clean = text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
};

export function formatFactualityReportMarkdown(input: FactualityReportInput): string {
  const lines: string[] = [];
  lines.push("# Juge — round 1 : factualité seule");
  lines.push("");
  lines.push(`- Run local \`${input.runId}\` (${input.outcome}) · \`${input.environment}\` · ${input.generatedAt}`);
  lines.push(`- Corpus \`${input.corpusFile}\` · configuration « ${input.configLabel} » · ${input.repeats} passages · juge \`${input.judgeModel}\``);
  lines.push(`- Note /10 = moyenne pondérée de ${describeFactualityWeights()} (prémisse fausse seulement si la question en porte une), plafond canon (≤ 3 si canon = 0, ≤ 4 si canon ≤ 1). **Aucun critère de style.**`);
  lines.push(`- Coût mesuré : ${input.actualUsd === null ? "non lu" : `${input.actualUsd.toFixed(2)} $`} · plafond ${input.capUsd.toFixed(2)} $`);
  lines.push("- Légende des faits : ✓ juste · ✗ contredit · ⚠ inventé · ~ incertitude crédible · ∅ non abordé. Un symbole par passage.");
  lines.push("");

  const allScores: number[] = [];
  const noise: number[] = [];
  for (const character of ["max", "emma"] as const) {
    const sequences = input.sequences.filter((sequence) => sequence.characterKey === character);
    const characterResults = input.results.filter((result) => result.characterKey === character);
    if (!characterResults.length) continue;
    const scores = characterResults.flatMap((result) => result.turns.map((turn) => turn.score)).filter((s): s is number => typeof s === "number");
    allScores.push(...scores);
    lines.push(`## ${character === "max" ? "Max" : "Emma"} — note factualité moyenne ${fix(scores.length ? mean(scores) : null)}/10 (${scores.length} tours notés)`);
    lines.push("");
    for (const sequence of sequences) {
      const runs = characterResults.filter((result) => result.sequenceId === sequence.id).sort((a, b) => a.repeatIndex - b.repeatIndex);
      if (!runs.length) continue;
      lines.push(`### ${sequence.id} — ${sequence.title}`);
      lines.push("");
      lines.push("| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |");
      lines.push("|---|---|---|---|---|---|");
      sequence.turns.forEach((turn, index) => {
        const perPass = runs.map((run) => run.turns[index]);
        const turnScores = perPass.map((t) => t?.score).filter((s): s is number => typeof s === "number");
        if (turnScores.length > 1) noise.push(stddev(turnScores));
        const premise = perPass.map((t) => t?.factuality?.false_premise).filter((v): v is number => typeof v === "number");
        const problems = [...new Set(perPass.flatMap((t) => [
          ...(t?.factuality?.forbiddenHit ?? []).map((claim) => `interdit : ${claim}`),
          ...(t?.factuality?.facts ?? []).filter((f) => f.status === "contradicted" || f.status === "invented").map((f) => `${MARK[f.status]} ${f.fact}`),
        ]))];
        lines.push(`| ${index + 1} · ${cell(turn.question, 70)} | ${turnScores.map((s) => s.toFixed(1)).join(" / ") || "—"} | ${fix(turnScores.length ? mean(turnScores) : null)} | ${fix(turnScores.length > 1 ? stddev(turnScores) : null)} | ${premise.length ? premise.join(" / ") : "—"} | ${cell(problems.join(" ; ") || "—", 260)} |`);
      });
      lines.push("");
      lines.push("**Par fait** (un symbole par passage)");
      lines.push("");
      lines.push("| Tour | Fait attendu | Passages |");
      lines.push("|---|---|---|");
      sequence.turns.forEach((turn, index) => {
        turn.requiredFacts.forEach((fact, factIndex) => {
          const marks = runs.map((run) => {
            const status = run.turns[index]?.factuality?.facts[factIndex]?.status;
            return status ? MARK[status] : "—";
          }).join(" ");
          lines.push(`| ${index + 1} | ${cell(fact, 140)} | ${marks} |`);
        });
        if (turn.falsePremise) {
          const marks = runs.map((run) => run.turns[index]?.factuality?.false_premise ?? "—").join(" ");
          lines.push(`| ${index + 1} | *Prémisse corrigée* : ${cell(turn.falsePremise, 110)} | ${marks} |`);
        }
      });
      lines.push("");
      lines.push("<details><summary>Réponses et attendus du juge</summary>");
      lines.push("");
      sequence.turns.forEach((turn, index) => {
        lines.push(`**Tour ${index + 1}** — ${cell(turn.question, 200)}`);
        runs.forEach((run) => {
          const t = run.turns[index];
          lines.push(`- p${run.repeatIndex} (${t?.score === null || t?.score === undefined ? "—" : t.score.toFixed(1)}/10) : ${cell(t?.response ?? "", 420)}${t?.factuality?.rationale ? ` — *${cell(t.factuality.rationale, 260)}*` : ""}${t?.error ? ` ⚠ ${cell(t.error, 120)}` : ""}`);
        });
        lines.push("");
      });
      lines.push("</details>");
      lines.push("");
    }
  }
  lines.push("## Bruit de mesure");
  lines.push("");
  lines.push(`- Note moyenne tous tours : ${fix(allScores.length ? mean(allScores) : null)}/10 sur ${allScores.length} tours notés.`);
  lines.push(`- Écart-type moyen d'un même tour entre passages : **${fix(noise.length ? mean(noise) : null)}** point(s) sur ${noise.length} tours à ≥ 2 passages. Une différence plus petite entre deux configurations n'est pas un signal.`);
  lines.push("");
  return lines.join("\n");
}
