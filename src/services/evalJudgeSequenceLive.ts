/**
 * Live dependencies of the J3 sequence replay: the real turn chain
 * (`processPRD4Turn`, same as a played turn and as the J1/J2 isolated replay),
 * the J1 judge with the previous exchanges, and the sequence judge.
 * No session is created: `sessionId` stays null, the memory travels in memory.
 */
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { processPRD4Turn } from "@/services/prd4Orchestrator";
import {
  EVAL_FEATURE_KEY,
  EvalRateLimitError,
  buildEvalTurnOverrides,
  buildJudgeCanonReference,
  isRateLimitError,
  judgeIsolatedEvalTurn,
  resolveEvalCharacterContext,
  type EvalTurnConfig,
} from "@/services/evalJudgePipeline";
import {
  buildSequenceJudgePrompt,
  parseSequenceJudgeResponse,
  type SequenceRunDeps,
  type SequenceTurnRequest,
  type SequenceTurnTrace,
} from "@/services/evalJudgeSequence";
import { withRateLimitRetry, type EvalRunHooks } from "@/services/evalJudgeRunner";
import type { PRD4PostTurnEvaluation } from "@/types";

/** Sequence judge output budget: the rationale cites the turns, 600 tokens were not enough. */
export const SEQUENCE_JUDGE_MAX_TOKENS = 1_500;
export const SEQUENCE_JUDGE_ATTEMPTS = 2;

/** Harness-only bound on the post-turn (GM + memory) before the next turn. */
export const SEQUENCE_GM_WAIT_MS = 60_000;

function boundedPostTurn(promise: Promise<PRD4PostTurnEvaluation>, ms: number): Promise<PRD4PostTurnEvaluation | null> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => { globalThis.clearTimeout(timer); resolve(value); },
      () => { globalThis.clearTimeout(timer); resolve(null); },
    );
  });
}

export async function runSequenceEvalTurn(
  config: EvalTurnConfig,
  request: SequenceTurnRequest,
  signal?: AbortSignal,
): Promise<SequenceTurnTrace> {
  const started = performance.now();
  const { characterKey, characterContext } = await resolveEvalCharacterContext(request.sequence.character);
  const turn = await processPRD4Turn({
    sessionId: null,
    conversationHistory: request.history,
    userMessage: request.userMessage,
    userRole: null,
    hasSeenFilm: request.hasSeenFilm,
    timeElapsedSeconds: request.timeElapsedSeconds,
    characterContext,
    signal,
    turnIndex: request.turnIndex,
    gmGuidance: request.gmGuidance,
    gmTopicsCovered: request.gmTopicsCovered,
    gmSpeechState: request.gmSpeechState,
    evaluationOverrides: {
      ...buildEvalTurnOverrides(config, characterKey),
      conversationMemory: request.memory,
    },
  });
  if (turn.characterError && isRateLimitError(turn.characterError)) {
    // A rate-limited fallback line is never judged nor kept in the history: the turn is replayed.
    throw new EvalRateLimitError(turn.characterError);
  }
  const gm = await boundedPostTurn(turn.postTurnPromise, SEQUENCE_GM_WAIT_MS);
  const canonFields = await loadCharacterPrompt(characterContext.characterId).catch(() => null);
  const errors = [
    turn.characterError ? `Personnage en repli : ${turn.characterError}` : null,
    !gm ? `GM sans état terminal en ${SEQUENCE_GM_WAIT_MS / 1000} s` : gm.execution_status && gm.execution_status !== "executed" ? `GM ${gm.execution_status}` : null,
  ].filter(Boolean);
  return {
    response: turn.maxResponse,
    gm,
    latencyMs: Math.round(performance.now() - started),
    error: errors.length ? errors.join(" · ") : undefined,
    canonReference: buildJudgeCanonReference(canonFields),
  };
}

/**
 * Live dependencies. Each call is replayed after a wait on a 429 (proxy-llm:
 * 60 calls per minute per account), as in the J2 runner.
 */
export function createLiveSequenceDeps(
  judgeModel: string,
  retry: { signal: AbortSignal; hooks?: Pick<EvalRunHooks, "rateLimitRetry" | "onRateLimited"> },
): SequenceRunDeps {
  const hooks: EvalRunHooks = retry.hooks ?? {};
  const withRetry = <T>(call: () => Promise<T>) => withRateLimitRetry(call, retry.signal, hooks);
  return {
    runTurn: (config, request, signal) => withRetry(() => runSequenceEvalTurn(config, request, signal)),
    judgeTurn: (item, response, context, signal) => withRetry(() => judgeIsolatedEvalTurn(item, response, judgeModel, {
      signal,
      canonReference: context.canonReference,
      priorExchanges: context.priorExchanges,
    })),
    judgeSequence: (sequence, transcript, canonReference, signal) => withRetry(async () => {
      // An empty or unreadable answer is retried once; the stop reason is kept for the report.
      let last = { finish: "", tokens: 0 };
      for (let attempt = 1; attempt <= SEQUENCE_JUDGE_ATTEMPTS; attempt += 1) {
        const result = await callLLMWithUsage(
          [{ role: "system", content: buildSequenceJudgePrompt(sequence, transcript, canonReference) }],
          {
            model: judgeModel,
            temperature: 0,
            max_tokens: SEQUENCE_JUDGE_MAX_TOKENS,
            feature_key: EVAL_FEATURE_KEY,
            signal,
            timeoutMs: 60_000,
          },
        );
        const parsed = parseSequenceJudgeResponse(result.content);
        if (Object.keys(parsed.criteria).length) return parsed;
        last = { finish: result.finishReason ?? "inconnue", tokens: result.usage?.completion_tokens ?? 0 };
      }
      return {
        criteria: {},
        overall: 0,
        rationale: `JSON juge illisible après ${SEQUENCE_JUDGE_ATTEMPTS} essais (fin : ${last.finish}, ${last.tokens} tokens produits)`,
        raw: "",
      };
    }),
  };
}
