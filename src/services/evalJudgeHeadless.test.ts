import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/prd4Orchestrator", () => ({ processPRD4Turn: vi.fn() }));
vi.mock("@/services/experienceOrchestration", () => ({ getCharacterRuntimeReadiness: vi.fn() }));
vi.mock("@/services/characterIdentityGuard", () => ({ toCharacterExecutionContext: vi.fn() }));
vi.mock("@/services/characterPromptService", () => ({ loadCharacterPrompt: vi.fn() }));

import {
  DEFAULT_EVAL_COST_CAP_USD,
  checkCostCap,
  parseHeadlessEvalArgs,
  perTurnCostUsd,
  resolveHeadlessEnvironment,
  sumUsageCost,
} from "./evalJudgeHeadless";
import { createMemoryStorage, guardAdminSettingsWrites } from "./evalJudgeNodeRuntime";
import {
  buildCompareConfigs,
  createEvalCostGuard,
  executeEvalRun,
  selectRunnableEvalItems,
  type EvalRunDeps,
} from "./evalJudgeRunner";
import { formatEvalReportMarkdown } from "./evalJudgeReport";
import {
  EVAL_DEFAULT_JUDGE_MODEL,
  estimateEvalRun,
  type EvalItem,
  type EvalLiveSnapshot,
  type EvalResult,
  type EvalRun,
  type EvalTurnConfig,
} from "./evalJudgePipeline";
import { DEFAULT_SCORE_WEIGHTS, compareReferenceCandidate } from "./evalJudgeScoring";
import type { AdminUserProfile } from "./environmentContext";

const live: EvalLiveSnapshot = {
  model: "openai/gpt-5.6-luna",
  temperature: 1.4,
  topP: 0.95,
  maxTokens: 360,
  ragTopK: 4,
  ragRetrieveK: 8,
  ragRerank: true,
  ragThreshold: 0.3,
  ragRerankModel: "rerank-2.5-lite",
  ragRerankTruncation: true,
  promptVariant: "optimized_v3",
};

function item(id: string, character: string, overrides: Partial<EvalItem> = {}): EvalItem {
  return {
    id,
    notion_page_id: id,
    question: `Question ${id}`,
    gold_answer: "Réponse visée.",
    must_include: "un fait",
    must_not: "méta",
    tone: "retenu",
    max_length: 2,
    category: "emotion",
    active: true,
    character_name: character,
    sort_order: 1,
    judge_notes: "",
    synced_at: "2026-11-09T00:00:00Z",
    created_at: "2026-11-09T00:00:00Z",
    updated_at: "2026-11-09T00:00:00Z",
    ...overrides,
  };
}

const JUDGE = {
  gold_fidelity: 4,
  must_include: 3,
  must_not: 5,
  tone: 4,
  length_ok: true,
  character_voice: 3,
  overall: 7,
  rationale: "ok",
  raw: "{}",
  speech_quality: { sounds_spoken: 4, no_therapeutic_language: 4, non_caricatural: 4, facts_understandable: 4, hope_without_cure: 4 },
  not_meta: 3,
  lived_impact: 3,
  canon_timeline: 4,
  distinct_voice: 3,
};

function run(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    status: "queued",
    repeats: 2,
    judge_model: EVAL_DEFAULT_JUDGE_MODEL,
    started_at: null,
    error_message: null,
    ...overrides,
  } as unknown as EvalRun;
}

function profile(email: string, defaultEnv: AdminUserProfile["default_environment_id"]): AdminUserProfile {
  return { user_id: "u1", display_name: "Admin", default_environment_id: defaultEnv, email };
}

