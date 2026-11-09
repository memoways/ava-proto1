import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEQUENCE_WEIGHTS,
  SEQUENCE_SECONDS_PER_TURN,
  advanceSequenceState,
  buildSequenceJudgePrompt,
  describeGmIssue,
  compareSequenceRuns,
  estimateSequenceRun,
  formatPriorExchanges,
  initialSequenceState,
  parseSequenceCorpus,
  parseSequenceJudgeResponse,
  runEvalSequence,
  sequenceScore,
  sequenceTurnAsEvalItem,
  type EvalSequence,
  type SequenceRunDeps,
  type SequenceRunResult,
  type SequenceTurnRequest,
} from "./evalJudgeSequence";
import { buildJudgePrompt, parseJudgeResponse, type EvalLiveSnapshot, type EvalTurnConfig } from "./evalJudgePipeline";
import { DEFAULT_SCORE_WEIGHTS } from "./evalJudgeScoring";
import { parseHeadlessSequenceArgs, DEFAULT_SEQUENCE_CORPUS } from "./evalJudgeSequenceHeadless";
import { formatSequenceReportMarkdown } from "./evalJudgeSequenceReport";
import type { PRD4PostTurnEvaluation } from "@/types";

const corpusFile = path.resolve(__dirname, "../../docs/eval/sequences_j3_v1.json");

function sequence(turns = 3, overrides: Partial<EvalSequence> = {}): EvalSequence {
  return {
    id: "max-T",
    character: "Max",
    characterKey: "max",
    filmSeen: true,
    register: "vous",
    title: "Max T",
    objective: "tester",
    conversationCriteria: ["chronologie stable"],
    gameMasterCriteria: "Aucune intervention.",
    turns: Array.from({ length: turns }, (_, index) => ({
      question: `Question ${index + 1} ?`,
      expectedResponse: `Réponse ${index + 1}`,
      requiredFacts: [`fait ${index + 1}`],
      acceptedAlternatives: [`alternative ${index + 1}`],
      forbiddenClaims: [`interdit ${index + 1}`],
      continuityCriteria: index ? `reprend le tour ${index}` : "",
      tone: "retenu",
      maxLength: 2,
    })),
    ...overrides,
  };
}

const live: EvalLiveSnapshot = {
  model: "openai/gpt-5.6-luna",
  temperature: 1.4,
  topP: 1,
  maxTokens: 360,
  ragTopK: 4,
  ragRetrieveK: 15,
  ragRerank: true,
  ragThreshold: 0.3,
  ragRerankModel: "rerank-2.5-lite",
  ragRerankTruncation: true,
  promptVariant: "optimized_v3",
};

const reference: EvalTurnConfig = { ...live, label: "référence (optimized_v3)", factor: "baseline" };
const candidate: EvalTurnConfig = { ...live, label: "candidat (optimized_v3 + streamContract=v1)", factor: "candidate", streamContract: "v1" };

function gm(turn: number, overrides: Partial<PRD4PostTurnEvaluation> = {}): PRD4PostTurnEvaluation {
  return {
    engagement_delta: 0,
    confusion_detected: false,
    role_usage_quality: "unknown",
    topics_covered: [`sujet ${turn}`],
    transition_recommended: false,
    cinematic_hint: null,
    next_turn_guidance: `conseil du tour ${turn}`,
    next_speech_state: `état ${turn}`,
    end_recommended: false,
    moderation_flag: false,
    notes: "",
    execution_status: "executed",
    memory_delta: { interlocutor: { name: "Claire" }, topics: [`thème ${turn}`] },
    ...overrides,
  };
}

const judgeJson = (overall: number, canon = 4) => JSON.stringify({
  gold_fidelity: 3, must_include: 4, must_not: 5, tone: 4, length_ok: true, character_voice: 4,
  speech_quality: { sounds_spoken: 4, no_therapeutic_language: 5, non_caricatural: 4, facts_understandable: 4, hope_without_cure: 4 },
  not_meta: 4, lived_impact: 3, canon_timeline: canon, distinct_voice: 4, overall, rationale: "ok",
});

