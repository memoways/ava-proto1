import { describe, expect, it } from "vitest";
import { buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";
import { normalizeDirectorConfig, PROJECT_CONTEXT_MAX_CHARS } from "@/services/experienceOrchestration";

describe("Game Master réglé dans l'app", () => {
  it("faux statut activé : le GM doit écrire une consigne pour le tour suivant", () => {
    const prompt = buildExperienceDirectorPrompt("BASE", normalizeDirectorConfig({}));
    expect(prompt).toMatch(/Faux statut[^\n]*next_turn_guidance/);
  });

  it("faux statut désactivé : aucune consigne demandée", () => {
    const config = normalizeDirectorConfig({ editor: { guardrails: { falseStatusGuidance: false } } } as never);
    expect(buildExperienceDirectorPrompt("BASE", config)).not.toMatch(/Faux statut[^\n]*next_turn_guidance/);
  });

  it("le contexte projet est limité en taille pour protéger la latence", () => {
    const config = normalizeDirectorConfig({ editor: { projectContext: "x".repeat(5000) } } as never);
    expect(config.editor.projectContext.length).toBe(PROJECT_CONTEXT_MAX_CHARS);
  });

  it("les questions ouvertes vides ne sont pas envoyées au GM", () => {
    const config = normalizeDirectorConfig({ editor: { openQuestions: ["", "Le joueur parle du film"] } } as never);
    const prompt = buildExperienceDirectorPrompt("BASE", config);
    expect(prompt).toContain("- Le joueur parle du film");
    expect(prompt).not.toMatch(/^- $/m);
  });

  it("anciennes versions sans réglages : valeurs par défaut", () => {
    const config = normalizeDirectorConfig({ editor: { tone: "discreet" } } as never);
    expect(config.editor.guardrails).toEqual({ falseStatusGuidance: true, derailTolerance: "medium", opennessPace: "balanced" });
    expect(config.editor.openQuestions.length).toBeGreaterThan(0);
  });
});
