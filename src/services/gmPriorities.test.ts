import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "@/services/experienceOrchestration";
import { compileGmSettingsBlock } from "@/services/gameMasterPromptBuilder";
import {
  PRIORITY_KEYS,
  PRIORITY_LEVEL_TEXT,
  PRIORITY_SAFETY_FLOOR,
  arbitrationRule,
  normalizePriorityLevels,
  priorityLevelsFragment,
} from "@/services/gmPriorities";
import { settingFragments } from "@/services/gmSettingsRegistry";
import { parseSnapshotOverrides } from "@/services/evalJudgePipeline";
import type { ExperienceDirectorConfig } from "@/types";

const withLevels = (priorityLevels: Record<string, number>) =>
  normalizeDirectorConfig({
    ...DEFAULT_DIRECTOR_CONFIG,
    editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, priorityLevels } as ExperienceDirectorConfig["editor"],
  });

describe("normalizePriorityLevels", () => {
  it("reads the legacy checkbox list: checked → 2, unchecked → 0, safety kept at its floor", () => {
    expect(normalizePriorityLevels(undefined, ["pace", "player_engagement"])).toEqual({
      narrative_continuity: 0, player_engagement: 2, safety: PRIORITY_SAFETY_FLOOR, pace: 2,
    });
    expect(normalizePriorityLevels(undefined, ["narrative_continuity", "player_engagement", "safety", "pace"])).toEqual({
      narrative_continuity: 2, player_engagement: 2, safety: 2, pace: 2,
    });
  });

  it("defaults to level 2 everywhere when nothing is stored (every published version today)", () => {
    expect(normalizePriorityLevels(undefined, undefined)).toEqual({
      narrative_continuity: 2, player_engagement: 2, safety: 2, pace: 2,
    });
    expect(normalizePriorityLevels(undefined, [])).toEqual(normalizePriorityLevels(undefined, undefined));
  });

  it("lets priorityLevels win over the legacy list, clamps and rounds, and floors safety at 1", () => {
    expect(normalizePriorityLevels(
      { narrative_continuity: 9, player_engagement: -3, safety: 0, pace: 1.6 },
      ["pace"],
    )).toEqual({ narrative_continuity: 3, player_engagement: 0, safety: 1, pace: 2 });
    expect(normalizePriorityLevels({ pace: "3", safety: "x" }, undefined)).toEqual({
      narrative_continuity: 2, player_engagement: 2, safety: 2, pace: 3,
    });
  });
});

describe("normalizeDirectorConfig — priority levels (lot B)", () => {
  it("bumps schemaVersion, exposes priorityLevels and never writes the legacy list back", () => {
    const config = normalizeDirectorConfig({ editor: { priorities: ["pace"] } as unknown as ExperienceDirectorConfig["editor"] });
    expect(config.schemaVersion).toBe(2);
    expect(DEFAULT_DIRECTOR_CONFIG.schemaVersion).toBe(2);
    expect(config.editor.priorityLevels).toEqual({ narrative_continuity: 0, player_engagement: 0, safety: 1, pace: 2 });
    expect(config.editor).not.toHaveProperty("priorities");
    expect(DEFAULT_DIRECTOR_CONFIG.editor.priorityLevels).toEqual({
      narrative_continuity: 2, player_engagement: 2, safety: 2, pace: 2,
    });
  });
});

describe("priorityLevelsFragment", () => {
  it("keeps the historical text byte for byte when every axis is at level 2", () => {
    expect(priorityLevelsFragment(DEFAULT_DIRECTOR_CONFIG)).toBe(
      "Priorités à appliquer :\n"
      + "- continuité narrative et cohérence des faits\n"
      + "- engagement du joueur et qualité de l'échange\n"
      + "- sécurité, modération charitable et limites du personnage\n"
      + "- rythme, progression et clôture naturelle dans le temps disponible",
    );
  });

  it("has a distinct, non-empty text for every axis and every level 1–3", () => {
    for (const key of PRIORITY_KEYS) {
      const texts = [1, 2, 3].map((level) => PRIORITY_LEVEL_TEXT[key][level as 1 | 2 | 3]);
      for (const text of texts) expect(text.trim()).not.toBe("");
      expect(new Set(texts).size).toBe(3);
    }
  });

  it("omits an ignored axis and marks light and top priorities", () => {
    const text = priorityLevelsFragment(withLevels({ narrative_continuity: 0, player_engagement: 1, safety: 2, pace: 3 }));
    expect(text).not.toContain(PRIORITY_LEVEL_TEXT.narrative_continuity[2]);
    expect(text).toContain(PRIORITY_LEVEL_TEXT.player_engagement[1]);
    expect(text).toContain(PRIORITY_LEVEL_TEXT.pace[3]);
  });

  it("adds the arbitration rule only when levels differ, highest first, ties by fixed axis order", () => {
    expect(arbitrationRule({ narrative_continuity: 2, player_engagement: 2, safety: 2, pace: 2 })).toBe("");
    expect(arbitrationRule({ narrative_continuity: 0, player_engagement: 2, safety: 2, pace: 0 })).toBe("");
    const rule = arbitrationRule({ narrative_continuity: 2, player_engagement: 1, safety: 3, pace: 3 });
    expect(rule).toBe(
      "En cas de conflit entre ces priorités, applique d'abord : sécurité (3), puis rythme (3), puis continuité narrative (2), puis engagement du joueur (1).",
    );
    const text = priorityLevelsFragment(withLevels({ narrative_continuity: 2, player_engagement: 1, safety: 3, pace: 3 }));
    expect(text.endsWith(rule)).toBe(true);
  });

  it("never lets safety be cut: level 0 is read as the floor", () => {
    const config = withLevels({ narrative_continuity: 3, player_engagement: 3, safety: 0, pace: 3 });
    expect(config.editor.priorityLevels.safety).toBe(PRIORITY_SAFETY_FLOOR);
    expect(priorityLevelsFragment(config)).toContain(PRIORITY_LEVEL_TEXT.safety[1]);
  });
});

describe("registry and compiled GM block", () => {
  it("previews the exact fragment and the compiled block carries it", () => {
    const config = withLevels({ narrative_continuity: 3, player_engagement: 0, safety: 2, pace: 1 });
    const [fragment] = settingFragments("priorities", config);
    expect(fragment.destination).toBe("gm_prompt");
    expect(fragment.text).toBe(priorityLevelsFragment(config));
    for (const line of fragment.text.split("\n")) expect(compileGmSettingsBlock(config)).toContain(line);
  });

  it("changes the compiled block between two contrasted profiles", () => {
    const pace = compileGmSettingsBlock(withLevels({ narrative_continuity: 0, player_engagement: 0, safety: 1, pace: 3 }));
    const story = compileGmSettingsBlock(withLevels({ narrative_continuity: 3, player_engagement: 3, safety: 1, pace: 0 }));
    expect(pace).not.toBe(story);
  });
});

describe("evaluation snapshot", () => {
  it("accepts priorityLevels and reports invalid ones", () => {
    expect(parseSnapshotOverrides('{"priorityLevels":{"pace":3,"safety":1}}').overrides.priorityLevels)
      .toEqual({ narrative_continuity: 2, player_engagement: 2, safety: 1, pace: 3 });
    expect(parseSnapshotOverrides('{"priorityLevels":"fort"}').errors).toHaveLength(1);
    expect(parseSnapshotOverrides('{"priorityLevels":{"pace":7}}').errors).toHaveLength(1);
  });
});