function fakeDeps(options: { gmFor?: (turn: number) => PRD4PostTurnEvaluation | null; sequenceJson?: string } = {}) {
  const requests: SequenceTurnRequest[] = [];
  const judged: Array<{ itemId: string; prior: string }> = [];
  const transcripts: number[] = [];
  const deps: SequenceRunDeps = {
    runTurn: async (_config, request) => {
      requests.push(structuredClone(request));
      return {
        response: `Réponse de Max au tour ${request.turnIndex}`,
        gm: options.gmFor ? options.gmFor(request.turnIndex) : gm(request.turnIndex),
        latencyMs: 10,
        canonReference: "### Situation présente\nLausanne",
      };
    },
    judgeTurn: async (item, _response, context) => {
      judged.push({ itemId: item.id, prior: context.priorExchanges });
      return parseJudgeResponse(judgeJson(6));
    },
    judgeSequence: async (_sequence, transcript) => {
      transcripts.push(transcript.length);
      return parseSequenceJudgeResponse(options.sequenceJson ?? JSON.stringify({
        continuity: 4, thread_resumption: 3, rumination: 2, timeline_consistency: 5, relational_trajectory: 4, overall: 7, rationale: "stable",
      }));
    },
  };
  return { deps, requests, judged, transcripts };
}

describe("J3 sequence corpus", () => {
  it("reads the proposed corpus: four sequences of 4 or 5 turns, Max and Emma, film seen and not seen", () => {
    const corpus = parseSequenceCorpus(readFileSync(corpusFile, "utf8"));
    expect(corpus.errors).toEqual([]);
    expect(corpus.status).toBe("proposition");
    expect(corpus.sequences.map((entry) => `${entry.id}:${entry.turns.length}`)).toEqual(["max-A:5", "max-B:5", "emma-A:4", "emma-B:4"]);
    expect(new Set(corpus.sequences.map((entry) => entry.characterKey))).toEqual(new Set(["max", "emma"]));
    expect(corpus.sequences.map((entry) => entry.filmSeen)).toEqual([true, true, true, false]);
    expect(DEFAULT_SEQUENCE_CORPUS).toBe("docs/eval/sequences_j3_v1.json");
  });

  it("rejects a sequence outside 3 to 5 turns, an unknown character and a duplicate id", () => {
    const raw = JSON.stringify({
      conversations: [
        { id: "a", character: "Max", turns: [{ question: "q1" }, { question: "q2" }] },
        { id: "b", character: "Léo", turns: [{ question: "q1" }, { question: "q2" }, { question: "q3" }] },
        { id: "c", character: "Emma", turns: [{ question: "q1" }, { question: "q2" }, { question: "q3" }] },
        { id: "c", character: "Emma", turns: [{ question: "q1" }, { question: "q2" }, { question: "q3" }] },
      ],
    });
    const corpus = parseSequenceCorpus(raw);
    expect(corpus.sequences.map((entry) => entry.id)).toEqual(["c"]);
    expect(corpus.errors).toHaveLength(3);
    expect(parseSequenceCorpus("{").errors).toEqual(["JSON illisible"]);
  });

  it("maps a corpus turn onto the unchanged J1 judge fields", () => {
    const item = sequenceTurnAsEvalItem(sequence(), 1);
    expect(item.id).toBe("max-T#2");
    expect(item.must_include).toBe("fait 2");
    expect(item.must_not).toBe("interdit 2");
    expect(item.judge_notes).toContain("Alternatives acceptées : alternative 2.");
    expect(item.judge_notes).toContain("Continuité attendue : reprend le tour 1");
    expect(item.character_name).toBe("Max");
  });
});

describe("J3 replay state (history, memory, GM loop)", () => {
  it("appends the delivered exchange, keeps the GM guidance, dedupes topics and merges the memory delta", () => {
    let state = initialSequenceState();
    state = advanceSequenceState(state, { characterKey: "max", userMessage: "q1", response: "r1", turnIndex: 1, gm: gm(1, { topics_covered: ["Mona", "mona"] }), timestamp: 1 });
    expect(state.history.map((message) => `${message.role}:${message.content}`)).toEqual(["user:q1", "max:r1"]);
    expect(state.gmGuidance).toBe("conseil du tour 1");
    expect(state.gmSpeechState).toBe("état 1");
    expect(state.topicsCovered).toEqual(["Mona"]);
    expect(state.memory?.lastTurn).toBe(1);
    expect(state.memory?.interlocutor.name).toBe("Claire");
  });

  it("drops the guidance after a post-turn that did not execute, without touching the memory", () => {
    let state = advanceSequenceState(initialSequenceState(), { characterKey: "max", userMessage: "q1", response: "r1", turnIndex: 1, gm: gm(1), timestamp: 1 });
    state = advanceSequenceState(state, { characterKey: "max", userMessage: "q2", response: "r2", turnIndex: 2, gm: gm(2, { execution_status: "failed" }), timestamp: 2 });
    expect(state.gmGuidance).toBeNull();
    expect(state.gmSpeechState).toBeNull();
    expect(state.memory?.lastTurn).toBe(1);
    expect(state.history).toHaveLength(4);
  });
});

