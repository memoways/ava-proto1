import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimateRecallRunUsd,
  formatRecallReport,
  gradeRecall,
  parseRecallScenario,
  recallAsSequence,
  summarizeRecallRun,
  type RecallTurnResult,
} from "./llmRecallScenario";

const scenarioFile = path.resolve(__dirname, "../../docs/eval/rappel_long_v1.json");

describe("scénario de rappel en conversation longue", () => {
  it("le corpus versionné se lit sans erreur : deux conversations de 40 tours, faits donnés tôt, redemandés tard", () => {
    const { conversations, errors } = parseRecallScenario(readFileSync(scenarioFile, "utf8"));
    expect(errors).toEqual([]);
    expect(conversations.map((c) => c.characterKey)).toEqual(["max", "emma"]);
    for (const conversation of conversations) {
      expect(conversation.turns).toHaveLength(40);
      const recallTurns = conversation.turns.map((t, i) => (t.recall ? i + 1 : 0)).filter(Boolean);
      expect(Math.min(...recallTurns)).toBeGreaterThanOrEqual(30);
      expect(new Set(conversation.turns.filter((t) => t.recall).map((t) => t.recall!.fact)).size).toBe(conversation.facts.length);
      expect(recallAsSequence(conversation).turns).toHaveLength(40);
    }
  });

  it("refuse un fait inconnu, un tour sans question et une conversation trop courte", () => {
    const raw = JSON.stringify({ conversations: [{ id: "x", character: "Max", facts: [{ id: "a", label: "A" }],
      turns: [{ question: "" }, { question: "Q", recall: { fact: "b", accept: ["z"] } }] }] });
    const { conversations, errors } = parseRecallScenario(raw);
    expect(conversations).toEqual([]);
    expect(errors[0]).toMatch(/2 tours/);
    expect(errors[0]).toMatch(/fait inconnu « b »/);
    expect(errors[0]).toMatch(/tour 1 sans question/);
  });
});

describe("notation du rappel", () => {
  const check = { fact: "fils", accept: ["noe"], forbid: ["leo"] };
  it("reconnaît le mot sans accent ni casse, et en mot entier pour un terme court", () => {
    expect(gradeRecall(check, "Oui, Noé. Il a sept ans, c'est ça ?")).toBe("recalled");
    expect(gradeRecall(check, "Je crois que c'était… Noémie ? Non, je ne sais plus.")).toBe("missed");
    expect(gradeRecall(check, "C'est Léo, non ?")).toBe("contradicted");
    expect(gradeRecall({ fact: "metier", accept: ["infirmi"], forbid: [] }, "Vous êtes infirmière.")).toBe("recalled");
    expect(gradeRecall({ fact: "age", accept: ["sept", "7"], forbid: [] }, "Il a 7 ans.")).toBe("recalled");
    expect(gradeRecall({ fact: "age", accept: ["7"], forbid: [] }, "Il a 17 ans.")).toBe("missed");
  });

  it("compte un tour en erreur à part", () => {
    expect(gradeRecall(check, "", null)).toBe("error");
    expect(gradeRecall(check, "Noé", "Personnage en repli")).toBe("error");
  });

  it("résume un run et l'écrit dans le rapport", () => {
    const { conversations } = parseRecallScenario(readFileSync(scenarioFile, "utf8"));
    const turns: RecallTurnResult[] = [
      { turnIndex: 1, question: "q", response: "r", latencyMs: 3000, error: null, memoryLastTurn: 1, recall: null },
      { turnIndex: 2, question: "q", response: "r", latencyMs: 5000, error: null, memoryLastTurn: 2, recall: { fact: "prenom", verdict: "recalled" } },
      { turnIndex: 3, question: "q", response: "", latencyMs: 0, error: "x", memoryLastTurn: 2, recall: { fact: "fils", verdict: "error" } },
    ];
    const summary = summarizeRecallRun("openai/gpt-5.6-luna", conversations[0], turns);
    expect(summary).toMatchObject({ checks: 2, recalled: 1, recallRate: 0.5, errors: 1, medianTurnMs: 4000, memoryLastTurn: 2 });
    expect(formatRecallReport("2026-11-26", "sandbox-ulrich", [summary])).toContain("| openai/gpt-5.6-luna | rappel-max | 3 | 1 | 1/2 (50 %) |");
  });

  it("estime le coût d'un run (personnage + GM par tour)", () => {
    expect(estimateRecallRunUsd(40, { input: 0.2, output: 1.2 })).toBeCloseTo(40 * (0.001 + 0.000132 + 0.0026), 4);
  });
});
