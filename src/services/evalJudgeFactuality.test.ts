import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFactualityJudgePrompt,
  factualityScore,
  parseFactualityJudgeResponse,
  type FactualityTurnInput,
} from "./evalJudgeFactuality";
import { formatFactualityReportMarkdown } from "./evalJudgeFactualityReport";
import { DEFAULT_SCORE_WEIGHTS } from "./evalJudgeScoring";
import { parseSequenceCorpus, runEvalSequence, type SequenceRunDeps } from "./evalJudgeSequence";
import { parseHeadlessSequenceArgs } from "./evalJudgeSequenceHeadless";
import type { EvalTurnConfig } from "./evalJudgePipeline";

const turn: FactualityTurnInput = {
  question: "Le fusil, vous l'avez pris chez votre père ?",
  requiredFacts: ["ce n'est pas Max qui a pris le fusil", "Léo l'a pris"],
  forbiddenClaims: ["accepter la prémisse", "inventer que Max l'a choisi"],
  falsePremise: "Max a pris lui-même le fusil.",
};

describe("factuality judge (lot F)", () => {
  it("le prompt ne juge que les faits : aucun critère de style", () => {
    const prompt = buildFactualityJudgePrompt(turn, "Max Lorenzo", "Non, c'est Léo.", "### Faits\nLéo a pris le fusil.", "");
    for (const style of ["not_meta", "lived_impact", "distinct_voice", "sounds_spoken", "character_voice", "length_ok", "gold_fidelity"]) {
      expect(prompt).not.toContain(`"${style}"`);
    }
    expect(prompt).toContain("Tu ne juges ni le style");
    expect(prompt).toContain("Incertitude crédible");
    expect(prompt).toContain("F1. ce n'est pas Max qui a pris le fusil");
    expect(prompt).toContain("I2. inventer que Max l'a choisi");
    expect(prompt).toContain("Max a pris lui-même le fusil.");
    expect(prompt).toContain('"false_premise": 0-5');
  });

  it("sans prémisse fausse, la note de prémisse est null et hors de la moyenne", () => {
    const prompt = buildFactualityJudgePrompt({ ...turn, falsePremise: null }, "Emma Munz", "…");
    expect(prompt).toContain('"false_premise": null');
    const verdict = parseFactualityJudgeResponse(JSON.stringify({ canon_timeline: 5, must_include: 5, must_not: 5, invention: 5, false_premise: 2 }), { ...turn, falsePremise: null })!;
    expect(verdict.false_premise).toBeNull();
    expect(factualityScore(verdict)).toBe(10);
  });

  it("lit le verdict par fait et les affirmations interdites", () => {
    const raw = `ok {"facts":{"F1":"correct","F2":"uncertain_ok"},"forbidden_hit":["I2"],"canon_timeline":4,"must_include":4,"must_not":2,"invention":3,"false_premise":5,"rationale":"x"}`;
    const verdict = parseFactualityJudgeResponse(raw, turn)!;
    expect(verdict.facts.map((fact) => fact.status)).toEqual(["correct", "uncertain_ok"]);
    expect(verdict.forbiddenHit).toEqual(["inventer que Max l'a choisi"]);
    expect(verdict.false_premise).toBe(5);
  });

  it("un fait inconnu du juge est « non abordé », jamais contredit ; une réponse illisible est écartée", () => {
    const verdict = parseFactualityJudgeResponse('{"facts":{"F1":"bizarre"},"canon_timeline":3}', turn)!;
    expect(verdict.facts.map((fact) => fact.status)).toEqual(["not_addressed", "not_addressed"]);
    expect(parseFactualityJudgeResponse("pas de json", turn)).toBeNull();
    expect(parseFactualityJudgeResponse('{"must_include":5}', turn)).toBeNull();
  });

  it("note /10 sur les seuls critères factuels, plafonnée par le canon", () => {
    const base = { canon_timeline: 5, must_include: 5, must_not: 5, invention: 5, false_premise: 5 };
    expect(factualityScore(base)).toBe(10);
    expect(factualityScore({ ...base, canon_timeline: 0 })).toBeLessThanOrEqual(3);
    expect(factualityScore({ ...base, canon_timeline: 1 })).toBeLessThanOrEqual(4);
    // The false premise weighs in when present: accepting it costs more than missing nothing else.
    expect(factualityScore({ ...base, false_premise: 0 })).toBeLessThan(factualityScore({ ...base, false_premise: null }));
    expect(factualityScore({ ...base, invention: 0 })).toBeCloseTo(10 * (1 - 2.5 / 13.5), 2);
  });

  it("option --focus factuality : candidat facultatif, valeur invalide refusée", () => {
    const ok = parseHeadlessSequenceArgs(["--focus", "factuality", "--repeats", "3"]);
    expect(ok.errors).toEqual([]);
    expect(ok.options.focus).toBe("factuality");
    expect(parseHeadlessSequenceArgs(["--candidate", "optimized_v3"]).options.focus).toBe("all");
    expect(parseHeadlessSequenceArgs(["--focus", "style", "--candidate", "optimized_v3"]).errors.join()).toContain("--focus");
  });
});

