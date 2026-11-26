/**
 * Conversational latency, lot 2 — long-conversation recall test.
 *
 *   npm run eval:llm-recall -- --models openai/gpt-5.6-luna,anthropic/claude-haiku-5.5 [--character max] [--dry-run]
 *
 * Replays `docs/eval/rappel_long_v1.json` (≈ 40 player turns) once per model
 * through the live chain, exactly as the J3 sequence replay does (delivered
 * history, structured memory merged from the GM deltas, GM loop), with only
 * the character model changed in memory. Recall turns are graded lexically
 * (`src/services/llmRecallScenario.ts`); no judge call. Nothing is persisted:
 * no session, no `eval_runs` row, `admin_settings` read-only, sandbox only.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";

const USAGE = `npm run eval:llm-recall -- --models a,b [options]
  --models a,b             modèles OpenRouter du personnage (défaut : modèle réglé)
  --character all|max|emma conversations jouées (défaut all)
  --scenario FICHIER       défaut docs/eval/rappel_long_v1.json
  --env SANDBOX            défaut sandbox-ulrich (prod refusé)
  --temperature T          température des candidats (défaut 0.8, celle du proxy sans réglage ;
                           le réglage live 1.4 n'a aucun effet sur gpt-5.6-luna, qui l'ignore)
  --top-p P                défaut 0.95
  --max-cost-usd X         plafond (défaut 3)
  --max-turns N            ne joue que les N premiers tours (essai court, aucun rappel noté)
  --dry-run                estimation seule
  --out DOSSIER            défaut output/eval-judge`;

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  if (args.has("help")) { log(USAGE); return; }
  const recall = await import("@/services/llmRecallScenario");
  const { BENCH_CANDIDATES } = await import("@/services/llmLatencyBench");
  const scenarioFile = path.resolve(process.cwd(), (args.get("scenario") ?? "docs/eval/rappel_long_v1.json").replace(/^@/, ""));
  if (!existsSync(scenarioFile)) fail(`Scénario introuvable : ${scenarioFile}`);
  const parsed = recall.parseRecallScenario(readFileSync(scenarioFile, "utf8"));
  if (parsed.errors.length) fail(`Scénario invalide :\n  ${parsed.errors.join("\n  ")}`);
  const character = args.get("character") ?? "all";
  const maxTurns = args.has("max-turns") ? Number(args.get("max-turns")) : Infinity;
  if (!(maxTurns >= 1)) fail("--max-turns doit être un entier positif");
  const conversations = parsed.conversations.filter((c) => character === "all" || c.characterKey === character)
    .map((c) => ({ ...c, turns: c.turns.slice(0, maxTurns) }));
  if (!conversations.length) fail("Aucune conversation avec ce filtre.");
  const capUsd = Number((args.get("max-cost-usd") ?? "3").replace(",", "."));
  if (!Number.isFinite(capUsd) || capUsd <= 0) fail("--max-cost-usd doit être un montant positif");

  const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
  const [pipeline, runner, sequence, live] = await Promise.all([
    import("@/services/evalJudgePipeline"),
    import("@/services/evalJudgeRunner"),
    import("@/services/evalJudgeSequence"),
    import("@/services/evalJudgeSequenceLive"),
  ]);
  const liveSnapshot = pipeline.snapshotLiveSettings();
  const temperature = Number(args.get("temperature") ?? 0.8);
  const topP = Number(args.get("top-p") ?? 0.95);
  if (!Number.isFinite(temperature) || !Number.isFinite(topP)) fail("--temperature et --top-p doivent être des nombres");
  const models = (args.get("models")?.split(",").map((m) => m.trim()).filter(Boolean)) ?? [liveSnapshot.model];
  const configs = models.map((model) => {
    const compare = runner.buildCompareConfigs(liveSnapshot, { variant: "optimized_v3", snapshotJson: "" }, { variant: "optimized_v3", snapshotJson: JSON.stringify({ model, temperature, topP }) });
    if (compare.errors.length) fail(`Modèle invalide ${model} : ${compare.errors.join(" ; ")}`);
    return { model, config: compare.configs[1] };
  });

  const turns = conversations.reduce((sum, c) => sum + c.turns.length, 0);
  let estimate = 0;
  for (const { model } of configs) {
    const price = BENCH_CANDIDATES.find((c) => c.model === model)?.price ?? { input: 1, output: 3 };
    estimate += recall.estimateRecallRunUsd(turns, price);
  }
  log(`• ${configs.length} modèles × ${conversations.length} conversations (${turns} tours) · estimation ${estimate.toFixed(2)} $ (personnage + GM, sans juge) · plafond ${capUsd.toFixed(2)} $`);
  for (const { model, config } of configs) log(`  - ${model} · ${config.promptVariant} · T=${config.temperature} · ${config.maxTokens} tokens`);
  if (estimate > capUsd) fail("Estimation au-dessus du plafond.", 2);
  if (args.has("dry-run")) { log("✓ --dry-run : aucun appel payant."); await session.close(); return; }

  const controller = new AbortController();
  process.on("SIGINT", () => { if (controller.signal.aborted) process.exit(130); controller.abort("stop"); log("\n⏸ Arrêt demandé."); });
  const summaries: import("@/services/llmRecallScenario").RecallRunSummary[] = [];
  const raw: Array<{ model: string; conversationId: string; turns: import("@/services/llmRecallScenario").RecallTurnResult[]; finalMemory: unknown }> = [];
  for (const { model, config } of configs) {
    for (const conversation of conversations) {
      const asSequence = recall.recallAsSequence(conversation);
      let state = sequence.initialSequenceState();
      const results: import("@/services/llmRecallScenario").RecallTurnResult[] = [];
      log(`\n── ${model} · ${conversation.id}`);
      for (let index = 0; index < conversation.turns.length && !controller.signal.aborted; index += 1) {
        const turn = conversation.turns[index];
        let trace: import("@/services/evalJudgeSequence").SequenceTurnTrace;
        try {
          trace = await runner.withRateLimitRetry(() => live.runSequenceEvalTurn(config, {
            sequence: asSequence, turnIndex: index + 1, userMessage: turn.question, history: state.history, memory: state.memory,
            gmGuidance: state.gmGuidance, gmTopicsCovered: state.topicsCovered, gmSpeechState: state.gmSpeechState,
            timeElapsedSeconds: index * sequence.SEQUENCE_SECONDS_PER_TURN, hasSeenFilm: sequence.sequenceFilmAnswer(asSequence),
          }, controller.signal), controller.signal, {
            onRateLimited: ({ attempt, waitMs }) => log(`  ⏳ 429, tentative ${attempt} : ${Math.round(waitMs / 1000)} s`),
          });
        } catch (error) {
          if (controller.signal.aborted) break;
          trace = { response: "", gm: null, latencyMs: 0, error: error instanceof Error ? error.message : String(error) };
        }
        state = sequence.advanceSequenceState(state, {
          characterKey: conversation.characterKey, userMessage: turn.question, response: trace.response,
          turnIndex: index + 1, gm: trace.gm, timestamp: Date.now(),
        });
        const verdict = turn.recall ? recall.gradeRecall(turn.recall, trace.response, trace.error ?? null) : null;
        results.push({
          turnIndex: index + 1, question: turn.question, response: trace.response, latencyMs: trace.latencyMs,
          error: trace.error ?? null, memoryLastTurn: state.memory?.lastTurn ?? 0,
          recall: turn.recall && verdict ? { fact: turn.recall.fact, verdict } : null,
        });
        log(`  [${index + 1}/${conversation.turns.length}] ${(trace.latencyMs / 1000).toFixed(1)} s · mémoire t${state.memory?.lastTurn ?? 0}${verdict ? ` · rappel ${turn.recall!.fact} : ${verdict}` : ""}${trace.error ? ` · ✖ ${trace.error}` : ""}`);
      }
      summaries.push(recall.summarizeRecallRun(model, conversation, results));
      raw.push({ model, conversationId: conversation.id, turns: results, finalMemory: state.memory });
    }
  }

  const report = recall.formatRecallReport(new Date().toISOString().slice(0, 10), session.environment, summaries);
  const outDir = path.resolve(process.cwd(), args.get("out") ?? "output/eval-judge");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(path.join(outDir, `llm-recall-${stamp}.json`), `${JSON.stringify({ environment: session.environment, summaries, raw }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, `llm-recall-${stamp}.md`), report, "utf8");
  process.stdout.write(report);
  await session.close();
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
