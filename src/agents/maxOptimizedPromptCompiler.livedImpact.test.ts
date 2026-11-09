import { describe, expect, it } from "vitest";
import sheets from "./__fixtures__/speechSandbox20261109.json";
import {
  buildOptimizedPromptAssembly,
  LIVED_IMPACT_TITLE,
  OPTIMIZED_V3_LIMITS,
  PRESENT_TITLE,
  RAG_USAGE_LINE,
} from "./maxOptimizedPromptCompiler";
import { characterLivedImpact } from "@/services/characterEmbodiment";
import type { CharacterPrompt } from "@/services/characterPromptService";

const asPrompt = (row: (typeof sheets)[number]) => row as unknown as CharacterPrompt;

// Sandbox sheets as synced on 29 October 2026 (read-only copy of the Notion fields).
describe("optimized_v3 — ce que ça te fait (parole sous le choc)", () => {
  const cases = sheets.flatMap(row => [0, OPTIMIZED_V3_LIMITS.memoryChars].map(historyChars => ({ row, historyChars })));

  it.each(cases)("protège le vécu de $row.name avant les repères ($historyChars caractères d'historique)", ({ row, historyChars }) => {
    const sheet = asPrompt(row);
    const lived = characterLivedImpact(sheet);
    expect(lived?.field).toBe("dynamique_conversation");
    expect(lived?.content.startsWith("Ce que tu cherches dans cet appel")).toBe(true);
    const result = buildOptimizedPromptAssembly({
      character: sheet, characterName: sheet.name!, userMessage: "Qu'est-ce qui s'est passé à la montagne ?", historyChars,
    });
    const prompt = result.finalSystemPrompt;
    expect(prompt).toContain(`## ${LIVED_IMPACT_TITLE}\n${lived!.content}`);
    expect(prompt).toContain(`## ${PRESENT_TITLE}\n${sheet.situation_summary.trim()}`);
    expect(prompt.indexOf(LIVED_IMPACT_TITLE)).toBeLessThan(prompt.indexOf(PRESENT_TITLE));
    // Paid once: the lived paragraph is not selected again as a relevance fragment.
    expect(prompt.split(lived!.content.split("\n")[2]).length - 1).toBe(1);
    expect(result.budget?.withinBudget).toBe(true);
    expect(result.budget?.staticChars).toBeLessThanOrEqual(result.budget!.staticLimitChars);
  });

  it("présente les souvenirs comme du vécu, sans l'en-tête d'archive", () => {
    const sheet = asPrompt(sheets.find(row => row.name === "Max Lorenzo")!);
    const result = buildOptimizedPromptAssembly({
      character: sheet, characterName: sheet.name!, userMessage: "Et le fusil ?", historyChars: 0,
      ragCandidates: [{ id: "fusil", rank: 1, content: "Personnage: Max Lorenzo | Archétype: Le Protecteur | Partie 3/9\nLe fusil pesait plus lourd que dans mon souvenir." }],
    });
    const section = result.finalSystemPrompt.split("# SOUVENIRS COMPLÉMENTAIRES\n")[1];
    expect(section.startsWith(RAG_USAGE_LINE)).toBe(true);
    expect(section).toContain("Le fusil pesait plus lourd que dans mon souvenir.");
    expect(section).not.toContain("Personnage:");
    expect(section).not.toContain("Archétype");
  });

  it("ne crée aucune section quand aucun souvenir n'est retenu", () => {
    const sheet = asPrompt(sheets[0]);
    const result = buildOptimizedPromptAssembly({ character: sheet, characterName: sheet.name!, userMessage: "Allô ?", historyChars: 0 });
    expect(result.finalSystemPrompt).not.toContain(RAG_USAGE_LINE);
  });

  it.each(sheets.map(row => ({ row })))("garde le cadre commun de $row.name au pire cas d'historique", ({ row }) => {
    const sheet = asPrompt(row);
    const frame = "Cadre commun de l'appel. ".repeat(56).trim();
    const result = buildOptimizedPromptAssembly({
      character: sheet, characterName: sheet.name!, userMessage: "Qu'est-ce qui s'est passé à la montagne ?",
      historyChars: 1_200, experienceFrame: frame,
      ragCandidates: [1, 2, 3].map(rank => ({ id: String(rank), rank, content: "Souvenir long. ".repeat(130) })),
    });
    expect(result.finalSystemPrompt).toContain(frame);
    // Never a lonely usage line without any souvenir.
    expect(result.finalSystemPrompt.includes(RAG_USAGE_LINE)).toBe(/Souvenir 1\n/.test(result.finalSystemPrompt));
  });

  it("reprend « Ce que tu vis aujourd'hui » des anciennes fiches", () => {
    const sheet = { ...asPrompt(sheets[0]), dynamique_conversation: "L'ARC D'ESPOIR\n- Être aidé.", qui_tu_es: "Résumé narratif\nTexte.\n\nCe que tu vis aujourd'hui\nLa peur prend toute la place." };
    expect(characterLivedImpact(sheet)).toEqual({ field: "qui_tu_es", content: "Ce que tu vis aujourd'hui\nLa peur prend toute la place." });
  });
});
