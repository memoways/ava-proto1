import {
  buildReferenceCandidateConfigs,
  evalCharacterKey,
  isRateLimitError,
  listEvalWorkItems,
  parseSnapshotOverrides,
  resultWorkKey,
  type EvalItem,
  type EvalJudgeScore,
  type EvalLiveSnapshot,
  type EvalPromptVariant,
  type EvalResult,
  type EvalRun,
  type EvalTurnConfig,
  type IsolatedEvalTurnTrace,
} from "@/services/evalJudgePipeline";
import { auditEvalCorpus } from "@/services/evalJudgeScoring";

/**
 * Run loop shared by Admin › Qualité › LLM as judge and the headless script
 * (`scripts/eval-judge/run.ts`). Pure orchestration: every side effect is
 * injected, so the browser tab and Node run exactly the same sequence.
 */

export type EvalCharacterFilter = "all" | "max" | "emma";

export interface CompareSide {
  variant: EvalPromptVariant;
  /** Optional JSON snapshot overriding the live settings for this side only. */
  snapshotJson?: string;
}

/** Reference/candidate configurations, with snapshot errors prefixed by side. */
export function buildCompareConfigs(live: EvalLiveSnapshot, reference: CompareSide, candidate: CompareSide) {
  const ref = parseSnapshotOverrides(reference.snapshotJson ?? "");
  const cand = parseSnapshotOverrides(candidate.snapshotJson ?? "");
  return {
    configs: buildReferenceCandidateConfigs(
      live,
      { promptVariant: reference.variant, ...ref.overrides },
      { promptVariant: candidate.variant, ...cand.overrides },
    ),
    errors: [...ref.errors.map((error) => `référence : ${error}`), ...cand.errors.map((error) => `candidat : ${error}`)],
  };
}

/** Active, audit-usable items for the character filter (same rule as the admin launch). */
export function selectRunnableEvalItems(items: EvalItem[], filter: EvalCharacterFilter): EvalItem[] {
  const usable = new Set(
    auditEvalCorpus(items).issues.filter((issue) => issue.level !== "error").map((issue) => issue.itemId),
  );
  return items.filter((item) => item.active && usable.has(item.id)
    && (filter === "all" || evalCharacterKey(item.character_name) === filter));
}

// ---------------------------------------------------------------- cost cap

export interface EvalCostGuard {
  readonly capUsd: number | null;
  /** Cost committed so far: max(estimated per finished turn, last actual reading). */
  spentUsd(): number;
  /** True when starting one more turn could cross the cap. */
  wouldExceed(): boolean;
  recordTurn(): void;
  observeActual(actualUsd: number): void;
}

/**
 * Explicit spending cap. `perTurnUsd` is the calibrated estimate of one turn
 * (character + GM + judge); `observeActual` feeds the measured `llm_usage`
 * cost, which lags by a few seconds. The guard never lets a turn start when
 * the committed cost plus one turn would cross the cap.
 */
export function createEvalCostGuard(input: { capUsd: number | null; perTurnUsd: number; alreadySpentUsd?: number }): EvalCostGuard {
  const perTurn = Math.max(0, input.perTurnUsd);
  let estimated = Math.max(0, input.alreadySpentUsd ?? 0);
  let actual = 0;
  const cap = input.capUsd !== null && Number.isFinite(input.capUsd) && input.capUsd >= 0 ? input.capUsd : null;
  const spent = () => Math.max(estimated, actual);
  return {
    capUsd: cap,
    spentUsd: () => Number(spent().toFixed(4)),
    wouldExceed: () => cap !== null && spent() + perTurn > cap + 1e-9,
    recordTurn: () => { estimated += perTurn; },
    observeActual: (value: number) => {
      if (Number.isFinite(value) && value > actual) actual = value;
    },
  };
}

// ---------------------------------------------------------------- run loop

export interface EvalRunDeps {
  runTurn: (item: EvalItem, config: EvalTurnConfig, signal: AbortSignal) => Promise<IsolatedEvalTurnTrace>;
  judge: (item: EvalItem, maxResponse: string, judgeModel: string, signal: AbortSignal, canonReference?: string) => Promise<EvalJudgeScore>;
  saveResult: (input: {
    runId: string;
    item: EvalItem;
    config: EvalTurnConfig;
    repeatIndex: number;
    turn: IsolatedEvalTurnTrace;
    judge: EvalJudgeScore | null;
  }) => Promise<EvalResult>;
  patchRun: (id: string, patch: Partial<EvalRun>) => Promise<void>;
}

