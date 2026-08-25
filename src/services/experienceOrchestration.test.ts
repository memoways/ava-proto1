import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "./experienceOrchestration";

describe("normalizeDirectorConfig", () => {
  it("clamps numeric values and resets constrained fields", () => {
    const result = normalizeDirectorConfig({
      minimumHandoffTurn: 99,
      maximumHandoffsPerSession: 7,
      handoffTarget: "emma" as never,
      directorTimeoutMs: 100,
      editor: {
        ...DEFAULT_DIRECTOR_CONFIG.editor,
        customInstructions: "  Keep the answer short.  ",
      },
    });

    expect(result.minimumHandoffTurn).toBe(20);
    expect(result.maximumHandoffsPerSession).toBe(7);
    expect(result.handoffTarget).toBe("either");
    expect(result.minimumTurnsBetweenHandoffs).toBe(2);
    expect(result.directorTimeoutMs).toBe(3_000);
    expect(result.editor.customInstructions).toBe("Keep the answer short.");
  });

  it("restores editor defaults when priorities are invalid or empty", () => {
    const invalidPriorities = ["pace", "invented", "player_engagement"] as Array<
      "narrative_continuity" | "player_engagement" | "safety" | "pace" | "invented"
    >;

    expect(normalizeDirectorConfig({
      editor: {
        ...DEFAULT_DIRECTOR_CONFIG.editor,
        priorities: invalidPriorities as typeof DEFAULT_DIRECTOR_CONFIG.editor.priorities,
      },
    }).editor.priorities).toEqual(["pace", "player_engagement"]);

    expect(normalizeDirectorConfig({
      editor: {
        ...DEFAULT_DIRECTOR_CONFIG.editor,
        priorities: [] as typeof DEFAULT_DIRECTOR_CONFIG.editor.priorities,
      },
    }).editor.priorities).toEqual(DEFAULT_DIRECTOR_CONFIG.editor.priorities);
  });
});