describe("J3 sequence replay", () => {
  it("feeds turn N+1 with the history, the memory and the GM guidance of turn N", async () => {
    const { deps, requests, judged, transcripts } = fakeDeps();
    const result = await runEvalSequence({ sequence: sequence(3), config: reference, repeatIndex: 1, deps, turnWeights: DEFAULT_SCORE_WEIGHTS, now: () => 1000 });
    expect(requests.map((request) => request.history.length)).toEqual([0, 2, 4]);
    expect(requests.map((request) => request.gmGuidance)).toEqual([null, "conseil du tour 1", "conseil du tour 2"]);
    expect(requests.map((request) => request.gmSpeechState)).toEqual([null, "état 1", "état 2"]);
    expect(requests.map((request) => request.memory?.lastTurn ?? 0)).toEqual([0, 1, 2]);
    expect(requests.map((request) => request.timeElapsedSeconds)).toEqual([0, SEQUENCE_SECONDS_PER_TURN, 2 * SEQUENCE_SECONDS_PER_TURN]);
    expect(requests.every((request) => request.hasSeenFilm === "vu")).toBe(true);
    expect(requests[2].gmTopicsCovered).toEqual(["sujet 1", "sujet 2"]);
    expect(judged[0].prior).toBe("");
    expect(judged[2].prior).toContain("Tour 1\nJoueur : Question 1 ?\nMax : Réponse de Max au tour 1");
    expect(transcripts).toEqual([3]);
    expect(result.guidanceTransmitted).toBe(2);
    expect(result.turns.map((turn) => turn.memoryLastTurnAfter)).toEqual([1, 2, 3]);
    expect(result.sequenceScore).toBe(sequenceScore(parseSequenceJudgeResponse(JSON.stringify({ continuity: 4, thread_resumption: 3, rumination: 2, timeline_consistency: 5, relational_trajectory: 4 }))));
    expect(result.errors).toBe(0);
  });

  it("reports a turn whose GM failed and sends no guidance to the next one", async () => {
    const { deps, requests } = fakeDeps({ gmFor: (turn) => turn === 1 ? null : gm(turn) });
    const result = await runEvalSequence({ sequence: sequence(3), config: reference, repeatIndex: 1, deps, turnWeights: DEFAULT_SCORE_WEIGHTS });
    expect(requests[1].gmGuidance).toBeNull();
    expect(requests[2].gmGuidance).toBe("conseil du tour 2");
    expect(result.turns[0].gmStatus).toBe("absent");
    expect(result.turns[0].gmIssue).toBe("sans état terminal");
    expect(result.guidanceTransmitted).toBe(1);
  });

  it("names why a post-turn did not execute, without its raw output", () => {
    expect(describeGmIssue(gm(1))).toBeNull();
    expect(describeGmIssue(gm(1, { execution_status: "invalid", execution_reason: "incomplete_schema",
      validation_issues: [{ code: "schema_incomplete", missing_fields: ["memory_delta"] }] }))).toBe("incomplete_schema · schema_incomplete(memory_delta)");
  });

  it("keeps playing after a turn error and counts it", async () => {
    const { deps } = fakeDeps();
    const failing: SequenceRunDeps = { ...deps, runTurn: async (config, request, signal) => {
      if (request.turnIndex === 2) throw new Error("timeout personnage");
      return deps.runTurn(config, request, signal);
    } };
    const result = await runEvalSequence({ sequence: sequence(3), config: reference, repeatIndex: 1, deps: failing, turnWeights: DEFAULT_SCORE_WEIGHTS });
    expect(result.turns[1].error).toBe("timeout personnage");
    expect(result.turns[1].score).toBeNull();
    expect(result.errors).toBe(1);
  });

  it("propagates an abort instead of recording it as a turn error", async () => {
    const { deps } = fakeDeps();
    const aborting: SequenceRunDeps = { ...deps, runTurn: async () => { throw new DOMException("stop", "AbortError"); } };
    await expect(runEvalSequence({ sequence: sequence(3), config: reference, repeatIndex: 1, deps: aborting, turnWeights: DEFAULT_SCORE_WEIGHTS })).rejects.toThrow("stop");
  });
});

