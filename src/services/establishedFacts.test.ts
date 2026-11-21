import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sheets from "@/agents/__fixtures__/speechSandbox20261121.json";
import { buildOptimizedPromptAssembly, OPTIMIZED_V3_LIMITS } from "@/agents/maxOptimizedPromptCompiler";
import type { CharacterPrompt } from "@/services/characterPromptService";
import { buildExperienceFrame, DEFAULT_CALL_PRESENT_TEXT } from "@/services/experienceFrame";
import {
  ESTABLISHED_FACTS_MAX_CHARS,
  ESTABLISHED_FACTS_TITLE,
  ESTABLISHED_FACTS_USAGE_LINE,
  characterEstablishedFacts,
  establishedFactsBudget,
  findAwaitedCallSentences,
  kinshipFromTimeline,
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

describe("the sheet is the only logic: no rewrite of « tu attends l'appel » (lot F)", () => {
  it.each(["Max", "Emma"] as const)("la fiche de %s ne dit plus « tu attends l'appel » (garde-fou : une fiche fautive est signalée, pas réécrite)", (name) => {
    expect(findAwaitedCallSentences(sheet(name))).toEqual([]);
  });

  it.each([
    ["Tu attends l'appel de la cellule de bénévoles.", "identite_fondamentale"],
    ["Elle attend un appel de la cellule.", "timeline"],
    ["Chacun de son côté, et l'appel que tu attends", "qui_tu_es"],
  ])("signale « %s »", (text, field) => {
    const hits = findAwaitedCallSentences({ ...sheet("Max"), [field]: text });
    expect(hits.map((hit) => hit.field)).toContain(field);
    expect(hits[0].excerpt).toContain(text.slice(0, 12));
  });

  it("ne signale pas une attente sans rapport avec l'appel", () => {
    expect(findAwaitedCallSentences({ ...sheet("Max"), timeline: "Emma attend dans la cuisine. Tu attendais l'appel hier." })).toEqual([]);
  });

  it("ne réécrit rien : une fiche fautive arrive telle quelle dans le prompt", () => {
    const faulty = { ...sheet("Max"), situation_summary: "Tu attends l'appel de la cellule de bénévoles, assis dans le salon." };
    const result = buildOptimizedPromptAssembly({
      character: faulty, characterName: faulty.name!, userMessage: "Et aujourd'hui ?", historyChars: 0,
      ragCandidates: [{ id: "today", rank: 1, content: "Tu attends l'appel de la cellule de bénévoles, assis dans le salon." }],
    });
    expect(result.finalSystemPrompt).toContain("Tu attends l'appel de la cellule de bénévoles");
    expect(result.finalSystemPrompt).not.toContain("dont tu attendais l'appel");
  });

  it("partage l'invariant avec le Game Master par le cadre commun, éditable dans la configuration", () => {
    expect(buildExperienceFrame({ config: undefined, filmAnswer: null }).prompt).toBe(DEFAULT_CALL_PRESENT_TEXT);
    expect(buildExperienceFrame({ config: undefined, filmAnswer: "vu" }).prompt.startsWith(DEFAULT_CALL_PRESENT_TEXT)).toBe(true);
    expect(buildExperienceFrame({ config: undefined, filmAnswer: null, callPresent: false }).prompt).toBe("");
    expect(buildExperienceFrame({ config: { callPresentText: "Texte publié." } as never, filmAnswer: null }).prompt).toBe("Texte publié.");
  });

  it("le champ rempli est la seule source : le paragraphe de l'identité n'est jamais lu à côté", () => {
    const field = "Tu sais aujourd'hui que c'était Lise.";
    expect(characterEstablishedFacts({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: field })).toEqual({ content: field, source: "field" });
    // A filled field with no complete sentence in budget yields nothing, never the paragraph.
    expect(characterEstablishedFacts({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: "x".repeat(1_300) })).toBeNull();
    expect(withoutEstablishedFacts({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: field }).identite_fondamentale).toContain("Ce qui est vrai aujourd'hui");
  });
});

describe("budget of the facts source (lot F follow-up)", () => {
  it("signale le paragraphe de l'identité trop long (Max 1 399 car. pour 1 200)", () => {
    const budget = establishedFactsBudget(sheet("Max"));
    expect(budget).toMatchObject({ source: "paragraph", sourceChars: 1399, max: 1200, overBudget: true });
    expect(budget.cutChars).toBeGreaterThan(100);
  });

  it("un champ court rempli tient sans coupe, et devient la seule source", () => {
    const field = "Mona est au camp : ton père l'y a envoyée. Léo a pris le fusil chez Papi, à la demande de ton père.";
    expect(establishedFactsBudget({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: field })).toEqual({ source: "field", sourceChars: field.length, max: 1200, overBudget: false, cutChars: 0 });
  });

  it("un champ trop long est signalé aussi ; sans source, aucun fait protégé", () => {
    const long = `${"Une phrase établie. ".repeat(80)}`.trim();
    expect(establishedFactsBudget({ ...sheet("Max"), ce_que_tu_sais_aujourdhui: long }).overBudget).toBe(true);
    expect(establishedFactsBudget({ ...sheet("Max"), identite_fondamentale: "Tu es Max." }).source).toBe("none");
  });
});

describe("optimized_v3 core with established facts", () => {
  const build = (name: "Max" | "Emma", userMessage: string, establishedFacts?: boolean, historyChars = 0) =>
    buildOptimizedPromptAssembly({ character: sheet(name), characterName: sheet(name).name!, userMessage, historyChars, establishedFacts });

  it.each(["Max", "Emma"] as const)("protège le bloc de %s avant la voix, dans le même budget", (name) => {
    for (const historyChars of [0, OPTIMIZED_V3_LIMITS.memoryChars]) {
      const result = build(name, "Qu'est-ce qui s'est passé à la montagne ?", undefined, historyChars);
      const prompt = result.finalSystemPrompt;
      const facts = characterEstablishedFacts(sheet(name))!.content;
      // The usage line keeps the block from being read as a closed list.
      expect(prompt).toContain(`## ${ESTABLISHED_FACTS_TITLE}\n${ESTABLISHED_FACTS_USAGE_LINE}\n${facts}`);
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
    expect(before).not.toContain("Emma a donc été contaminée hier");
  });
});
