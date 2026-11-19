import { describe, expect, it } from "vitest";
import {
  STATE_AXES,
  STATE_LEVEL_TEXT,
  buildGmStateSection,
  compileCharacterStateBlock,
  normalizeStateProfile,
  describeStateLevels,
  rebuildCharacterStates,
  stateSeriesByCharacter,
  resolveCharacterStateForTurn,
  validateStateDelta,
  type CharacterStateProfile,
  type StateLevels,
} from "@/services/characterState";

const levels = (v: Partial<StateLevels> = {}): StateLevels => ({
  combativite: 3, initiative: 3, lucidite: 3, ouverture: 3, agitation: 3, ...v,
});

const profile = (p: Partial<CharacterStateProfile> = {}): CharacterStateProfile => ({
  initial: levels(),
  min: levels({ combativite: 0, initiative: 0, lucidite: 0, ouverture: 0, agitation: 0 }),
  max: levels({ combativite: 5, initiative: 5, lucidite: 5, ouverture: 5, agitation: 5 }),
  gmCanEvolve: true,
  maxStepPerTurn: 1,
  ...p,
});

const expected = { characterKey: "max", turnIndex: 4 };
const delta = (changes: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  ({ characterKey: "max", sourceTurn: 4, changes, ...over });

describe("normalizeStateProfile", () => {
  it("returns null when nothing is configured (no block, behaviour unchanged)", () => {
    expect(normalizeStateProfile(null)).toBeNull();
    expect(normalizeStateProfile(undefined)).toBeNull();
    expect(normalizeStateProfile("x")).toBeNull();
    expect(normalizeStateProfile([])).toBeNull();
  });

  it("fills defaults and clamps values to 0–5 integers", () => {
    const p = normalizeStateProfile({ initial: { agitation: 9, ouverture: -2, lucidite: 2.6 } })!;
    expect(p.initial.agitation).toBe(5);
    expect(p.initial.ouverture).toBe(0);
    expect(p.initial.lucidite).toBe(3);
    expect(p.initial.combativite).toBe(3);
    expect(p.min.agitation).toBe(0);
    expect(p.max.agitation).toBe(5);
    expect(p.gmCanEvolve).toBe(true);
    expect(p.maxStepPerTurn).toBe(1);
  });

  it("keeps initial inside [min, max] and fixes an inverted range", () => {
    const p = normalizeStateProfile({
      initial: { combativite: 5, initiative: 0 },
      min: { combativite: 1, initiative: 2, lucidite: 4 },
      max: { combativite: 3, initiative: 4, lucidite: 1 },
    })!;
    expect(p.initial.combativite).toBe(3);
    expect(p.initial.initiative).toBe(2);
    expect(p.max.lucidite).toBeGreaterThanOrEqual(p.min.lucidite);
  });

  it("bounds maxStepPerTurn to 1–5 and reads gmCanEvolve strictly", () => {
    expect(normalizeStateProfile({ maxStepPerTurn: 0 })!.maxStepPerTurn).toBe(1);
    expect(normalizeStateProfile({ maxStepPerTurn: 99 })!.maxStepPerTurn).toBe(5);
    expect(normalizeStateProfile({ maxStepPerTurn: 2 })!.maxStepPerTurn).toBe(2);
    expect(normalizeStateProfile({ gmCanEvolve: false })!.gmCanEvolve).toBe(false);
  });

  it("keeps trimmed, bounded custom labels and drops the rest", () => {
    const p = normalizeStateProfile({ labels: { agitation: "  Nervosité ", ouverture: 4, lucidite: "x".repeat(80) } })!;
    expect(p.labels?.agitation).toBe("Nervosité");
    expect(p.labels?.ouverture).toBeUndefined();
    expect((p.labels?.lucidite ?? "").length).toBeLessThanOrEqual(24);
  });
});

describe("fragments by axis level", () => {
  it("has a distinct non-empty fragment for every axis and level 0–5", () => {
    for (const axis of STATE_AXES) {
      const texts = [0, 1, 2, 3, 4, 5].map((level) => STATE_LEVEL_TEXT[axis][level as 0]);
      expect(texts.every((t) => t.trim().length > 10)).toBe(true);
      expect(new Set(texts).size).toBe(6);
    }
  });

  it("compiles the character block from levels without leaking numbers", () => {
    const block = compileCharacterStateBlock(levels({ agitation: 5, ouverture: 0 }), profile());
    expect(block).toContain(STATE_LEVEL_TEXT.agitation[5]);
    expect(block).toContain(STATE_LEVEL_TEXT.ouverture[0]);
    expect(block).toContain("attitude");
    expect(block).not.toMatch(/\d\s*\/\s*5/);
  });

  it("changes the block when one axis changes by one level", () => {
    const a = compileCharacterStateBlock(levels(), profile());
    const b = compileCharacterStateBlock(levels({ initiative: 4 }), profile());
    expect(a).not.toBe(b);
  });

  it("uses custom labels in the heading of each line", () => {
    const block = compileCharacterStateBlock(levels(), profile({ labels: { agitation: "Nervosité" } }));
    expect(block).toContain("Nervosité");
  });
});

describe("resolveCharacterStateForTurn", () => {
  const logged = levels({ agitation: 5 });
  it("is null without profile (feature absent)", () => {
    expect(resolveCharacterStateForTurn({ profile: null, mode: "full", logged })).toBeNull();
  });
  it("mode off: fixed initial state, whatever was logged", () => {
    expect(resolveCharacterStateForTurn({ profile: profile(), mode: "off", logged })).toEqual(levels());
  });
  it("light and full keep the evolved state", () => {
    expect(resolveCharacterStateForTurn({ profile: profile(), mode: "light", logged })).toEqual(logged);
    expect(resolveCharacterStateForTurn({ profile: profile(), mode: "full", logged })).toEqual(logged);
  });
  it("falls back to initial when nothing is logged, and re-clamps a logged state to the bounds", () => {
    expect(resolveCharacterStateForTurn({ profile: profile(), mode: "full", logged: null })).toEqual(levels());
    const bounded = profile({ max: levels({ agitation: 4, combativite: 5, initiative: 5, lucidite: 5, ouverture: 5 }) });
    expect(resolveCharacterStateForTurn({ profile: bounded, mode: "full", logged }).agitation).toBe(4);
  });
  it("gmCanEvolve=false pins the initial state", () => {
    expect(resolveCharacterStateForTurn({ profile: profile({ gmCanEvolve: false }), mode: "full", logged })).toEqual(levels());
  });
});

describe("validateStateDelta", () => {
  it("applies a ±1 change and reports it", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 1, ouverture: -1 }), profile: profile(), current: levels(), expected });
    expect(r.next).toEqual(levels({ agitation: 4, ouverture: 2 }));
    expect(r.applied).toEqual({ agitation: 1, ouverture: -1 });
    expect(r.issues).toEqual([]);
  });

  it("clamps a step above maxStepPerTurn", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 3, lucidite: -4 }), profile: profile(), current: levels(), expected });
    expect(r.next.agitation).toBe(4);
    expect(r.next.lucidite).toBe(2);
    expect(r.issues).toContain("state_delta_step_clamped");
  });

  it("honours a larger maxStepPerTurn", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 2 }), profile: profile({ maxStepPerTurn: 2 }), current: levels(), expected });
    expect(r.next.agitation).toBe(5);
  });

  it("never leaves the min/max bounds", () => {
    const p = profile({ max: levels({ agitation: 4, combativite: 5, initiative: 5, lucidite: 5, ouverture: 5 }) });
    const r = validateStateDelta({ raw: delta({ agitation: 1 }), profile: p, current: levels({ agitation: 4 }), expected });
    expect(r.next.agitation).toBe(4);
    expect(r.applied.agitation).toBeUndefined();
    const low = validateStateDelta({ raw: delta({ ouverture: -1 }), profile: profile(), current: levels({ ouverture: 0 }), expected });
    expect(low.next.ouverture).toBe(0);
  });

  it("rejects a late result: wrong source turn", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 1 }, { sourceTurn: 3 }), profile: profile(), current: levels(), expected });
    expect(r.next).toEqual(levels());
    expect(r.issues).toContain("state_delta_wrong_turn");
  });

  it("rejects a delta that names another character", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 1 }, { characterKey: "emma" }), profile: profile(), current: levels(), expected });
    expect(r.next).toEqual(levels());
    expect(r.issues).toContain("state_delta_wrong_character");
  });

  it("ignores a missing/null delta without issue (field is optional)", () => {
    expect(validateStateDelta({ raw: undefined, profile: profile(), current: levels(), expected })).toMatchObject({ next: levels(), issues: [] });
    expect(validateStateDelta({ raw: null, profile: profile(), current: levels(), expected })).toMatchObject({ next: levels(), issues: [] });
  });

  it("rejects malformed shapes and non numeric values, keeps valid axes", () => {
    expect(validateStateDelta({ raw: "agitation+1", profile: profile(), current: levels(), expected }).issues).toContain("state_delta_invalid");
    const r = validateStateDelta({ raw: delta({ agitation: "up", ouverture: 1, inconnu: 1 }), profile: profile(), current: levels(), expected });
    expect(r.next.ouverture).toBe(4);
    expect(r.next.agitation).toBe(3);
    expect(r.issues).toEqual(expect.arrayContaining(["state_delta_invalid_value", "state_delta_unknown_axis"]));
  });

  it("is ignored when the GM may not evolve the state", () => {
    const r = validateStateDelta({ raw: delta({ agitation: 1 }), profile: profile({ gmCanEvolve: false }), current: levels(), expected });
    expect(r.next).toEqual(levels());
    expect(r.issues).toContain("state_delta_disabled");
  });
});