describe("J3 grid", () => {
  it("keeps the isolated J1 judge prompt byte-identical and adds the previous exchanges only in a sequence", () => {
    const item = sequenceTurnAsEvalItem(sequence(), 1);
    expect(buildJudgePrompt(item, "réponse", "canon")).toBe(buildJudgePrompt(item, "réponse", "canon", ""));
    expect(buildJudgePrompt(item, "réponse", "canon")).not.toContain("ÉCHANGES PRÉCÉDENTS");
    const prior = formatPriorExchanges(sequence(), [{ question: "q1", response: "r1" }]);
    const withPrior = buildJudgePrompt(item, "réponse", "canon", prior);
    expect(withPrior).toContain("## ÉCHANGES PRÉCÉDENTS DE LA CONVERSATION");
    expect(withPrior.indexOf("ÉCHANGES PRÉCÉDENTS")).toBeLessThan(withPrior.indexOf("## RÉPONSE DE MAX"));
  });

  it("asks the sequence judge for five criteria on the whole transcript", () => {
    const prompt = buildSequenceJudgePrompt(sequence(), [{ question: "q1", response: "r1" }, { question: "q2", response: "" }], "canon");
    for (const key of Object.keys(DEFAULT_SEQUENCE_WEIGHTS)) expect(prompt).toContain(`"${key}": 0-5`);
    expect(prompt).toContain("### Tour 2\nJoueur : q2\nMax : (pas de réponse)");
    expect(prompt).toContain("le joueur a vu le film");
    expect(prompt).toContain("- Tour 2 : reprend le tour 1");
  });

  it("weights the sequence criteria and leaves absent ones out of the denominator", () => {
    expect(sequenceScore({ criteria: { continuity: 5, thread_resumption: 5, rumination: 5, timeline_consistency: 5, relational_trajectory: 5 } })).toBe(10);
    expect(sequenceScore({ criteria: { continuity: 5, timeline_consistency: 0 } })).toBe(5);
    expect(sequenceScore({ criteria: {} })).toBeNull();
    const parsed = parseSequenceJudgeResponse("bruit {\"continuity\": 9, \"rumination\": -1, \"overall\": 12} fin");
    expect(parsed.criteria).toEqual({ continuity: 5, rumination: 0 });
    expect(parsed.overall).toBe(10);
    expect(parseSequenceJudgeResponse("pas de json").rationale).toBe("JSON juge illisible");
    expect(parseSequenceJudgeResponse("").criteria).toEqual({});
    const truncated = parseSequenceJudgeResponse('{\n "continuity": 3,\n "thread_resumption": 2,\n "rumination": 4,\n "timeline_consistency": 1,\n "relational_trajectory": 3,\n "overall": 5,\n "rationale": "Au tour 4 Max accepte');
    expect(truncated.criteria).toEqual({ continuity: 3, thread_resumption: 2, rumination: 4, timeline_consistency: 1, relational_trajectory: 3 });
    expect(truncated.rationale).toContain("réponse tronquée");
  });
});

function runResult(config: EvalTurnConfig, sequenceId: string, repeatIndex: number, turnScores: number[], seq: number): SequenceRunResult {
  return {
    sequenceId,
    title: sequenceId,
    characterKey: "max",
    configLabel: config.label,
    factor: config.factor,
    repeatIndex,
    turns: turnScores.map((score, index) => ({
      turnIndex: index + 1, question: `Question ${index + 1} ?`, response: "r", error: null, latencyMs: 1,
      gmGuidanceIn: index ? "conseil" : null, gmStatus: "executed", gmIssue: null, gmGuidanceOut: "conseil",
      memoryLastTurnBefore: index, memoryLastTurnAfter: index + 1,
      judge: parseJudgeResponse(judgeJson(score)), score,
    })),
    sequenceJudge: parseSequenceJudgeResponse(JSON.stringify({ continuity: seq / 2, thread_resumption: seq / 2, rumination: seq / 2, timeline_consistency: seq / 2, relational_trajectory: seq / 2 })),
    sequenceScore: seq,
    turnMean: turnScores.reduce((sum, value) => sum + value, 0) / turnScores.length,
    guidanceTransmitted: turnScores.length - 1,
    errors: 0,
  };
}

