/**
 * Lot H — one written hierarchy of instructions, lived radar texts, provenance
 * of every layer, evaluation switches. Pure: no model call.
 */
import { describe, expect, it } from "vitest";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";
import { buildOptimizedPromptAssembly, INSTRUCTION_HIERARCHY, INSTRUCTION_HIERARCHY_TITLE } from "./maxOptimizedPromptCompiler";
import {
  RECOMMENDED_STATE_BOUNDS, STATE_AXES, STATE_LEVEL_TEXT, STATE_LEVEL_TEXT_LIVED, buildGmStateSection,
  compileCharacterStateBlock, normalizeStateProfile, type CharacterStateProfile, type StateLevel,
} from "@/services/characterState";
import { CHARACTER_LAYER_PROVENANCE, describeCharacterPromptLayers } from "@/services/characterPromptLayers";
import { parseSnapshotOverrides } from "@/services/evalJudgePipeline";

const sheet = makeNotionMaxPrompt();
const profile = normalizeStateProfile({}) as CharacterStateProfile;
const levels = { combativite: 5, initiative: 5, lucidite: 5, ouverture: 5, agitation: 3 };

const build = (characterState?: string) => buildOptimizedPromptAssembly({
  character: sheet, characterName: "Max", userMessage: "Alors ?", historyChars: 0,
  speechState: "Rugosité réglée.", characterState, experienceFrame: "Cadre de l'appel : tu es chez toi.",
});

describe("instruction hierarchy at the head of the character prompt", () => {
  it("is written once, right after the identity and before the sheet", () => {
    const prompt = build().finalSystemPrompt;
    expect(prompt.split(INSTRUCTION_HIERARCHY_TITLE)).toHaveLength(2);
    const at = prompt.indexOf(INSTRUCTION_HIERARCHY_TITLE);
    expect(at).toBeGreaterThan(prompt.indexOf("IDENTITÉ ACTIVE"));
    expect(at).toBeLessThan(prompt.indexOf("# NOYAU DE"));
    expect(at).toBeLessThan(prompt.indexOf("CADRE DE L'APPEL"));
  });

  it("orders facts > frame > app state > turn speech and fixes the radar rule", () => {
    const text = INSTRUCTION_HIERARCHY;
    const order = ["faits de ta fiche", "cadre de l'appel", "état donné par l'application", "parole du tour"].map((part) => text.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain("jamais la vérité de ce que tu sais ni le registre de ta parole");
  });

  it("does not make the total context lose room for the frame (worst case history)", () => {
    const trace = build();
    expect(trace.budget?.withinBudget).toBe(true);
    expect(trace.finalSystemPrompt).toContain("Cadre de l'appel : tu es chez toi.");
  });
});

describe("radar texts", () => {
  const BANNED = [/nommes? les contradictions/i, /\btu cadres\b/i, /sans filtre/i, /tranchante/i, /repères les incohérences/i, /décides du prochain sujet/i];

  it("lived texts keep five axes × six levels and contain no cognition wording", () => {
    for (const axis of STATE_AXES) {
      for (const level of [0, 1, 2, 3, 4, 5] as StateLevel[]) {
        const text = STATE_LEVEL_TEXT_LIVED[axis][level];
        expect(text.length).toBeGreaterThan(10);
        for (const banned of BANNED) expect(text).not.toMatch(banned);
      }
    }
  });

  it("legacy texts are unchanged (no silent change before Romed validates)", () => {
    const legacy = compileCharacterStateBlock(levels, profile);
    expect(legacy).toContain(STATE_LEVEL_TEXT.lucidite[5]);
    expect(legacy).toContain("tu nommes les contradictions");
  });

  it("lived texts are played only with the profile flag or an evaluation override", () => {
    expect(normalizeStateProfile({})?.livedTexts).toBeUndefined();
    const flagged = normalizeStateProfile({ livedTexts: true }) as CharacterStateProfile;
    expect(compileCharacterStateBlock(levels, flagged)).toContain(STATE_LEVEL_TEXT_LIVED.lucidite[5]);
    expect(compileCharacterStateBlock(levels, flagged)).not.toContain("nommes les contradictions");
    expect(compileCharacterStateBlock(levels, profile, "lived")).toContain(STATE_LEVEL_TEXT_LIVED.ouverture[5]);
    expect(compileCharacterStateBlock(levels, flagged, "legacy")).toContain(STATE_LEVEL_TEXT.ouverture[5]);
  });

  it("the block states that the radar never sets truth nor register", () => {
    const block = compileCharacterStateBlock(levels, profile);
    expect(block).toContain("jamais la vérité de ce que tu sais ni le registre de ta parole");
  });

  it("the proposed Max bounds exist and stay inside the 0-5 scale", () => {
    expect(RECOMMENDED_STATE_BOUNDS.max.max).toEqual({ lucidite: 3, ouverture: 4 });
  });

  it("the GM makes one decision per turn: speech state coherent with the radar", () => {
    const section = buildGmStateSection({ levels, profile, characterKey: "max", turnIndex: 2 });
    expect(section).toContain("une seule décision par tour");
    expect(section).toContain("next_speech_state");
  });
});

describe("provenance of each layer", () => {
  it("every section of a full assembly has a known provenance", () => {
    const trace = build("- Lucidité : tu es présent.");
    const rows = describeCharacterPromptLayers(trace);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) expect(CHARACTER_LAYER_PROVENANCE[row.key], row.key).toBeDefined();
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.character_core.rank).toBe(1);
    expect(byKey.experience_frame.rank).toBe(2);
    expect(byKey.character_state.rank).toBe(3);
    expect(byKey.speech_state.rank).toBe(4);
    expect(byKey.character_state.included).toBe(true);
  });

  it("keeps archived traces readable and exposes an unregistered future layer without hiding its budget state", () => {
    expect(describeCharacterPromptLayers({})).toEqual([]);

    expect(describeCharacterPromptLayers({ budget: {
      sections: [{
        key: "future_layer", title: "Couche ajoutée plus tard", chars: 0, originalChars: 24,
        included: false, truncated: true, omissionReason: "budget",
      }],
    } } as Parameters<typeof describeCharacterPromptLayers>[0])).toEqual([{
      key: "future_layer", title: "Couche ajoutée plus tard", label: "Couche ajoutée plus tard",
      source: "Source non référencée", rank: 5, included: false, chars: 0, originalChars: 24,
      truncated: true, omissionReason: "budget",
    }]);
  });
});

describe("evaluation switches (memory only)", () => {
  it("parses intellectualReferences and radarTexts, rejects other values", () => {
    expect(parseSnapshotOverrides('{"intellectualReferences": false, "radarTexts": "lived"}'))
      .toEqual({ overrides: { intellectualReferences: false, radarTexts: "lived" }, errors: [] });
    expect(parseSnapshotOverrides('{"radarTexts": "x"}').errors).toHaveLength(1);
    expect(parseSnapshotOverrides('{"intellectualReferences": "no"}').errors).toHaveLength(1);
  });
});
