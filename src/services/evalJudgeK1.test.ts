import { describe, expect, it } from "vitest";
import sheets from "@/agents/__fixtures__/speechSandbox20261109.json";
import {
  UNREADABLE_JUDGE_RATIONALE,
  buildJudgeCanonReference,
  buildJudgePrompt,
  parseSnapshotOverrides,
  buildEvalTurnOverrides,
  type EvalItem,
  type EvalResult,
  type EvalTurnConfig,
} from "@/services/evalJudgePipeline";
import {
  CANON_CONTRADICTION_CAPS,
  DEFAULT_SCORE_WEIGHTS,
  canonCap,
  readJudgeSubScores,
  scoreOfResult,
  weightedScore,
} from "@/services/evalJudgeScoring";
import {
  formatCalibrationReport,
  parseCalibrationFile,
  summarizeCalibration,
  type CalibrationRow,
} from "@/services/evalJudgeCalibration";
import { readFileSync } from "node:fs";
import path from "node:path";

const max = sheets.find((row) => row.name.startsWith("Max"))!;
const item = { question: "Et aujourd'hui ?", gold_answer: "", must_include: "", must_not: "", tone: "retenu", max_length: 3, judge_notes: "", character_name: "Max" } as unknown as EvalItem;
const judged = (canon: number, others = 5) => ({
  gold_fidelity: others, must_include: others, must_not: others, tone: others, character_voice: others, length_ok: true,
  not_meta: others, lived_impact: others, canon_timeline: canon, distinct_voice: others,
  speech_quality: { sounds_spoken: others, no_therapeutic_language: others, non_caricatural: others, facts_understandable: others, hope_without_cure: others },
});