function fakeDeps(options: { failAt?: number } = {}) {
  const patches: Array<Partial<EvalRun>> = [];
  let turns = 0;
  const deps: EvalRunDeps = {
    runTurn: vi.fn(async (evalItem, config) => {
      turns += 1;
      if (options.failAt === turns) throw new Error("proxy-llm 502");
      return {
        maxResponse: `${config.promptVariant} répond à ${evalItem.id}`,
        ragMatches: null,
        gmBrief: null,
        validator: null,
        latencies: { rag_ms: 0, gm_ms: 0, max_ms: 0, validator_ms: 0, total_ms: 0 },
        tokens: {},
        canonReference: "canon",
      };
    }),
    judge: vi.fn(async (_item, _response, _model, _signal, canon) => ({ ...JUDGE, rationale: canon ?? "" })),
    saveResult: vi.fn(async (input) => ({
      id: `${input.config.label}-${input.item.id}-${input.repeatIndex}`,
      run_id: input.runId,
      item_id: input.item.id,
      config_label: input.config.label,
      factor: input.config.factor,
      repeat_index: input.repeatIndex,
      judge_json: input.judge,
      overall_score: input.judge?.overall ?? null,
      error_message: null,
    }) as unknown as EvalResult),
    patchRun: vi.fn(async (_id, patch) => { patches.push(patch); }),
  };
  return { deps, patches };
}

describe("headless judge — configuration", () => {
  it("reads the workflow inputs, empty values meaning defaults", () => {
    const { options, errors } = parseHeadlessEvalArgs([
      "--reference", "", "--candidate", "rich_v2", "--character", "emma", "--repeats", "2", "--max-cost-usd", "1,5", "--judge-model", "",
    ]);
    expect(errors).toEqual([]);
    expect(options).toMatchObject({
      candidate: "rich_v2",
      referenceGiven: false,
      character: "emma",
      repeats: 2,
      maxCostUsd: 1.5,
      judgeModel: EVAL_DEFAULT_JUDGE_MODEL,
      environment: "sandbox-ulrich",
      resumeRunId: null,
      dryRun: false,
    });
  });

  it("accepts --key=value, a resume id and --dry-run", () => {
    const { options, errors } = parseHeadlessEvalArgs([
      "--resume=690eaf20-4e1c-44b2-99f3-4ea23817a9d4", "--dry-run", "--env=sandbox-romed",
    ]);
    expect(errors).toEqual([]);
    expect(options).toMatchObject({ resumeRunId: "690eaf20-4e1c-44b2-99f3-4ea23817a9d4", dryRun: true, environment: "sandbox-romed" });
  });

  it("refuses prod, unknown variants, out-of-range repeats and a missing candidate", () => {
    expect(parseHeadlessEvalArgs(["--candidate", "rich_v2", "--env", "prod"]).errors)
      .toContain("le juge sans navigateur ne tourne jamais sur prod");
    expect(parseHeadlessEvalArgs(["--candidate", "v9"]).errors).toContain("variante candidate inconnue : v9");
    expect(parseHeadlessEvalArgs(["--candidate", "rich_v2", "--repeats", "9"]).errors[0]).toMatch(/--repeats/);
    expect(parseHeadlessEvalArgs(["--candidate", "rich_v2", "--max-cost-usd", "0"]).errors[0]).toMatch(/--max-cost-usd/);
    expect(parseHeadlessEvalArgs([]).errors).toContain("--candidate est obligatoire (ou --resume RUN_ID)");
    expect(parseHeadlessEvalArgs(["--candidate", "--dry-run"]).errors).toContain("--candidate attend une valeur");
    expect(parseHeadlessEvalArgs(["--candidate", "rich_v2", "--surprise", "1"]).errors).toContain("option inconnue : --surprise");
  });

  it("keeps the admin environment rule: only the switch account chooses, prod never", () => {
    expect(resolveHeadlessEnvironment(profile("ulrich.fischer@memoways.com", "prod"), "sandbox-ulrich"))
      .toEqual({ environment: "sandbox-ulrich", note: null, error: null });
    const other = resolveHeadlessEnvironment(profile("eval@memoways.com", "sandbox-ulrich"), "sandbox-romed");
    expect(other.environment).toBe("sandbox-ulrich");
    expect(other.note).toMatch(/ne peut pas changer/);
    expect(resolveHeadlessEnvironment(profile("eval@memoways.com", "prod"), "sandbox-ulrich").error).toMatch(/sandbox/);
  });

  it("builds the same reference/candidate pair as the admin, snapshot errors blocking", () => {
    const { configs, errors } = buildCompareConfigs(live, { variant: "optimized_v3" }, { variant: "rich_v2", snapshotJson: "{\"temperature\":0.7}" });
    expect(errors).toEqual([]);
    expect(configs.map((config) => config.factor)).toEqual(["baseline", "candidate"]);
    expect(configs[0].promptVariant).toBe("optimized_v3");
    expect(configs[1]).toMatchObject({ promptVariant: "rich_v2", temperature: 0.7 });
    expect(buildCompareConfigs(live, { variant: "optimized_v3", snapshotJson: "{" }, { variant: "rich_v2" }).errors)
      .toEqual(["référence : JSON illisible"]);
  });

  it("selects active, usable items for the character filter", () => {
    const items = [
      item("m1", "Max"),
      item("m2", "Max", { active: false }),
      item("e1", "Emma"),
      item("x1", "Max", { question: "" }),
    ];
    expect(selectRunnableEvalItems(items, "all").map((row) => row.id)).toEqual(["m1", "e1"]);
    expect(selectRunnableEvalItems(items, "emma").map((row) => row.id)).toEqual(["e1"]);
  });
});