describe("buildGmStateSection", () => {
  it("shows current values, bounds, the step and the exact echo metadata", () => {
    const text = buildGmStateSection({ levels: levels({ agitation: 4 }), profile: profile({ maxStepPerTurn: 1 }), characterKey: "max", turnIndex: 4 });
    expect(text.startsWith("## ÉTAT DU PERSONNAGE")).toBe(true);
    expect(text).toContain("Agitation");
    expect(text).toContain("character_state_delta");
    expect(text).toContain('"sourceTurn":4');
    expect(text).toContain('"characterKey":"max"');
    expect(text).toContain("1");
  });

  it("is empty when the GM may not evolve the state", () => {
    expect(buildGmStateSection({ levels: levels(), profile: profile({ gmCanEvolve: false }), characterKey: "max", turnIndex: 4 })).toBe("");
  });
});

describe("rebuildCharacterStates", () => {
  it("keeps the latest valid state of each character and skips incomplete entries", () => {
    const log = [
      { character_key: "max", character_state_after: levels({ agitation: 4 }) },
      { character_key: "emma", character_state_after: levels({ ouverture: 1 }) },
      { character_key: "max", character_state_after: levels({ agitation: 5 }) },
      { character_key: "max", character_state_after: { agitation: 2 } },
      { character_key: "max" },
      null,
    ];
    const out = rebuildCharacterStates(log);
    expect(out.max.agitation).toBe(5);
    expect(out.emma.ouverture).toBe(1);
    expect(rebuildCharacterStates(undefined)).toEqual({});
  });
});

describe("history helpers", () => {
  it("builds one series per character from character_state_used, skipping entries without a state", () => {
    const log = [
      { character_key: "max", turn_index: 1, character_state_used: levels() },
      { character_key: "max", turn_index: 2, character_state_used: levels({ agitation: 4 }) },
      { character_key: "emma", turn_index: 3, character_state_used: levels({ ouverture: 0 }) },
      { character_key: "max", turn_index: 4 },
    ];
    const series = stateSeriesByCharacter(log);
    expect(series.max.map((p) => p.turn)).toEqual([1, 2]);
    expect(series.max[1].levels.agitation).toBe(4);
    expect(series.emma).toHaveLength(1);
    expect(stateSeriesByCharacter(null)).toEqual({});
  });

  it("reads a state on one line with the custom labels", () => {
    expect(describeStateLevels(levels({ agitation: 5 }))).toBe("Combativité 3 · Initiative 3 · Lucidité 3 · Ouverture 3 · Agitation 5");
    expect(describeStateLevels(levels(), { labels: { agitation: "Nervosité" } })).toContain("Nervosité 3");
  });
});
