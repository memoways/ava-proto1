import { describe, expect, it } from "vitest";
import {
  compileCharacterSections,
  condenseDepthSignatures,
  isFallbackGmGuidance,
  truncateAtSentenceBoundary,
} from "./maxPromptCompiler";
import type { CharacterPrompt } from "@/services/characterPromptService";

function makePrompt(overrides: Partial<CharacterPrompt> = {}): CharacterPrompt {
  return {
    character_id: "max",
    situation_summary: "Présent canonique.",
    timeline: "Hier, retour à Lausanne.",
    identite_fondamentale: "Max est père et journaliste.",
    qui_tu_es: "Voix posée.",
    ce_que_tu_ne_fais_jamais: "Ne pas inventer.",
    ce_que_tu_sais_utilisateur: "Un inconnu appelle.",
    dynamique_conversation: "Répondre directement.",
    sujets_sensibles: "Emma et Mona.",
    profondeur_par_niveau: "NIVEAU 1\nPosture analytique.\nNIVEAU 2\nPremière fissure.",
    ...overrides,
  };
}

describe("maxPromptCompiler", () => {
  it("conserve l'ordre déterministe des neuf champs et omet les champs vides", () => {
    const sections = compileCharacterSections(makePrompt({ sujets_sensibles: "" }));
    expect(sections.map((section) => section.key)).toEqual([
      "situation_summary",
      "timeline",
      "identite_fondamentale",
      "qui_tu_es",
      "ce_que_tu_ne_fais_jamais",
      "ce_que_tu_sais_utilisateur",
      "dynamique_conversation",
      "profondeur_par_niveau",
    ]);
  });

  it("tronque à une frontière de phrase", () => {
    const result = truncateAtSentenceBoundary(
      "Première phrase suffisamment longue. Deuxième phrase qui dépasse volontairement la limite.",
      55,
    );
    expect(result).toBe("Première phrase suffisamment longue.");
  });

  it("remplace les longues répliques de profondeur par une signature par niveau", () => {
    const depth = condenseDepthSignatures([
      "NIVEAU 1 — Surface",
      "Posture analytique et générale.",
      "> Une très longue réplique à ne pas injecter.",
      "NIVEAU 2 — Fissure",
      "Il applique enfin son analyse à ses actes.",
      "Réplique: encore un script à retirer.",
    ].join("\n"));
    expect(depth).toContain("NIVEAU 1");
    expect(depth).toContain("NIVEAU 2");
    expect(depth).not.toContain("longue réplique");
    expect(depth).not.toContain("encore un script");
  });

  it("détecte uniquement la guidance GM fallback", () => {
    expect(isFallbackGmGuidance("Continue la conversation naturellement.")).toBe(true);
    expect(isFallbackGmGuidance("Continue, puis reviens à Emma.")).toBe(false);
  });

  it("ne duplique pas dans la fiche les règles de cadence du contrat", () => {
    const sections = compileCharacterSections(makePrompt({
      dynamique_conversation: [
        "Tu reviens aux urgences concrètes.",
        "Tu poses au maximum une question tous les trois ou quatre échanges.",
      ].join("\n"),
      ce_que_tu_sais_utilisateur: "Ouverture de la conversation : demande son prénom.\nTu accueilles sa parole.",
    }));
    const rendered = sections.map((section) => section.content).join("\n");
    expect(rendered).not.toContain("trois ou quatre");
    expect(rendered).not.toContain("demande son prénom");
    expect(rendered).toContain("urgences concrètes");
    expect(rendered).toContain("accueilles sa parole");
  });
});
