/**
 * LLM judge lot J3 — sequences of 3 to 5 turns, reference vs candidate, on a sandbox.
 *
 *   npm run eval:judge:sequences -- --candidate optimized_v3 [--reference optimized_v3] [--repeats 2]
 *
 * Same bootstrap and guards as `run.ts` (J2): Lovable Cloud admin sign-in,
 * `prod` refused, settings hydrated read-only, every write to `admin_settings`
 * refused at the fetch level, explicit cost cap. The sequence replay keeps the
 * history, the structured memory and the GM loop in memory: no session and no
 * `eval_runs` row are written. See docs/plan_llm_as_judge.md, "Lot J3".
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createMemoryStorage, guardAdminSettingsWrites } from "@/services/evalJudgeNodeRuntime";

const storage = createMemoryStorage();
Object.assign(globalThis, { localStorage: storage, sessionStorage: createMemoryStorage() });
const settingsGuard = guardAdminSettingsWrites(globalThis.fetch.bind(globalThis));
for (const level of ["log", "info", "debug"] as const) console[level] = (...args: unknown[]) => console.error(...args);
globalThis.fetch = settingsGuard.fetch;

function loadLocalEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

function fail(message: string, code = 1): never {
  log(`✖ ${message}`);
  process.exit(code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { HEADLESS_SEQUENCE_USAGE, parseHeadlessSequenceArgs } = await import("@/services/evalJudgeSequenceHeadless");
  const { EVAL_COST_FEATURE_KEYS, resolveHeadlessEnvironment, sumUsageCost } = await import("@/services/evalJudgeHeadless");
  const { options, errors } = parseHeadlessSequenceArgs(process.argv.slice(2));
  if (process.argv.includes("--help")) {
    log(HEADLESS_SEQUENCE_USAGE);
    return;
  }
  if (!options.candidate) errors.push("--candidate est obligatoire");
  if (errors.length) fail(`${errors.join("\n  ")}\n\n${HEADLESS_SEQUENCE_USAGE}`);

  loadLocalEnvFile(path.resolve(process.cwd(), ".env.eval.local"));
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    loadLocalEnvFile(path.resolve(commonDir, "..", ".env.eval.local"));
  } catch {
    // Not a git checkout: environment variables only.
  }
  const email = process.env.AVA_EVAL_EMAIL?.trim();
  const password = process.env.AVA_EVAL_PASSWORD;
  if (!email || !password) fail("AVA_EVAL_EMAIL et AVA_EVAL_PASSWORD manquent (environnement ou .env.eval.local).");

  // Corpus first: a bad file fails before any sign-in or spend.
  const corpusPath = path.resolve(process.cwd(), options.corpus!);
  if (!existsSync(corpusPath)) fail(`Corpus introuvable : ${corpusPath}`);
  const sequenceModule = await import("@/services/evalJudgeSequence");
  const corpus = sequenceModule.parseSequenceCorpus(readFileSync(corpusPath, "utf8"));
  if (corpus.errors.length) fail(`Corpus invalide :\n  ${corpus.errors.join("\n  ")}`);
  const sequences = corpus.sequences.filter((sequence) => (options.character === "all" || sequence.characterKey === options.character)
    && (!options.sequenceIds!.length || options.sequenceIds!.includes(sequence.id)));
  const unknown = options.sequenceIds!.filter((id) => !corpus.sequences.some((sequence) => sequence.id === id));
  if (unknown.length) fail(`Séquences inconnues : ${unknown.join(", ")}`);
  if (!sequences.length) fail("Aucune séquence à jouer avec ces filtres.");

  const [{ supabase }, env, settings, pipeline, scoring, runner, live, reportModule] = await Promise.all([
    import("@/integrations/supabase/client"),
    import("@/services/environmentContext"),
    import("@/services/settingsService"),
    import("@/services/evalJudgePipeline"),
    import("@/services/evalJudgeScoring"),
    import("@/services/evalJudgeRunner"),
    import("@/services/evalJudgeSequenceLive"),
    import("@/services/evalJudgeSequenceReport"),
  ]);

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !auth.user) fail(`Connexion Lovable Cloud refusée : ${authError?.message ?? "pas d'utilisateur"}`);
  const profile = await env.getAdminUserProfile(auth.user);
  if (!profile) fail("Ce compte n'est pas administrateur Ava (admin_users).");
  const resolved = resolveHeadlessEnvironment(profile, options.environment!);
  if (resolved.error || !resolved.environment) fail(resolved.error ?? "Environnement introuvable");
  if (resolved.note) log(`ℹ ${resolved.note}`);
  env.configureRuntimeContext({ profile, requestedEnvironment: resolved.environment });
  log(`✓ Connecté (${profile.display_name}) · environnement ${resolved.environment}`);

  await settings.hydrateAllSettings({ readOnly: true });
  const weights = await scoring.loadScoreWeights();

  const readSnapshot = (value: string | undefined) => {
    if (!value?.startsWith("@")) return value ?? "";
    const file = path.resolve(process.cwd(), value.slice(1));
    if (!existsSync(file)) fail(`Instantané introuvable : ${file}`);
    return readFileSync(file, "utf8");
  };
  const liveSnapshot = pipeline.snapshotLiveSettings();
  const compare = runner.buildCompareConfigs(
    liveSnapshot,
    { variant: options.reference ?? liveSnapshot.promptVariant, snapshotJson: readSnapshot(options.referenceJson) },
    { variant: options.candidate!, snapshotJson: readSnapshot(options.candidateJson) },
  );
  if (compare.errors.length) fail(`Instantané invalide : ${compare.errors.join(" ; ")}`);
  const configs = compare.configs;
  const repeats = options.repeats!;
  const judgeModel = options.judgeModel!;

  const isolated = pipeline.estimateEvalRun(1, configs, 1, judgeModel);
  const estimate = sequenceModule.estimateSequenceRun({
    sequences,
    configs: configs.length,
    repeats,
    isolatedPerTurnUsd: isolated.turns ? isolated.estimatedCostUsd / isolated.turns : 0,
  });
  const capUsd = options.maxCostUsd!;
  log(`• ${sequences.length} séquences (${sequences.map((sequence) => `${sequence.id}:${sequence.turns.length}`).join(", ")}) × ${configs.length} configurations × ${repeats} passages = ${estimate.turns} tours + ${estimate.sequenceJudgeCalls} jugements de séquence`);
  for (const config of configs) log(`  - ${config.label} · ${config.model} · T=${config.temperature} · ${config.maxTokens} tokens${config.streamContract ? ` · contrat ${config.streamContract}` : ""}`);
  log(`• Juge ${judgeModel} · estimation ${estimate.estimatedCostUsd.toFixed(2)} $ (${estimate.perTurnUsd.toFixed(4)} $/tour, ${estimate.maxSequenceUsd.toFixed(2)} $ la plus longue séquence) · plafond ${capUsd.toFixed(2)} $`);
  if (estimate.estimatedCostUsd > capUsd + 1e-9) {
    fail(`Estimation ${estimate.estimatedCostUsd.toFixed(2)} $ au-delà du plafond ${capUsd.toFixed(2)} $ : réduire --repeats, --sequences ou relever --max-cost-usd.`, 2);
  }
  if (options.dryRun) {
    log("✓ --dry-run : rien n'est joué.");
    await supabase.auth.signOut({ scope: "local" });
    return;
  }

  // ----------------------------------------------------------------- run
  const runId = randomUUID();
  const startedAt = new Date();
  const startedMs = Date.now();
  const readActualCostUsd = async (since: Date) => {
    const { data, error } = await supabase
      .from("llm_usage")
      .select("cost_usd,status")
      .gte("created_at", since.toISOString())
      .in("feature_key", [...EVAL_COST_FEATURE_KEYS])
      .is("session_id", null);
    if (error) throw new Error(error.message);
    return sumUsageCost(data ?? []);
  };
  // Cost-guard unit: one whole sequence (a partial sequence cannot be judged).
  const costGuard = runner.createEvalCostGuard({ capUsd, perTurnUsd: estimate.maxSequenceUsd });
  const controller = new AbortController();
  let pauseRequested = false;
  process.on("SIGINT", () => {
    if (pauseRequested) process.exit(130);
    pauseRequested = true;
    log("\n⏸ Arrêt demandé : fin de la séquence en cours (Ctrl-C encore pour forcer).");
  });
  const deps = live.createLiveSequenceDeps(judgeModel, {
    signal: controller.signal,
    hooks: { onRateLimited: ({ attempt, waitMs }) => log(`  ⏳ Limite de débit (429), tentative ${attempt} : attente ${Math.round(waitMs / 1000)} s puis rejeu`) },
  });

  const results: import("@/services/evalJudgeSequence").SequenceRunResult[] = [];
  const sequenceStarts: Array<{ key: string; at: Date }> = [];
  let outcome = "terminé";
  const total = sequences.length * configs.length * repeats;
  outer: for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
    for (const sequence of sequences) {
      for (const config of configs) {
        if (pauseRequested) { outcome = "arrêté à la demande"; break outer; }
        const actual = await readActualCostUsd(startedAt).catch(() => null);
        if (actual) costGuard.observeActual(actual.usd);
        if (costGuard.wouldExceed()) { outcome = "arrêté au plafond de coût"; break outer; }
        const key = reportModule.sequenceRunCostKey({ configLabel: config.label, sequenceId: sequence.id, repeatIndex });
        sequenceStarts.push({ key, at: new Date() });
        log(`  [${results.length + 1}/${total}] ${sequence.id} · ${config.factor === "baseline" ? "référence" : "candidat"} · passage ${repeatIndex}`);
        const result = await sequenceModule.runEvalSequence({
          sequence,
          config,
          repeatIndex,
          deps,
          turnWeights: weights,
          signal: controller.signal,
          onTurn: (turn) => log(`     tour ${turn.turnIndex} · ${turn.score === null ? "—" : turn.score.toFixed(2)}/10 · GM ${turn.gmStatus}${turn.gmGuidanceIn ? " · conseil reçu" : ""}${turn.error ? ` · ⚠ ${turn.error}` : ""}`),
        });
        log(`     séquence ${result.sequenceScore === null ? "—" : result.sequenceScore.toFixed(2)}/10 · tours ${result.turnMean === null ? "—" : result.turnMean.toFixed(2)}/10`);
        results.push(result);
        costGuard.recordTurn();
      }
    }
  }

  // OpenRouter prices arrive asynchronously: wait for them before reading the measured cost.
  let actual = await readActualCostUsd(startedAt).catch(() => null);
  if (actual?.pendingCalls) log(`• Attente des prix OpenRouter (${actual.pendingCalls} appels)…`);
  for (let waited = 0; actual && actual.pendingCalls > 0 && waited < 150_000; waited += 10_000) {
    await sleep(10_000);
    actual = await readActualCostUsd(startedAt).catch(() => actual);
  }
  // Cost per played sequence: llm_usage window between its start and the next start.
  const costBySequenceRun: Record<string, number> = {};
  const { data: usageRows } = await supabase
    .from("llm_usage")
    .select("cost_usd,created_at")
    .gte("created_at", startedAt.toISOString())
    .in("feature_key", [...EVAL_COST_FEATURE_KEYS])
    .is("session_id", null);
  for (let index = 0; index < sequenceStarts.length; index += 1) {
    const from = sequenceStarts[index].at.getTime();
    const to = sequenceStarts[index + 1]?.at.getTime() ?? Number.POSITIVE_INFINITY;
    costBySequenceRun[sequenceStarts[index].key] = Number((usageRows ?? [])
      .filter((row) => { const at = new Date(row.created_at).getTime(); return at >= from && at < to; })
      .reduce((sum, row) => sum + (Number(row.cost_usd) || 0), 0).toFixed(4));
  }

  const comparison = sequenceModule.compareSequenceRuns(results, sequences);
  const markdown = reportModule.formatSequenceReportMarkdown({
    runId,
    environment: resolved.environment,
    corpusFile: path.relative(process.cwd(), corpusPath),
    corpusStatus: corpus.status,
    judgeModel,
    repeats,
    configs,
    comparison,
    results,
    estimate,
    capUsd,
    committedUsd: costGuard.spentUsd(),
    actual,
    costBySequenceRun,
    outcome,
    durationMs: Date.now() - startedMs,
    blockedSettingsWrites: settingsGuard.blocked.length,
    generatedAt: new Date().toISOString(),
  });

  const outDir = path.resolve(process.cwd(), options.outDir!);
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `eval-judge-sequences-${runId}`);
  writeFileSync(`${base}.md`, markdown, "utf8");
  writeFileSync(`${base}.json`, `${JSON.stringify({ runId, environment: resolved.environment, configs, repeats, judgeModel, results, comparison, costBySequenceRun, actual }, null, 2)}\n`, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  process.stdout.write(markdown);
  log(`✓ Rapport : ${path.relative(process.cwd(), base)}.md (+ .json)`);
  if (settingsGuard.blocked.length) log(`⚠ ${settingsGuard.blocked.length} écriture(s) admin_settings refusée(s).`);

  await supabase.auth.signOut({ scope: "local" });
  if (outcome === "arrêté au plafond de coût") process.exit(2);
  if (outcome === "arrêté à la demande") process.exit(3);
}

main().then(
  () => process.exit(0),
  (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)),
);