describe("factuality corpus (lot F)", () => {
  const file = path.resolve(__dirname, "../../docs/eval/sequences_factuality_f.json");
  const corpus = parseSequenceCorpus(readFileSync(file, "utf8"));

  it("est valide, reprend les quatre séquences J3 v2 et ajoute max-F et emma-F", () => {
    expect(corpus.errors).toEqual([]);
    const v2 = parseSequenceCorpus(readFileSync(path.resolve(__dirname, "../../docs/eval/sequences_j3_v2.json"), "utf8"));
    expect(corpus.sequences.map((s) => s.id)).toEqual([...v2.sequences.map((s) => s.id), "max-F", "emma-F"]);
    for (const sequence of v2.sequences) {
      expect(corpus.sequences.find((s) => s.id === sequence.id)!.turns.map((t) => t.question)).toEqual(sequence.turns.map((t) => t.question));
    }
  });

  it("porte les prémisses fausses du lot", () => {
    const premises = corpus.sequences.flatMap((s) => s.turns.filter((t) => t.falsePremise).map((t) => t.question)).join("\n");
    expect(premises).toContain("Le fusil, vous l'avez pris chez votre père ?");
    expect(premises).toContain("c'est Emma qui a contaminé Ava");
    expect(premises).toContain("Ava a déjà changé physiquement");
  });

  it("rejoue en focus factualité : note factualité, aucun juge de séquence ni juge de style", async () => {
    const sequence = corpus.sequences.find((s) => s.id === "max-F")!;
    let styleJudged = 0;
    let sequenceJudged = 0;
    const deps: SequenceRunDeps = {
      runTurn: async () => ({ response: "Non, c'est Léo.", gm: null, latencyMs: 1, canonReference: "canon" }),
      judgeTurn: async () => { styleJudged += 1; return null; },
      judgeSequence: async () => { sequenceJudged += 1; return { criteria: {}, overall: 0, rationale: "", raw: "" }; },
      judgeFactuality: async (input) => parseFactualityJudgeResponse(
        JSON.stringify({ canon_timeline: 5, must_include: 4, must_not: 5, invention: 5, false_premise: 5 }), input),
    };
    const config = { label: "ref", factor: "baseline" } as unknown as EvalTurnConfig;
    const result = await runEvalSequence({ sequence, config, repeatIndex: 1, deps, turnWeights: DEFAULT_SCORE_WEIGHTS, focus: "factuality" });
    expect(styleJudged).toBe(0);
    expect(sequenceJudged).toBe(0);
    expect(result.sequenceJudge).toBeNull();
    expect(result.errors).toBe(0);
    expect(result.turns.every((t) => t.judge === null && t.factuality && typeof t.score === "number")).toBe(true);

    const report = formatFactualityReportMarkdown({
      runId: "r", environment: "sandbox-ulrich", corpusFile: "x.json", judgeModel: "j", repeats: 1, configLabel: "ref",
      sequences: [sequence], results: [result], capUsd: 3, actualUsd: 0.1, outcome: "terminé", generatedAt: "2026-11-21",
    });
    expect(report).toContain("Aucun critère de style");
    expect(report).toContain("Par fait");
    expect(report).toContain("Bruit de mesure");
  });
});
