import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
  streamLLM: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getLLMSettings: vi.fn(),
  getAntiHallucinationValidatorSettings: vi.fn(),
}));
vi.mock("@/services/characterPromptService", () => ({
  buildCharacterPromptSections: vi.fn(),
  loadCharacterPromptByName: vi.fn(),
  clearCharacterPromptCache: vi.fn(),
}));

import { buildGmGuidanceBlock, buildTemporalContextBlock } from "./maxAgent";

describe("buildTemporalContextBlock — repères temporels de Max", () => {
  it("décrit le début d'appel sous 25% de la durée", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 45,
      sessionDurationSeconds: 600,
      turnIndex: 1,
    });
    expect(block).toContain("moins d'une minute");
    expect(block).toContain("1e tour de parole");
    expect(block).toContain("Début de l'appel");
    expect(block).toContain("ne jamais citer ces chiffres");
  });

  it("décrit le milieu d'appel entre 25% et 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 300,
      sessionDurationSeconds: 600,
      turnIndex: 7,
    });
    expect(block).toContain("environ 5 minutes");
    expect(block).toContain("Milieu de l'appel");
  });

  it("annonce la fin d'appel au-delà de 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 550,
      sessionDurationSeconds: 600,
      turnIndex: 14,
    });
    expect(block).toContain("approche de sa fin");
  });

  it("reste borné avec des entrées dégénérées", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: -10,
      sessionDurationSeconds: 0,
      turnIndex: 1,
    });
    expect(block).toContain("moins d'une minute");
    expect(block).toContain("Début de l'appel");
  });
});

describe("buildGmGuidanceBlock — boucle GM→Max", () => {
  it("injecte la guidance comme note interne avec rappel de priorité de la fiche", () => {
    const block = buildGmGuidanceBlock({ guidance: "Laisse un silence, puis évoque Emma." });
    expect(block).toContain("CONSEIL DE MISE EN SCÈNE");
    expect(block).toContain("Laisse un silence, puis évoque Emma.");
    expect(block).toContain("fiche personnage reste prioritaire");
  });

  it("liste les sujets déjà couverts, plafonnés à 12", () => {
    const topics = Array.from({ length: 15 }, (_, i) => `sujet-${i + 1}`);
    const block = buildGmGuidanceBlock({ guidance: "Continue.", topicsCovered: topics });
    expect(block).toContain("sujet-1");
    expect(block).toContain("sujet-12");
    expect(block).not.toContain("sujet-13");
  });

  it("ignore les sujets vides et n'ajoute pas la ligne quand il n'y en a aucun", () => {
    const block = buildGmGuidanceBlock({ guidance: "Continue.", topicsCovered: ["", "  "] });
    expect(block).not.toContain("Sujets déjà abordés");
  });
});