describe("J3 comparison and report", () => {
  it("computes Δ per sequence, per turn and per sequence criterion, with the noise between repeats", () => {
    const seq = sequence(3);
    const results = [
      runResult(reference, "max-T", 1, [5, 5, 5], 6),
      runResult(reference, "max-T", 2, [6, 6, 6], 7),
      runResult(candidate, "max-T", 1, [7, 7, 7], 8),
      runResult(candidate, "max-T", 2, [8, 8, 8], 9),
    ];
    const comparison = compareSequenceRuns(results, [seq]);
    expect(comparison.overall.turn).toEqual({ reference: 5.5, candidate: 7.5, delta: 2 });
    expect(comparison.overall.sequence).toEqual({ reference: 6.5, candidate: 8.5, delta: 2 });
    expect(comparison.overall.turnNoise).toBeCloseTo(0.707, 2);
    expect(comparison.bySequence[0].sequence.delta).toBe(2);
    expect(comparison.byTurn).toHaveLength(3);
    expect(comparison.bySequenceCriterion.find((row) => row.key === "continuity")?.delta).toBe(1);
    expect(comparison.byTurnCriterion.find((row) => row.key === "canon_timeline")?.delta).toBe(0);
    expect(comparison.gmLoop.every((row) => row.guidanceTransmitted === 2)).toBe(true);
    expect(comparison.verdict).toContain("le candidat fait mieux");
  });

  it("labels a reference against itself as a witness run measuring noise", () => {
    const witness: EvalTurnConfig = { ...reference, label: "candidat (optimized_v3) · témoin", factor: "candidate" };
    const comparison = compareSequenceRuns([
      runResult(reference, "max-T", 1, [5, 5, 5], 6),
      runResult(witness, "max-T", 1, [5.1, 5.1, 5.1], 6.1),
    ], [sequence(3)]);
    expect(comparison.verdict).toMatch(/^Témoin/);
    expect(comparison.verdict).toContain("entre deux configurations identiques");
    expect(comparison.verdict).not.toContain("fait mieux");
  });

  it("estimates the cost per sequence and the cap unit (longest sequence)", () => {
    const estimate = estimateSequenceRun({ sequences: [sequence(5), sequence(3)], configs: 2, repeats: 2, isolatedPerTurnUsd: 0.016 });
    expect(estimate.turns).toBe(32);
    expect(estimate.sequenceJudgeCalls).toBe(8);
    expect(estimate.perTurnUsd).toBe(0.02);
    expect(estimate.maxSequenceUsd).toBe(0.13);
    expect(estimate.estimatedCostUsd).toBe(0.88);
  });

  it("writes the report sections without any hidden prompt", () => {
    const seq = sequence(3);
    const results = [runResult(reference, "max-T", 1, [5, 5, 5], 6), runResult(candidate, "max-T", 1, [7, 7, 7], 8)];
    const markdown = formatSequenceReportMarkdown({
      runId: "run-1", environment: "sandbox-ulrich", corpusFile: "docs/eval/sequences_j3_v1.json", corpusStatus: "proposition",
      judgeModel: "anthropic/claude-sonnet-5.5", repeats: 1, configs: [reference, candidate],
      comparison: compareSequenceRuns(results, [seq]), results,
      estimate: estimateSequenceRun({ sequences: [seq], configs: 2, repeats: 1, isolatedPerTurnUsd: 0.016 }),
      capUsd: 3, committedUsd: 0.2, actual: { usd: 0.18, pricedCalls: 14, pendingCalls: 0, failedCalls: 0 },
      costBySequenceRun: { [`${reference.label}::max-T::1`]: 0.09 }, outcome: "terminé", durationMs: 61_000,
      blockedSettingsWrites: 0, generatedAt: "2026-11-09T22:00:00Z",
    });
    for (const heading of ["## Verdict", "## Par séquence", "## Critères de séquence", "## Critères par tour", "## Par tour", "## Boucle Game Master", "## Transcriptions"]) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain("0.09 $");
    expect(markdown).toContain("Un seul passage");
    expect(markdown).not.toContain("FORMAT DE SORTIE");
  });
});

describe("J3 headless options", () => {
  it("defaults to the proposed corpus and two repeats, and refuses resume, PRÉSENT generation and prod", () => {
    const ok = parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--sequences", "max-A,emma-B"]);
    expect(ok.errors).toEqual([]);
    expect(ok.options.corpus).toBe(DEFAULT_SEQUENCE_CORPUS);
    expect(ok.options.repeats).toBe(2);
    expect(ok.options.sequenceIds).toEqual(["max-A", "emma-B"]);
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--repeats", "3"]).options.repeats).toBe(3);
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--corpus=@docs/x.json"]).options.corpus).toBe("docs/x.json");
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--resume", "abc"]).errors[0]).toContain("--resume");
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--candidate-present", "v2_second_person"]).errors[0]).toContain("--candidate-present");
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3", "--env", "prod"]).errors.join(" ")).toContain("prod");
  });
});
