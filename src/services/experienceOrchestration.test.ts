import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "./experienceOrchestration";
import { isCharacterTimeCuesEnabled } from "./characterTimeCues";

describe("normalizeDirectorConfig", () => {
  it("clamps numeric values and resets constrained fields", () => {
    const result = normalizeDirectorConfig({
      // Legacy versions stored a dead handoffTarget: tolerated, then dropped.
      ...({ handoffTarget: "emma" } as object),
      minimumHandoffTurn: 99,
      maximumHandoffsPerSession: 7,
      directorTimeoutMs: 100,
      editor: {
        ...DEFAULT_DIRECTOR_CONFIG.editor,
        customInstructions: "  Keep the answer short.  ",
      },
    });

    expect(result.minimumHandoffTurn).toBe(20);
    expect(result.maximumHandoffsPerSession).toBe(7);
    expect(result).not.toHaveProperty("handoffTarget");
    expect(result.minimumTurnsBetweenHandoffs).toBe(2);
    expect(result.directorTimeoutMs).toBe(3_000);
    expect(result.editor.customInstructions).toBe("Keep the answer short.");
  });

  it("reads invalid or empty legacy priorities without crashing", () => {
    const invalidPriorities = ["pace", "invented", "player_engagement"];
    expect(normalizeDirectorConfig({
      editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, priorityLevels: undefined, priorities: invalidPriorities } as never,
    }).editor.priorityLevels).toEqual({ narrative_continuity: 0, player_engagement: 2, safety: 1, pace: 2 });

    expect(normalizeDirectorConfig({
      editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, priorityLevels: undefined, priorities: [] } as never,
    }).editor.priorityLevels).toEqual(DEFAULT_DIRECTOR_CONFIG.editor.priorityLevels);
  });
});

describe("normalizeDirectorConfig — lot A", () => {
  it("keeps the character time cues on unless explicitly turned off", () => {
    expect(normalizeDirectorConfig({}).editor.characterTimeCues).toBe(true);
    expect(normalizeDirectorConfig({ editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, characterTimeCues: undefined as never } }).editor.characterTimeCues).toBe(true);
    expect(normalizeDirectorConfig({ editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, characterTimeCues: false } }).editor.characterTimeCues).toBe(false);
    expect(isCharacterTimeCuesEnabled(null)).toBe(true);
    expect(isCharacterTimeCuesEnabled(normalizeDirectorConfig({ editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, characterTimeCues: false } }))).toBe(false);
  });

  it("normalizes the builtin baseline config stored for sandbox-romed and sandbox-benoit", () => {
    const config = normalizeDirectorConfig({ handoffTarget: "emma", schemaVersion: 1, directorTimeoutMs: 12000,
      minimumHandoffTurn: 4, maximumHandoffsPerSession: 1 } as never);
    expect(config).not.toHaveProperty("handoffTarget");
    expect(config.maximumHandoffsPerSession).toBe(1);
    expect(config.editor).toEqual({ ...DEFAULT_DIRECTOR_CONFIG.editor, characterTimeCues: true });
  });
});
