import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sheets from "@/agents/__fixtures__/speechSandbox20261109.json";
import { buildOptimizedPromptAssembly, OPTIMIZED_V3_LIMITS } from "@/agents/maxOptimizedPromptCompiler";
import type { CharacterPrompt } from "@/services/characterPromptService";
import { buildExperienceFrame } from "@/services/experienceFrame";
import {
  CALL_PRESENT_INVARIANT,
  ESTABLISHED_FACTS_MAX_CHARS,
  ESTABLISHED_FACTS_TITLE,
  ESTABLISHED_FACTS_USAGE_LINE,
  characterEstablishedFacts,
  kinshipFromTimeline,
  neutralizeAwaitedCall,
  sheetAtCallTime,
  withoutEstablishedFacts,
} from "./establishedFacts";

const sheet = (name: "Max" | "Emma") => sheets.find((row) => row.name.startsWith(name)) as unknown as CharacterPrompt;
const read = (file: string) => JSON.parse(readFileSync(path.resolve(__dirname, "../..", file), "utf8"));
const AWAITED = /attends? (l['’]|un )appel|appel que tu attends\b/;

describe("established facts — source", () => {
  it.each(["Max", "Emma"] as const)("extrait de la fiche de %s, sans rien écrire", (name) => {
    const facts = characterEstablishedFacts(sheet(name))!;
    expect(facts.source).toBe("extracted");
    expect(facts.content.length).toBeLessThanOrEqual(ESTABLISHED_FACTS_MAX_CHARS);
    expect(facts.content.startsWith("Ce qui est vrai aujourd'hui")).toBe(true);
    expect(facts.content).toContain("Les tiens : Mona, ton aînée ; Léo, ton fils ; Ava, ta cadette.");
    // Every sentence comes from the sheet.
    const source = [sheet(name).identite_fondamentale, sheet(name).timeline, sheet(name).ce_que_tu_ne_fais_jamais].join("\n");
    for (const sentence of facts.content.split("\n")[0].split(/(?<=\.)\s+/)) expect(source).toContain(sentence);
  });

  it("préfère le champ Notion « Ce que tu sais aujourd'hui » quand il est rempli", () => {
    const field = "Tu sais aujourd'hui que c'était Lise. Elle s'était présentée comme Peter.";
    expect(characterEstablishedFacts({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: field })).toEqual({ content: field, source: "field" });
    const long = `${"Une phrase établie. ".repeat(80)}`.trim();
    const capped = characterEstablishedFacts({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: long })!.content;
    expect(capped.length).toBeLessThanOrEqual(ESTABLISHED_FACTS_MAX_CHARS);
    expect(capped.endsWith(".")).toBe(true);
  });

  it("ne rend rien sans paragraphe source ni champ", () => {
    expect(characterEstablishedFacts({ ...sheet("Max"), identite_fondamentale: "Tu es Max." })).toBeNull();
  });

  it("ne paie pas deux fois le paragraphe extrait", () => {
    expect(withoutEstablishedFacts(sheet("Max")).identite_fondamentale).not.toContain("Ce qui est vrai aujourd'hui");
    expect(sheet("Max").identite_fondamentale).toContain("Ce qui est vrai aujourd'hui");
  });

  it("lit les liens de parenté dans les titres permanents seulement", () => {
    expect(kinshipFromTimeline("SOUVENIR MAX permanent.03 — Mona, ton aînée\nSOUVENIR MAX permanent.06 — Ta rencontre avec Emma\nSOUVENIR MAX J-5.01 / x / jour — Léo, ton fils"))
      .toEqual(["Mona, ton aînée"]);
  });
});

describe("the awaited call is the call in progress", () => {
  it.each([
    ["Tu attends l'appel de la cellule de bénévoles. Tu as besoin de parler.", "Tu parles en ce moment avec la personne de la cellule de bénévoles dont tu attendais l'appel. Tu as besoin de parler."],
    ["Il attend l'appel d'une cellule de bénévoles, car il a besoin de parler.", "Il parle en ce moment avec la personne d'une cellule de bénévoles dont il attendait l'appel, car il a besoin de parler."],
    ["Elle attend un appel de la cellule de bénévoles, car elle a besoin de parler.", "Elle parle en ce moment avec la personne de la cellule de bénévoles dont elle attendait l'appel, car elle a besoin de parler."],
    ["Chacun de son côté, et l'appel que tu attends", "Chacun de son côté, et l'appel que tu attendais, et qui a lieu maintenant"],
    ["Emma attend dans la cuisine.", "Emma attend dans la cuisine."],
  ])("%s", (source, expected) => {
    expect(neutralizeAwaitedCall(source)).toBe(expected);
  });

  it.each(["Max", "Emma"] as const)("plus aucune attente de l'appel dans la fiche de %s lue au moment de l'appel", (name) => {
    const fields = Object.values(sheetAtCallTime(sheet(name))).filter((value): value is string => typeof value === "string");
    expect(Object.values(sheet(name)).some((value) => typeof value === "string" && AWAITED.test(value))).toBe(true);
    expect(fields.some((value) => AWAITED.test(value))).toBe(false);
  });

  it("partage l'invariant avec le Game Master par le cadre commun", () => {
    expect(buildExperienceFrame({ config: undefined, filmAnswer: null }).prompt).toBe(CALL_PRESENT_INVARIANT);
    expect(buildExperienceFrame({ config: undefined, filmAnswer: "vu" }).prompt.startsWith(CALL_PRESENT_INVARIANT)).toBe(true);
    expect(buildExperienceFrame({ config: undefined, filmAnswer: null, callPresent: false }).prompt).toBe("");
  });
});

describe("optimized_v3 core with established facts", () => {
  const build = (name: "Max" | "Emma", userMessage: string, establishedFacts?: boolean, historyChars = 0) =>
    buildOptimizedPromptAssembly({ character: sheet(name), characterName: sheet(name).name!, userMessage, historyChars, establishedFacts });

  it.each(["Max", "Emma"] as const)("protège le bloc de %s avant la voix, dans le même budget", (name) => {
    for (const historyChars of [0, OPTIMIZED_V3_LIMITS.memoryChars]) {
      const result = build(name, "Qu'est-ce qui s'est passé à la montagne ?", undefined, historyChars);
      const prompt = result.finalSystemPrompt;
      const facts = characterEstablishedFacts(sheetAtCallTime(sheet(name)))!.content;
      // The usage line keeps the block from being read as a closed list.
      expect(prompt).toContain(`## ${ESTABLISHED_FACTS_TITLE}\n${facts}\n${ESTABLISHED_FACTS_USAGE_LINE}`);
      expect(prompt.indexOf(ESTABLISHED_FACTS_TITLE)).toBeLessThan(prompt.indexOf("## MANIÈRE DE PARLER"));
      expect(prompt.split("Ce qui est vrai aujourd'hui").length - 1).toBe(1);
      expect(result.budget?.staticChars).toBeLessThanOrEqual(OPTIMIZED_V3_LIMITS.staticChars);
      expect(result.budget?.withinBudget).toBe(true);
      expect(AWAITED.test(prompt)).toBe(false);
    }
  });

  it.each(["Max", "Emma"] as const)("ne grossit pas le prompt de %s et garde les états de parole", (name) => {
    const question = "Et aujourd'hui, là, à Lausanne, comment ça se passe ?";
    const withFacts = build(name, question);
    const without = build(name, question, false);
    expect(withFacts.finalSystemPrompt.length).toBeLessThanOrEqual(without.finalSystemPrompt.length + 60);
    const manner = sheet(name).maniere_de_parler!;
    const states = manner.slice(manner.indexOf("Tes états de parole"), manner.indexOf("\n\n", manner.indexOf("Tes états de parole")));
    expect(states.split("\n").length).toBeGreaterThan(4);
    expect(withFacts.finalSystemPrompt).toContain(states);
    expect(withFacts.finalSystemPrompt).toContain(manner.split("\n\n")[0]);
    // What the speaking manner gave up is traced, never silent.
    const yielded = withFacts.budget!.units!.filter((unit) => unit.id.startsWith("static:maniere_de_parler:yielded"));
    expect(yielded.length).toBeGreaterThan(0);
    expect(yielded.every((unit) => unit.status === "budget")).toBe(true);
  });

  it("rejoue le noyau précédent quand le bloc est coupé (référence du juge)", () => {
    const reference = build("Max", "Et le fusil ?", false).finalSystemPrompt;
    expect(reference).not.toContain(ESTABLISHED_FACTS_TITLE);
    expect(reference).toContain(sheet("Max").situation_summary.trim());
    expect(reference).toContain(sheet("Max").maniere_de_parler!.trim());
  });

  it("garde le noyau précédent si le bloc ne peut pas entrer", () => {
    const tight = { ...sheet("Emma"), maniere_de_parler: `${"Phrase de voix sans liste. ".repeat(100)}`.trim() };
    const result = buildOptimizedPromptAssembly({ character: tight, characterName: tight.name!, userMessage: "Allô ?", historyChars: 0 });
    expect(result.finalSystemPrompt).not.toContain(ESTABLISHED_FACTS_TITLE);
    expect(result.finalSystemPrompt).toContain(tight.maniere_de_parler);
  });

  it("lit les souvenirs au moment de l'appel", () => {
    const result = buildOptimizedPromptAssembly({
      character: sheet("Max"), characterName: sheet("Max").name!, userMessage: "Et aujourd'hui ?", historyChars: 0,
      ragCandidates: [{ id: "today", rank: 1, content: "Tu attends l'appel de la cellule de bénévoles, assis dans le salon." }],
    });
    expect(result.finalSystemPrompt).toContain("Tu parles en ce moment avec la personne de la cellule de bénévoles dont tu attendais l'appel, assis dans le salon.");
  });
});

// Non-regression guard: what the compiled core holds for the calibration turns.
describe("canon checklist (lot K1)", () => {
  const checklist = read("docs/eval/faits_canon_k1.json") as {
    corpus: string;
    facts: Array<{ id: string; character: "max" | "emma"; turns: string[]; expected: "present" | "absent"; pattern: string; explanation?: string }>;
  };
  const corpus = read(checklist.corpus) as { conversations: Array<{ id: string; turns: Array<{ question: string }> }> };
  const question = (turn: string) => {
    const [id, index] = turn.split("·");
    const found = corpus.conversations.find((sequence) => sequence.id === id)?.turns[Number(index) - 1]?.question;
    if (!found) throw new Error(`Tour inconnu : ${turn}`);
    return found;
  };
  const cases = checklist.facts.flatMap((fact) => fact.turns.map((turn) => ({ fact, turn })));

  it.each(cases)("$fact.id · $turn → $fact.expected", ({ fact, turn }) => {
    const character = sheet(fact.character === "max" ? "Max" : "Emma");
    const prompt = buildOptimizedPromptAssembly({ character, characterName: character.name!, userMessage: question(turn), historyChars: 0 }).finalSystemPrompt;
    expect(new RegExp(fact.pattern).test(prompt)).toBe(fact.expected === "present");
  });

  it("explique chaque fait encore absent", () => {
    for (const fact of checklist.facts.filter((item) => item.expected === "absent")) expect(fact.explanation?.trim()).toBeTruthy();
  });

  it("montre ce que le bloc apporte : sans lui, les faits établis manquent", () => {
    const max = sheet("Max");
    const before = buildOptimizedPromptAssembly({ character: max, characterName: max.name!, userMessage: question("max-A·5"), historyChars: 0, establishedFacts: false }).finalSystemPrompt;
    expect(before).not.toContain("Emma a été contaminée hier");
    expect(AWAITED.test(before)).toBe(true);
  });
});
