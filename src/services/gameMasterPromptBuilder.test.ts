import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG } from "@/services/experienceOrchestration";
import { buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";
import { EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "@/agents/gameMasterPRD4";

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

  it("a new draft carries the meaning-based video rule without a theme-only setting", () => {
    const prompt = buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, DEFAULT_DIRECTOR_CONFIG);
    expect(prompt).toContain('Règles "trigger_video_id" — choix au sens');
    expect(prompt).toContain("Cinématiques : autorisées lorsqu'une vidéo disponible rejoint le sens de l'échange");
    expect(prompt).not.toContain("lorsqu'un thème correspond");
  });
});