describe("judge canon reference (lot K1)", () => {
  const canon = buildJudgeCanonReference(max);

  it("gives the judge the established facts, the identity and the interdicts", () => {
    expect(canon).toContain("### Faits établis au moment de l'appel");
    expect(canon).toContain("Emma a été contaminée hier");
    expect(canon).toContain("Les tiens : Mona, ton aînée");
    expect(canon).toContain("### Identité");
    expect(canon).toContain("### Ce que le personnage ne fait jamais");
    expect(canon).toContain("Tu ne confonds pas les chronologies");
    expect(canon.split("Ce qui est vrai aujourd'hui").length - 1).toBe(1);
  });

  it("no longer tells the judge that the character awaits the call", () => {
    expect(max.situation_summary).toContain("Il attend l'appel");
    expect(canon).not.toMatch(/attends? (l['’]|un )appel|appel que tu attends\b/);
    expect(canon).toContain("il n'attend plus cet appel");
  });

  it("stays bounded", () => {
    expect(canon.length).toBeLessThan(15_500);
  });

  it("asks the judge to check the canon beyond the corpus target and to flag a doubtful target", () => {
    const prompt = buildJudgePrompt(item, "J'attends l'appel des bénévoles.", canon);
    expect(prompt).toContain("## VÉRIFICATION DU CANON — AVANT TOUTE NOTE");
    expect(prompt).toContain("même quand la cible");
    expect(prompt).toContain("canon_timeline ≤ 1");
    expect(prompt).toContain('"corpus_doubt": ""');
    expect(prompt.indexOf("VÉRIFICATION DU CANON")).toBeLessThan(prompt.indexOf("JEU DU PERSONNAGE"));
  });
});

describe("canon cap and unreadable answers (lot K1)", () => {
  it("caps the weighted note on a canon contradiction, whatever the other criteria", () => {
    expect(weightedScore(readJudgeSubScores(judged(0))!, DEFAULT_SCORE_WEIGHTS)).toBe(CANON_CONTRADICTION_CAPS[0]);
    expect(weightedScore(readJudgeSubScores(judged(1))!, DEFAULT_SCORE_WEIGHTS)).toBe(CANON_CONTRADICTION_CAPS[1]);
    expect(weightedScore(readJudgeSubScores(judged(2))!, DEFAULT_SCORE_WEIGHTS)).toBeGreaterThan(7);
    expect(weightedScore(readJudgeSubScores(judged(5))!, DEFAULT_SCORE_WEIGHTS)).toBe(10);
  });

  it("never raises a note and leaves results without the criterion untouched", () => {
    expect(weightedScore(readJudgeSubScores(judged(0, 1))!, DEFAULT_SCORE_WEIGHTS)).toBeLessThan(CANON_CONTRADICTION_CAPS[0]);
    expect(canonCap(null)).toBe(10);
    expect(canonCap(undefined)).toBe(10);
    const old = readJudgeSubScores({ gold_fidelity: 5, must_include: 5, must_not: 5, tone: 5, character_voice: 5, length_ok: true })!;
    expect(weightedScore(old, DEFAULT_SCORE_WEIGHTS)).toBe(10);
  });

  it("leaves an unreadable judge answer out of the means, including rows stored before the lot", () => {
    const legacy = { gold_fidelity: 0, must_include: 0, must_not: 0, tone: 0, character_voice: 0, length_ok: false, overall: 0, rationale: UNREADABLE_JUDGE_RATIONALE };
    expect(readJudgeSubScores(legacy)).toBeNull();
    expect(scoreOfResult({ judge_json: legacy, overall_score: 0 } as unknown as EvalResult, DEFAULT_SCORE_WEIGHTS)).toBeNull();
    expect(scoreOfResult({ judge_json: null, overall_score: null } as unknown as EvalResult, DEFAULT_SCORE_WEIGHTS)).toBeNull();
  });
});

describe("established facts switch for reference vs candidate", () => {
  it("reads the switch from a snapshot and passes it to the turn, in memory", () => {
    expect(parseSnapshotOverrides('{"establishedFacts": false}')).toEqual({ overrides: { establishedFacts: false }, errors: [] });
    expect(parseSnapshotOverrides('{"establishedFacts": "non"}').errors).toEqual(["establishedFacts doit être true ou false"]);
    const config = { promptVariant: "optimized_v3", ragTopK: 4, ragRetrieveK: 8, establishedFacts: false } as unknown as EvalTurnConfig;
    expect(buildEvalTurnOverrides(config, "max").establishedFacts).toBe(false);
    expect(buildEvalTurnOverrides({ ...config, establishedFacts: undefined }, "max").establishedFacts).toBeUndefined();
  });
});

describe("judge calibration against a human rater", () => {
  const row = (label: string, human: number, judge: number | null): CalibrationRow => ({
    label, human, judge, gap: judge === null ? null : Number((judge - human).toFixed(2)), previousJudge: null, canonTimeline: null, rationale: "", corpusDoubt: "",
  });

  it("reads Romed's versioned notes", () => {
    const { file, errors } = parseCalibrationFile(readFileSync(path.resolve(__dirname, "../../docs/eval/calibration_romed_20261114.json"), "utf8"));
    expect(errors).toEqual([]);
    expect(file!.items).toHaveLength(10);
    expect(file!.items[3]).toMatchObject({ sequence: "max-A", turn: 5, human: 4, judge: 7.8 });
    expect(parseCalibrationFile("{").errors).toEqual(["JSON illisible"]);
    expect(parseCalibrationFile('{"items":[{"sequence":"max-A","turn":0,"response":"","human":12}]}').errors).toHaveLength(3);
  });

  it("measures the previous judge above the threshold on those notes", () => {
    const { file } = parseCalibrationFile(readFileSync(path.resolve(__dirname, "../../docs/eval/calibration_romed_20261114.json"), "utf8"));
    const summary = summarizeCalibration(file!.items.map((entry) => row(`${entry.sequence} · ${entry.turn}`, entry.human, entry.judge)));
    expect(summary.meanAbsGap).toBe(1.51);
    expect(summary.largeGaps).toBe(3);
    expect(summary.passed).toBe(false);
  });

  it("passes only under both thresholds and with every answer rated", () => {
    expect(summarizeCalibration([row("a", 4, 5), row("b", 6, 5), row("c", 3, 5.5)]).passed).toBe(false); // 3 > 2 once, mean 1.5
    expect(summarizeCalibration([row("a", 4, 4.8), row("b", 6, 5), row("c", 3, 3.5)])).toMatchObject({ passed: true, largeGaps: 0, meanAbsGap: 0.77 });
    expect(summarizeCalibration([row("a", 4, 4.8), row("b", 6, null)])).toMatchObject({ passed: false, unreadable: 1, rated: 1 });
  });

  it("writes a readable report", () => {
    const summary = summarizeCalibration([row("max-A · 5", 4, 7.8), row("emma-B · 2", 2, 2.4)]);
    const report = formatCalibrationReport({
      summary, file: { rater: "Romed", ratedAt: "2026-11-14", source: null }, calibrationPath: "cal.json", corpusPath: "corpus.json",
      corpusStatus: "corrigé", environment: "sandbox-ulrich", judgeModel: "juge", repeats: 1, canonCap: "plafond", estimatedCostUsd: 0.04, generatedAt: "t",
    });
    expect(report).toContain("| max-A · 5 | 4 | 7,8 | **+3,8** |");
    expect(report).toContain("Critère non atteint");
  });
});