describe("headless judge — cost cap", () => {
  const configs = buildCompareConfigs(live, { variant: "optimized_v3" }, { variant: "rich_v2" }).configs;

  it("refuses to start a run whose estimate crosses the cap", () => {
    const estimate = estimateEvalRun(21, configs, 3, EVAL_DEFAULT_JUDGE_MODEL);
    expect(estimate.turns).toBe(126);
    expect(checkCostCap(estimate, DEFAULT_EVAL_COST_CAP_USD)).toBeNull();
    expect(checkCostCap(estimate, 0.5)).toMatch(/au-delà du plafond 0\.50 \$/);
    expect(perTurnCostUsd(estimate)).toBeCloseTo(estimate.estimatedCostUsd / 126, 6);
    expect(perTurnCostUsd({ ...estimate, turns: 0 })).toBe(0);
  });

  it("commits max(estimated, measured) and refuses the turn that would cross", () => {
    const guard = createEvalCostGuard({ capUsd: 1, perTurnUsd: 0.3 });
    expect(guard.wouldExceed()).toBe(false);
    guard.recordTurn();
    guard.recordTurn();
    expect(guard.spentUsd()).toBeCloseTo(0.6, 6);
    expect(guard.wouldExceed()).toBe(false);
    guard.observeActual(0.75);
    expect(guard.spentUsd()).toBeCloseTo(0.75, 6);
    expect(guard.wouldExceed()).toBe(true);
    expect(createEvalCostGuard({ capUsd: null, perTurnUsd: 5 }).wouldExceed()).toBe(false);
  });

  it("stops the shared loop cleanly at the cap and leaves the run resumable", async () => {
    const { deps, patches } = fakeDeps();
    const items = [item("m1", "Max"), item("e1", "Emma")];
    const outcome = await executeEvalRun({
      run: run(),
      configs,
      items,
      existing: [],
      deps,
      hooks: { costGuard: createEvalCostGuard({ capUsd: 0.1, perTurnUsd: 0.03 }) },
    });
    expect(outcome.status).toBe("cost_capped");
    expect(outcome.completed).toBe(3);
    expect(deps.runTurn).toHaveBeenCalledTimes(3);
    const last = patches.at(-1)!;
    expect(last.status).toBe("paused");
    expect(last.current_index).toBe(3);
    expect(last.error_message).toMatch(/Plafond de coût atteint : 0\.09 \$ engagés, plafond 0\.10 \$/);
  });

  it("feeds the measured cost into the guard every N turns", async () => {
    const { deps } = fakeDeps();
    const guard = createEvalCostGuard({ capUsd: 1, perTurnUsd: 0.01 });
    const readActual = vi.fn(async () => 0.995);
    const outcome = await executeEvalRun({
      run: run({ repeats: 1 }),
      configs,
      items: [item("m1", "Max"), item("e1", "Emma")],
      existing: [],
      deps,
      hooks: { costGuard: guard, readActualCostUsd: readActual, actualCostEvery: 2 },
    });
    expect(readActual).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("cost_capped");
    expect(outcome.completed).toBe(2);
  });

  it("sums measured costs; a zero cost is pending until its lookup gives up", () => {
    expect(sumUsageCost([
      { cost_usd: 0.0136, status: "completed" },
      { cost_usd: "0.0026", status: "completed" },
      { cost_usd: 0, status: "success" },
      { cost_usd: null },
      { cost_usd: 0, status: "cost_fetch_failed" },
    ])).toEqual({ usd: 0.0162, pricedCalls: 2, pendingCalls: 2, failedCalls: 1 });
  });
});

