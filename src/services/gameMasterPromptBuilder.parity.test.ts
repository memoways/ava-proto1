import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "@/services/experienceOrchestration";
import { buildExperienceDirectorPrompt } from "@/services/gameMasterPromptBuilder";

// Pins the exact text compiled before the settings registry existed: the
// registry must reproduce it byte for byte (lot A, no rewording).
const CASES = {
  defaults: DEFAULT_DIRECTOR_CONFIG,
  contrasted: normalizeDirectorConfig({
    ...DEFAULT_DIRECTOR_CONFIG,
    minimumHandoffTurn: 6,
    maximumHandoffsPerSession: 3,
    minimumTurnsBetweenHandoffs: 4,
    editor: {
      ...DEFAULT_DIRECTOR_CONFIG.editor,
      tone: "directive",
      guidanceLength: "short",
      priorityLevels: { narrative_continuity: 0, player_engagement: 0, safety: 2, pace: 2 },
      allowCinematics: false,
      customInstructions: "Ne jamais presser le joueur.",
      handoffRules: [{ targetCharacter: "emma", themes: ["famille"], topics: ["enfance"] }],
      projectContext: "",
      openQuestions: [],
      guardrails: { falseStatusGuidance: false, derailTolerance: "low", opennessPace: "fast" },
    },
  }),
  handoffsOff: normalizeDirectorConfig({
    ...DEFAULT_DIRECTOR_CONFIG,
    maximumHandoffsPerSession: 0,
    editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, allowHandoffs: false, tone: "discreet", guidanceLength: "detailed",
      guardrails: { falseStatusGuidance: true, derailTolerance: "high", opennessPace: "slow" } },
  }),
};

describe("buildExperienceDirectorPrompt parity", () => {
  it.each(Object.entries(CASES))("keeps the historical text for %s", (_name, config) => {
    expect(buildExperienceDirectorPrompt("BASE", config)).toMatchSnapshot();
  });
});
