/**
 * Merges the JSON results of several `eval:judge:sequences --focus factuality` runs into one report
 * (a run interrupted by a network loss is completed by short follow-up runs). A pass whose turns
 * were all lost to errors is dropped; the remaining passes of a sequence are renumbered 1..n.
 *
 *   npm run eval:judge:merge-factuality -- --out docs/eval/x.md run1.json run2.json …
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseSequenceCorpus, type SequenceRunResult } from "@/services/evalJudgeSequence";
import { formatFactualityReportMarkdown } from "@/services/evalJudgeFactualityReport";

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const outIndex = argv.indexOf("--out");
const out = outIndex >= 0 ? argv[outIndex + 1] : "output/eval-judge/factualite_fusion.md";
const files = argv.filter((arg, index) => arg.endsWith(".json") && index !== outIndex + 1);
if (!files.length) throw new Error("Aucun fichier de résultats.");
const runs = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as { runId: string; environment: string; judgeModel: string; configs: Array<{ label: string }>; results: SequenceRunResult[]; actual: { usd: number } | null });
const corpusFile = "docs/eval/sequences_factuality_f.json";
const corpus = parseSequenceCorpus(readFileSync(corpusFile, "utf8"));
const usable = (result: SequenceRunResult) => result.turns.some((turn) => typeof turn.score === "number");
const counters = new Map<string, number>();
const results: SequenceRunResult[] = [];
let dropped = 0;
for (const run of runs) {
  for (const result of [...run.results].sort((a, b) => a.repeatIndex - b.repeatIndex)) {
    if (!usable(result)) { dropped += 1; continue; }
    const next = (counters.get(result.sequenceId) ?? 0) + 1;
    counters.set(result.sequenceId, next);
    results.push({ ...result, repeatIndex: next });
  }
}
const actualUsd = runs.every((run) => run.actual) ? runs.reduce((sum, run) => sum + (run.actual?.usd ?? 0), 0) : null;
const markdown = formatFactualityReportMarkdown({
  runId: runs.map((run) => run.runId.slice(0, 8)).join("+"),
  environment: runs[0].environment,
  corpusFile,
  judgeModel: runs[0].judgeModel,
  repeats: Math.max(...counters.values()),
  configLabel: runs[0].configs[0].label,
  sequences: corpus.sequences,
  results,
  capUsd: 3,
  actualUsd,
  outcome: `${runs.length} runs fusionnés, ${dropped} passage(s) sans aucun tour noté écarté(s) (coupure réseau)`,
  generatedAt: new Date().toISOString(),
});
writeFileSync(path.resolve(out), markdown, "utf8");
process.stderr.write(`✓ ${out} · passages par séquence : ${[...counters.entries()].map(([id, n]) => `${id}:${n}`).join(" ")}\n`);