describe("headless judge — shared run loop", () => {
  const configs: EvalTurnConfig[] = buildCompareConfigs(live, { variant: "optimized_v3" }, { variant: "rich_v2" }).configs;

  it("replays every config × item × repeat, judges with the canon and finishes the run", async () => {
    const { deps, patches } = fakeDeps();
    const onProgress = vi.fn();
    const outcome = await executeEvalRun({
      run: run(),
      configs,
      items: [item("m1", "Max")],
      existing: [],
      deps,
      hooks: { onProgress },
    });
    expect(outcome.status).toBe("done");
    expect(outcome.completed).toBe(4);
    expect(deps.judge).toHaveBeenCalledWith(expect.anything(), "optimized_v3 répond à m1", EVAL_DEFAULT_JUDGE_MODEL, expect.anything(), "canon");
    expect(patches[0]).toMatchObject({ status: "running" });
    expect(patches.at(-1)).toMatchObject({ status: "done", current_index: 4 });
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 3, total: 4 }));
  });

  it("skips work already saved when resuming", async () => {
    const { deps } = fakeDeps();
    const existing = [{ config_label: configs[0].label, item_id: "m1", repeat_index: 1 } as EvalResult];
    const outcome = await executeEvalRun({ run: run(), configs, items: [item("m1", "Max")], existing, deps });
    expect(deps.runTurn).toHaveBeenCalledTimes(3);
    expect(outcome.completed).toBe(4);
  });

  it("pauses on request and records a failure with its message", async () => {
    const paused = fakeDeps();
    let calls = 0;
    const pausedOutcome = await executeEvalRun({
      run: run(),
      configs,
      items: [item("m1", "Max")],
      existing: [],
      deps: paused.deps,
      hooks: { shouldPause: () => ++calls > 1 },
    });
    expect(pausedOutcome).toMatchObject({ status: "paused", completed: 1 });
    expect(paused.patches.at(-1)).toMatchObject({ status: "paused", current_index: 1 });

    const failing = fakeDeps({ failAt: 2 });
    const failed = await executeEvalRun({ run: run(), configs, items: [item("m1", "Max")], existing: [], deps: failing.deps });
    expect(failed).toMatchObject({ status: "failed", completed: 1, error: "proxy-llm 502" });
    expect(failing.patches.at(-1)).toMatchObject({ status: "failed", error_message: "proxy-llm 502" });
  });
});

