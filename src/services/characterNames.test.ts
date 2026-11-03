import { describe, expect, it } from "vitest";
import { CANONICAL_CHARACTER_NAMES, CHARACTER_NAME_RULE, normalizeCharacterNames } from "./characterNames";

describe("normalizeCharacterNames", () => {
  it.each([
    ["Eva m'a dit de venir.", "Ava m'a dit de venir."],
    ["Éva, tu m'entends ?", "Ava, tu m'entends ?"],
    ["C'est Evah qui parle.", "C'est Ava qui parle."],
    ["Pour EVA.", "Pour AVA."],
    ["« Eva » est partie.", "« Ava » est partie."],
    ["Tu demandes Eva… et Ema ?", "Tu demandes Ava… et Emma ?"],
  ])("corrige %s", (input, expected) => {
    expect(normalizeCharacterNames(input)).toBe(expected);
  });

  it.each([
    "Ava est là, Max aussi, Emma et Léo.",
    "Je cherche l'évacuation.",
    "Une évaluation, Evans, Evan, Eve.",
    "Emmanuel et Emmaüs.",
    "",
  ])("laisse intact %s", (input) => {
    expect(normalizeCharacterNames(input)).toBe(input);
  });

  it("est idempotent", () => {
    const once = normalizeCharacterNames("Eva et Ema");
    expect(normalizeCharacterNames(once)).toBe(once);
  });

  it("garde les noms canoniques et la règle de prompt cohérents", () => {
    for (const name of CANONICAL_CHARACTER_NAMES) expect(CHARACTER_NAME_RULE).toContain(name);
    expect(CHARACTER_NAME_RULE).toMatch(/jamais Eva/);
  });
});
