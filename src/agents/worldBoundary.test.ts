import { describe, expect, it } from "vitest";
import { WORLD_BOUNDARY_RULE } from "@/agents/worldBoundary";
import { OPTIMIZED_V3_CONVERSATION_CONTRACT } from "@/agents/maxOptimizedPromptCompiler";
import { RICH_V2_CONVERSATION_CONTRACT } from "@/agents/maxRichPromptCompiler";
import { EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "@/agents/gameMasterPRD4";
import { buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";
import { normalizeDirectorConfig } from "@/services/experienceOrchestration";

describe("cadrage du monde (hors-champ)", () => {
  it("la règle impose un refus en rôle, sans début de réponse, et un retour à la situation", () => {
    expect(WORLD_BOUNDARY_RULE).toMatch(/Refuse en une phrase, dans ta voix/);
    expect(WORLD_BOUNDARY_RULE).toMatch(/sans donner le moindre début de réponse/);
    expect(WORLD_BOUNDARY_RULE).toMatch(/pandémie/);
    expect(WORLD_BOUNDARY_RULE).toMatch(/une autre fois/);
  });

  it("les contrats rich_v2 et optimized_v3 embarquent la règle", () => {
    expect(RICH_V2_CONVERSATION_CONTRACT).toContain(WORLD_BOUNDARY_RULE);
    expect(OPTIMIZED_V3_CONVERSATION_CONTRACT).toContain(WORLD_BOUNDARY_RULE);
  });

  it("la règle reste courte pour ne pas rogner la fiche personnage ni ajouter de latence", () => {
    expect(WORLD_BOUNDARY_RULE.length).toBeLessThan(700);
  });

  it("le GM recadre via next_turn_guidance, sans fin d'appel au premier hors-sujet", () => {
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).toMatch(/hors-sujet/);
    const prompt = buildExperienceDirectorPrompt("BASE", normalizeDirectorConfig({}));
    expect(prompt).toMatch(/Hors-monde[^\n]*next_turn_guidance/);
    expect(prompt).toMatch(/pas un dérapage/);
  });
});