describe("headless judge — admin_settings stays read-only", () => {
  it("refuses REST writes to admin_settings and lets reads and other tables through", async () => {
    const base = vi.fn(async () => new Response("[]", { status: 200 }));
    const { fetch: guarded, blocked } = guardAdminSettingsWrites(base as unknown as typeof fetch);
    const url = "https://x.supabase.co/rest/v1/admin_settings?on_conflict=key,environment_id";
    const write = await guarded(url, { method: "POST", body: "{}" });
    expect(write.status).toBe(403);
    await guarded(new Request("https://x.supabase.co/rest/v1/admin_settings?key=eq.a", { method: "DELETE" }));
    await guarded("https://x.supabase.co/rest/v1/admin_settings?select=*");
    await guarded("https://x.supabase.co/rest/v1/eval_results", { method: "POST" });
    expect(blocked).toEqual([
      { method: "POST", path: "/rest/v1/admin_settings" },
      { method: "DELETE", path: "/rest/v1/admin_settings" },
    ]);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("keeps settings and the session in memory only", () => {
    const storage = createMemoryStorage();
    storage.setItem("a", "1");
    expect(storage.getItem("a")).toBe("1");
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe("a");
    storage.removeItem("a");
    expect(storage.getItem("a")).toBeNull();
  });
});

describe("headless judge — Markdown report", () => {
  it("gives the verdict, Δ per criterion, character and question, and the costs", () => {
    const configs = buildCompareConfigs(live, { variant: "optimized_v3" }, { variant: "rich_v2" }).configs;
    const items = [item("m1", "Max", { question: "Et Peter ? | piège" }), item("e1", "Emma")];
    const row = (id: string, factor: string, label: string, itemId: string, judge: Record<string, unknown>) => ({
      id, run_id: "r", item_id: itemId, config_label: label, factor, repeat_index: 1, judge_json: judge, error_message: null,
    }) as unknown as EvalResult;
    const results = [
      row("1", "baseline", configs[0].label, "m1", JUDGE),
      row("2", "candidate", configs[1].label, "m1", { ...JUDGE, canon_timeline: 1, must_not: 2 }),
      row("3", "baseline", configs[0].label, "e1", JUDGE),
      row("4", "candidate", configs[1].label, "e1", JUDGE),
    ];
    const comparison = compareReferenceCandidate({ results, items, weights: DEFAULT_SCORE_WEIGHTS });
    const estimate = estimateEvalRun(2, configs, 1, EVAL_DEFAULT_JUDGE_MODEL);
    const markdown = formatEvalReportMarkdown({
      run: { id: "run-1", judge_model: EVAL_DEFAULT_JUDGE_MODEL, repeats: 1, status: "done", error_message: null },
      environment: "sandbox-ulrich",
      configs,
      itemCount: 2,
      characterFilter: "all",
      comparison,
      estimate,
      capUsd: 3,
      committedUsd: 0.08,
      actual: { usd: 0.07, pricedCalls: 11, pendingCalls: 1, failedCalls: 2 },
      outcome: "done",
      completedTurns: 4,
      errorTurns: 0,
      durationMs: 65_000,
      blockedSettingsWrites: 1,
      generatedAt: "2026-11-09T18:00:00.000Z",
    });
    expect(markdown).toContain("# LLM juge — référence contre candidat");
    expect(markdown).toContain("environnement `sandbox-ulrich`");
    expect(markdown).toContain("Le candidat joue moins bien");
    expect(markdown).toMatch(/\| Canon et timeline \(`canon_timeline`\) \| 4\.00 \| 2\.50 \| -1\.50 \|/);
    expect(markdown).toContain("| Et Peter ? \\| piège | Max |");
    expect(markdown).toContain("canon_timeline -3.0");
    expect(markdown).toContain("0.07 $ mesurés (`llm_usage`, 11 appels chiffrés, 1 encore sans prix, 2 sans prix disponible)");
    expect(markdown).toContain("plafond 3.00 $");
    expect(markdown).toContain("durée 1 min 05 s");
    expect(markdown).toContain("1 écriture(s) vers `admin_settings` refusée(s)");
    expect(markdown).toContain("Un seul passage par question : le bruit n'est pas mesuré");
  });

  it("says so when no candidate result exists", () => {
    const markdown = formatEvalReportMarkdown({
      run: { id: "run-2", judge_model: "j", repeats: 1, status: "paused", error_message: "Plafond de coût atteint : 0.10 $ engagés, plafond 0.10 $" },
      environment: "sandbox-ulrich",
      configs: [],
      itemCount: 0,
      characterFilter: "max",
      comparison: null,
      estimate: { configs: 0, items: 0, repeats: 1, turns: 0, llmCalls: 0, estimatedCostUsd: 0 },
      capUsd: 0.1,
      committedUsd: 0.1,
      actual: null,
      outcome: "arrêté au plafond de coût",
      completedTurns: 0,
      errorTurns: 0,
      durationMs: 0,
      blockedSettingsWrites: 0,
      generatedAt: "2026-11-09T18:00:00.000Z",
    });
    expect(markdown).toContain("Arrêt : Plafond de coût atteint");
    expect(markdown).toContain("Pas de comparaison");
    expect(markdown).toContain("coût réel non lu");
  });
});
