/**
 * LLM judge without a browser — reference vs candidate on a sandbox.
 *
 *   npm run eval:judge -- --candidate rich_v2 [--reference optimized_v3] [--character all] [--repeats 3]
 *
 * Runs through vite-node (same aliases and `import.meta.env` as the app) and
 * reuses the admin modules: same corpus selection, same configurations, same
 * isolated turn, same judge, same `eval_runs` / `eval_results` rows. Signs in
 * with the Lovable Cloud admin path (Supabase Auth e-mail + password, checked
 * against `admin_users`); credentials come from the process environment only.
 * Settings are hydrated read-only and every write to `admin_settings` is
 * refused at the fetch level. See docs/plan_llm_as_judge.md, "Lot J2".
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createMemoryStorage, guardAdminSettingsWrites } from "@/services/evalJudgeNodeRuntime";

// ---------------------------------------------------------------- bootstrap
// Must run before any app module creates the Supabase client.
const storage = createMemoryStorage();
Object.assign(globalThis, { localStorage: storage, sessionStorage: createMemoryStorage() });
const settingsGuard = guardAdminSettingsWrites(globalThis.fetch.bind(globalThis));
// App diagnostics go to stderr: stdout carries the Markdown report only.
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
  const {
    DEFAULT_EVAL_COST_CAP_USD,
    EVAL_COST_FEATURE_KEYS,
    HEADLESS_EVAL_USAGE,
    checkCostCap,
    parseHeadlessEvalArgs,
    perTurnCostUsd,
    resolveHeadlessEnvironment,
    sumUsageCost,
  } = await import("@/services/evalJudgeHeadless");
  const { options, errors } = parseHeadlessEvalArgs(process.argv.slice(2));
  if (process.argv.includes("--help")) {
    log(HEADLESS_EVAL_USAGE);
    return;
  }
  if (errors.length) fail(`${errors.join("\n  ")}\n\n${HEADLESS_EVAL_USAGE}`);

  // Credentials file: this checkout first, then the canonical checkout when run from a worktree.
  loadLocalEnvFile(path.resolve(process.cwd(), ".env.eval.local"));
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    loadLocalEnvFile(path.resolve(commonDir, "..", ".env.eval.local"));
  } catch {
    // Not a git checkout (CI tarball): environment variables only.
  }
  const email = process.env.AVA_EVAL_EMAIL?.trim();
  const password = process.env.AVA_EVAL_PASSWORD;
  if (!email || !password) fail("AVA_EVAL_EMAIL et AVA_EVAL_PASSWORD manquent (environnement ou .env.eval.local).");

  const [{ supabase }, env, settings, pipeline, scoring, store, runner] = await Promise.all([
    import("@/integrations/supabase/client"),
    import("@/services/environmentContext"),
    import("@/services/settingsService"),
    import("@/services/evalJudgePipeline"),
    import("@/services/evalJudgeScoring"),
    import("@/services/evalJudgeStore"),
    import("@/services/evalJudgeRunner"),
  ]);
  const { formatEvalReportMarkdown } = await import("@/services/evalJudgeReport");

  // ------------------------------------------------------------- session
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

  // -------------------------------------------------------------- corpus
  const allItems = await store.fetchEvalItems();
  let resumedRun: Awaited<ReturnType<typeof store.createEvalRun>> | null = null;
  let configs: import("@/services/evalJudgePipeline").EvalTurnConfig[];
  let characterFilter = options.character!;
  let repeats = options.repeats!;
  let judgeModel = options.judgeModel!;
  let existing: Awaited<ReturnType<typeof store.fetchEvalResults>> = [];

  if (options.resumeRunId) {
    const { data, error } = await supabase.from("eval_runs").select("*").eq("id", options.resumeRunId).maybeSingle();
    if (error || !data) fail(`Run introuvable : ${options.resumeRunId}`);
    resumedRun = data;
    const stored = data.ofat_config as { configs?: typeof configs; characterFilter?: typeof characterFilter } | null;
    if (!stored?.configs?.length) fail("Ce run ne contient pas ses configurations : reprise impossible.");
    configs = stored.configs;
    characterFilter = stored.characterFilter ?? "all";
    repeats = data.repeats;
    judgeModel = data.judge_model;
    existing = await store.fetchEvalResults(data.id);
  } else {
    const live = pipeline.snapshotLiveSettings();
    const compare = runner.buildCompareConfigs(
      live,
      { variant: options.reference ?? live.promptVariant, snapshotJson: options.referenceJson },
      { variant: options.candidate!, snapshotJson: options.candidateJson },
    );
    if (compare.errors.length) fail(`Instantané invalide : ${compare.errors.join(" ; ")}`);
    configs = compare.configs;
  }

  const items = runner.selectRunnableEvalItems(allItems, characterFilter);
  const audit = scoring.auditEvalCorpus(allItems.filter((item) => characterFilter === "all"
    || pipeline.evalCharacterKey(item.character_name) === characterFilter));
  if (!audit.readyToRun || items.length === 0) fail(`Corpus insuffisant : ${audit.blockers[0] ?? "aucune question active"}`);

  const fullEstimate = pipeline.estimateEvalRun(items.length, configs, repeats, judgeModel);
  const perTurn = perTurnCostUsd(fullEstimate);
  const remainingTurns = Math.max(0, fullEstimate.turns - existing.length);
  const remainingEstimate = { ...fullEstimate, turns: remainingTurns, estimatedCostUsd: Number((remainingTurns * perTurn).toFixed(4)) };
  const capUsd = options.maxCostUsd ?? DEFAULT_EVAL_COST_CAP_USD;
  const alreadySpent = existing.length * perTurn;

  log(`• ${items.length} questions (${characterFilter}) × ${configs.length} configurations × ${repeats} passages = ${fullEstimate.turns} tours`);
  for (const config of configs) log(`  - ${config.label} · ${config.model} · T=${config.temperature} · ${config.maxTokens} tokens`);
  log(`• Juge ${judgeModel} · estimation ${remainingEstimate.estimatedCostUsd.toFixed(2)} $ pour ${remainingTurns} tours restants · plafond ${capUsd.toFixed(2)} $`);
  const capError = checkCostCap(remainingEstimate, capUsd, alreadySpent);
  if (capError) fail(capError, 2);
  if (options.dryRun) {
    log("✓ --dry-run : aucun run créé.");
    await supabase.auth.signOut({ scope: "local" });
    return;
  }

  const run = resumedRun ?? await store.createEvalRun({
    baseline: { ...pipeline.snapshotLiveSettings(), scoreWeights: weights } as ReturnType<typeof pipeline.snapshotLiveSettings>,
    configs,
    mode: "compare",
    characterFilter,
    judgeModel,
    repeats,
    estimatedTurns: fullEstimate.turns,
    estimatedCostUsd: fullEstimate.estimatedCostUsd,
  });
  log(`• Run ${run.id}`);

  // ----------------------------------------------------------------- run
  const startedAt = new Date();
  const startedMs = Date.now();
  const readActualCostUsd = async () => {
    const { data, error } = await supabase
      .from("llm_usage")
      .select("cost_usd,status")
      .gte("created_at", startedAt.toISOString())
      .in("feature_key", [...EVAL_COST_FEATURE_KEYS])
      .is("session_id", null);
    if (error) throw new Error(error.message);
    return sumUsageCost(data ?? []);
  };
  const costGuard = runner.createEvalCostGuard({ capUsd, perTurnUsd: perTurn, alreadySpentUsd: alreadySpent });
  let pauseRequested = false;
  process.on("SIGINT", () => {
    if (pauseRequested) process.exit(130);
    pauseRequested = true;
    log("\n⏸ Pause demandée : fin du tour en cours puis arrêt (Ctrl-C encore pour forcer).");
  });

  const outcome = await runner.executeEvalRun({
    run,
    configs,
    items,
    existing,
    deps: {
      runTurn: (item, config, signal) => pipeline.runIsolatedEvalTurn(item, config, { signal }),
      judge: (item, maxResponse, model, signal, canonReference) => pipeline.judgeIsolatedEvalTurn(item, maxResponse, model, { signal, canonReference }),
      saveResult: store.insertEvalResult,
      patchRun: store.patchEvalRun,
    },
    hooks: {
      shouldPause: () => pauseRequested,
      costGuard,
      readActualCostUsd: async () => (await readActualCostUsd()).usd,
      onProgress: ({ label, completed, total }) => log(`  [${completed + 1}/${total}] ${label}`),
    },
  });

  // OpenRouter prices arrive asynchronously (retries at 15, 30 and 60 s) from
  // this very process: wait for them before reading the measured cost.
  let actual = await readActualCostUsd().catch(() => null);
  if (actual?.pendingCalls) log(`• Attente des prix OpenRouter (${actual.pendingCalls} appels)…`);
  for (let waited = 0; actual && actual.pendingCalls > 0 && waited < 150_000; waited += 10_000) {
    await sleep(10_000);
    actual = await readActualCostUsd().catch(() => actual);
  }

  const results = await store.fetchEvalResults(run.id);
  const { data: finalRun } = await supabase.from("eval_runs").select("*").eq("id", run.id).maybeSingle();
  const comparison = scoring.compareReferenceCandidate({ results, items: allItems, weights });
  const outcomeLabel = outcome.status === "cost_capped" ? "arrêté au plafond de coût" : outcome.status;
  const markdown = formatEvalReportMarkdown({
    run: finalRun ?? run,
    environment: resolved.environment,
    configs,
    itemCount: items.length,
    characterFilter,
    comparison,
    estimate: fullEstimate,
    capUsd,
    committedUsd: costGuard.spentUsd(),
    actual,
    outcome: outcomeLabel,
    completedTurns: outcome.completed,
    errorTurns: results.filter((row) => row.error_message).length,
    durationMs: Date.now() - startedMs,
    blockedSettingsWrites: settingsGuard.blocked.length,
    generatedAt: new Date().toISOString(),
  });

  const outDir = path.resolve(process.cwd(), options.outDir!);
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `eval-judge-${run.id}.md`);
  writeFileSync(file, markdown, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  process.stdout.write(markdown);
  log(`✓ Rapport : ${path.relative(process.cwd(), file)}`);
  if (settingsGuard.blocked.length) log(`⚠ ${settingsGuard.blocked.length} écriture(s) admin_settings refusée(s).`);

  await supabase.auth.signOut({ scope: "local" });
  if (outcome.status === "failed") fail(`Run en échec : ${outcome.error}`);
  if (outcome.status === "cost_capped") process.exit(2);
  if (outcome.status === "paused") process.exit(3);
}

main().then(
  () => process.exit(0),
  (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)),
);
