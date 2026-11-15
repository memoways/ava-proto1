/**
 * Judge calibration against a human rater — lot K1.
 *
 *   npm run eval:judge:calibrate -- [--file docs/eval/calibration_romed_20261114.json]
 *     [--corpus docs/eval/sequences_j3_v2.json] [--repeats 1] [--max-cost-usd 0.5]
 *     [--judge-model ID] [--env sandbox-ulrich] [--out output/eval-judge]
 *
 * Re-rates answers that already exist (nothing is regenerated, no session, no
 * `eval_runs` row): about one judge call per answer and pass. The canon
 * reference comes from the synced sheets of the sandbox, read-only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const calibrationPath = args.get("file") ?? "docs/eval/calibration_romed_20261114.json";
  const corpusPath = args.get("corpus") ?? "docs/eval/sequences_j3_v2.json";
  const repeats = Number(args.get("repeats") ?? 1);
  const capUsd = Number((args.get("max-cost-usd") ?? "0.5").replace(",", "."));
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) fail("--repeats doit être un entier de 1 à 5");
  if (!Number.isFinite(capUsd) || capUsd <= 0) fail("--max-cost-usd doit être un montant positif");
  for (const file of [calibrationPath, corpusPath]) if (!existsSync(file)) fail(`Fichier introuvable : ${file}`);

  const calibration = await import("@/services/evalJudgeCalibration");
  const { file, errors } = calibration.parseCalibrationFile(readFileSync(calibrationPath, "utf8"));
  if (!file) fail(`Calibrage invalide : ${errors.join(" ; ")}`);
  const sequenceModule = await import("@/services/evalJudgeSequence");
  const corpus = sequenceModule.parseSequenceCorpus(readFileSync(corpusPath, "utf8"));
  if (corpus.errors.length) fail(`Corpus invalide : ${corpus.errors.join(" ; ")}`);

  const estimatedCostUsd = Number((file.items.length * repeats * calibration.CALIBRATION_JUDGE_CALL_COST_USD).toFixed(2));
  log(`• ${file.items.length} réponses × ${repeats} passage(s) · estimation ${estimatedCostUsd.toFixed(2)} $ · plafond ${capUsd.toFixed(2)} $`);
  if (estimatedCostUsd > capUsd) fail("Estimation au-delà du plafond : réduire --repeats ou relever --max-cost-usd.", 2);
  if (args.has("dry-run")) return;

  const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
  const [pipeline, scoring, prompts] = await Promise.all([
    import("@/services/evalJudgePipeline"),
    import("@/services/evalJudgeScoring"),
    import("@/services/characterPromptService"),
  ]);
  const judgeModel = args.get("judge-model") ?? pipeline.EVAL_DEFAULT_JUDGE_MODEL;
  const weights = await scoring.loadScoreWeights();
  const canonByCharacter = new Map<string, string>();

  const rows: import("@/services/evalJudgeCalibration").CalibrationRow[] = [];
  for (const item of file.items) {
    const sequence = corpus.sequences.find((candidate) => candidate.id === item.sequence);
    if (!sequence || item.turn > sequence.turns.length) fail(`Tour absent du corpus : ${item.sequence} · ${item.turn}`);
    const evalItem = sequenceModule.sequenceTurnAsEvalItem(sequence, item.turn - 1);
    const character = pipeline.evalCharacterKey(evalItem.character_name) ?? "max";
    if (!canonByCharacter.has(character)) {
      const sheet = await prompts.loadCharacterPromptByName(character === "max" ? "Max" : "Emma");
      canonByCharacter.set(character, pipeline.buildJudgeCanonReference(sheet));
    }
    const label = `${item.sequence} · ${item.turn}`;
    const scores: number[] = [];
    let canon: number | null = null;
    let rationale = "";
    let corpusDoubt = "";
    for (let pass = 1; pass <= repeats; pass += 1) {
      let judge: Awaited<ReturnType<typeof pipeline.judgeIsolatedEvalTurn>> | null = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          judge = await pipeline.judgeIsolatedEvalTurn(evalItem, item.response, judgeModel, { canonReference: canonByCharacter.get(character) });
          break;
        } catch (error) {
          if (!pipeline.isRateLimitError(error) || attempt === 3) throw error;
          log("  ⏳ Limite de débit (429) : attente 65 s");
          await sleep(65_000);
        }
      }
      const sub = judge ? scoring.readJudgeSubScores(judge) : null;
      if (!sub) {
        log(`  [${label}] réponse du juge illisible, écartée`);
        continue;
      }
      scores.push(scoring.weightedScore(sub, weights));
      canon = sub.canon_timeline ?? canon;
      rationale = judge?.rationale ?? rationale;
      corpusDoubt = (judge as { corpus_doubt?: string } | null)?.corpus_doubt ?? corpusDoubt;
    }
    const judgeNote = scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2)) : null;
    rows.push({
      label,
      human: item.human,
      judge: judgeNote,
      gap: judgeNote === null ? null : Number((judgeNote - item.human).toFixed(2)),
      previousJudge: item.judge,
      canonTimeline: canon,
      rationale,
      corpusDoubt,
    });
    log(`  [${label}] humain ${item.human} · juge ${judgeNote ?? "—"}`);
  }

  const summary = calibration.summarizeCalibration(rows);
  const markdown = calibration.formatCalibrationReport({
    summary,
    file,
    calibrationPath,
    corpusPath,
    corpusStatus: corpus.status,
    environment: session.environment,
    judgeModel,
    repeats,
    canonCap: (scoring as { describeCanonCap?: () => string }).describeCanonCap?.() ?? "sans plafond canon",
    estimatedCostUsd,
    generatedAt: new Date().toISOString(),
  });
  const outDir = path.resolve(process.cwd(), args.get("out") ?? "output/eval-judge");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `calibration-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
  writeFileSync(out, markdown, "utf8");
  process.stdout.write(markdown);
  log(`✓ Rapport : ${path.relative(process.cwd(), out)}`);
  if (session.blockedSettingsWrites.length) log(`⚠ ${session.blockedSettingsWrites.length} écriture(s) admin_settings refusée(s).`);
  await session.close();
  if (!summary.passed) process.exitCode = 4;
}

main().then(() => process.exit(process.exitCode ?? 0), (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
