import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG } from "@/services/experienceOrchestration";
import { buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";

describe("buildExperienceDirectorPrompt", () => {
  it("materializes structured settings in the generated prompt", () => {
    const prompt = buildExperienceDirectorPrompt("BASE", {
      ...DEFAULT_DIRECTOR_CONFIG,
      minimumHandoffTurn: 6,
      editor: {
        ...DEFAULT_DIRECTOR_CONFIG.editor,
        tone: "directive",
        allowCinematics: false,
        customInstructions: "Ne jamais presser le joueur.",
      },
    });

    expect(prompt).toContain("Directif");
    expect(prompt).toContain("à partir du tour 6");
    expect(prompt).toContain("Cinématiques : désactivées");
    expect(prompt).toContain("Ne jamais presser le joueur.");
  });
});