export interface EvalRunHooks {
  signal?: AbortSignal;
  /** Rate-limited calls (429) are replayed after a wait instead of failing the run. */
  rateLimitRetry?: { attempts: number; waitMs: number; sleep?: (ms: number, signal: AbortSignal) => Promise<void> };
  onRateLimited?: (info: { attempt: number; waitMs: number; error: string }) => void;
  /** Checked before each turn; true pauses the run cleanly. */
  shouldPause?: () => boolean;
  costGuard?: EvalCostGuard;
  /** Called every `actualCostEvery` finished turns to read the real cost. */
  readActualCostUsd?: () => Promise<number | null>;
  actualCostEvery?: number;
  onProgress?: (info: { label: string; completed: number; total: number }) => void;
  onResult?: (row: EvalResult, all: EvalResult[]) => void;
}

export type EvalRunOutcome =
  | { status: "done"; completed: number; results: EvalResult[] }
  | { status: "paused"; completed: number; results: EvalResult[] }
  | { status: "cost_capped"; completed: number; results: EvalResult[]; spentUsd: number }
  | { status: "failed"; completed: number; results: EvalResult[]; error: string };

export const EVAL_COST_CAP_MESSAGE = "Plafond de coût atteint";

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export const DEFAULT_RATE_LIMIT_RETRY = { attempts: 3, waitMs: 65_000 };

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = globalThis.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

/** proxy-llm allows 60 calls per minute per account: a 429 waits for the next window, then replays. */
export async function withRateLimitRetry<T>(call: () => Promise<T>, signal: AbortSignal, hooks: EvalRunHooks): Promise<T> {
  const { attempts, waitMs, sleep = abortableSleep }: NonNullable<EvalRunHooks["rateLimitRetry"]> = hooks.rateLimitRetry ?? DEFAULT_RATE_LIMIT_RETRY;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (!isRateLimitError(error) || attempt > attempts) throw error;
      hooks.onRateLimited?.({ attempt, waitMs, error: error instanceof Error ? error.message : String(error) });
      await sleep(waitMs, signal);
    }
  }
}

export async function executeEvalRun(input: {
  run: EvalRun;
  configs: EvalTurnConfig[];
  items: EvalItem[];
  existing: EvalResult[];
  deps: EvalRunDeps;
  hooks?: EvalRunHooks;
}): Promise<EvalRunOutcome> {
  const { run, configs, items, existing, deps } = input;
  const hooks = input.hooks ?? {};
  const signal = hooks.signal ?? new AbortController().signal;
  await deps.patchRun(run.id, { status: "running", started_at: run.started_at ?? new Date().toISOString() });
  const queue = listEvalWorkItems(configs, items, run.repeats, new Set(existing.map(resultWorkKey)));
  const total = existing.length + queue.length;
  const results = [...existing];
  let completed = existing.length;
  const every = Math.max(1, hooks.actualCostEvery ?? 10);

  const pause = async () => {
    await deps.patchRun(run.id, { status: "paused", current_index: completed });
    return { status: "paused" as const, completed, results };
  };

  try {
    for (const work of queue) {
      if (hooks.shouldPause?.()) return await pause();
      if (signal.aborted) return await pause();
      if (hooks.costGuard?.wouldExceed()) {
        const spentUsd = hooks.costGuard.spentUsd();
        await deps.patchRun(run.id, {
          status: "paused",
          current_index: completed,
          error_message: `${EVAL_COST_CAP_MESSAGE} : ${spentUsd.toFixed(2)} $ engagés, plafond ${hooks.costGuard.capUsd?.toFixed(2)} $`,
        });
        return { status: "cost_capped", completed, results, spentUsd };
      }
      hooks.onProgress?.({
        label: `${work.config.label} · ${work.item.question.slice(0, 60)} · passage ${work.repeatIndex}`,
        completed,
        total,
      });
      const turn = await withRateLimitRetry(() => deps.runTurn(work.item, work.config, signal), signal, hooks);
      const judge = turn.maxResponse
        ? await withRateLimitRetry(() => deps.judge(work.item, turn.maxResponse, run.judge_model, signal, turn.canonReference), signal, hooks)
        : null;
      const saved = await deps.saveResult({
        runId: run.id,
        item: work.item,
        config: work.config,
        repeatIndex: work.repeatIndex,
        turn,
        judge,
      });
      results.push(saved);
      completed += 1;
      hooks.costGuard?.recordTurn();
      hooks.onResult?.(saved, [...results]);
      await deps.patchRun(run.id, { current_index: completed, status: "running" });
      if (hooks.costGuard && hooks.readActualCostUsd && (completed - existing.length) % every === 0) {
        const actual = await hooks.readActualCostUsd().catch(() => null);
        if (actual !== null) hooks.costGuard.observeActual(actual);
      }
    }
    await deps.patchRun(run.id, {
      status: "done",
      current_index: completed,
      finished_at: new Date().toISOString(),
    });
    return { status: "done", completed, results };
  } catch (error) {
    if (hooks.shouldPause?.() || isAbort(error)) return await pause();
    const message = error instanceof Error ? error.message : String(error);
    await deps.patchRun(run.id, { status: "failed", error_message: message, current_index: completed });
    return { status: "failed", completed, results, error: message };
  }
}
