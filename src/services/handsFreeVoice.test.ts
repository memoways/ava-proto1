import { describe, expect, it } from "vitest";
import {
  endOfSpeechDelayMs,
  isHesitantEnding,
  joinUtteranceParts,
  normalizeHandsFreeSettings,
  shouldBargeIn,
} from "./handsFreeVoice";

const on = normalizeHandsFreeSettings({ enabled: true, endOfSpeechMs: 900, hesitationExtraMs: 700, bargeInMinWords: 2 });

describe("hands-free voice", () => {
  it("is off by default and clamps the silence window to 300–3000 ms", () => {
    expect(normalizeHandsFreeSettings(undefined).enabled).toBe(false);
    expect(normalizeHandsFreeSettings({ endOfSpeechMs: 20 }).endOfSpeechMs).toBe(300);
    expect(normalizeHandsFreeSettings({ endOfSpeechMs: 9000 }).endOfSpeechMs).toBe(3000);
  });

  it("waits longer when the player hesitates", () => {
    expect(isHesitantEnding("Je voulais vous dire que euh")).toBe(true);
    expect(isHesitantEnding("Je pense à Ava et")).toBe(true);
    expect(isHesitantEnding("Bonjour,")).toBe(true);
    expect(isHesitantEnding("Comment allez-vous ?")).toBe(false);
    expect(endOfSpeechDelayMs("Je pense que", on)).toBe(1600);
    expect(endOfSpeechDelayMs("Bonjour Max.", on)).toBe(900);
  });

  it("interrupts only with enough words that are not the character's own echo", () => {
    const max = "Je ne sais pas où est Ava, personne ne me dit rien.";
    expect(shouldBargeIn("Attendez", max, on)).toBe(false);
    expect(shouldBargeIn("Attendez Max, une seconde", max, on)).toBe(true);
    expect(shouldBargeIn("où est Ava personne", max, on)).toBe(false);
    expect(shouldBargeIn("Attendez Max", max, { ...on, bargeInEnabled: false })).toBe(false);
  });

  it("chains provider segments cut on a short pause into one spoken block", () => {
    const first = "Je sais pas peut-être que vous le savez, mais";
    const second = "la police est débordée, donc ils n'ont pas vraiment le temps";
    expect(joinUtteranceParts("", first)).toBe(first);
    expect(joinUtteranceParts(first, second)).toBe(`${first} ${second}`);
    expect(joinUtteranceParts(first, first)).toBe(first);
    expect(endOfSpeechDelayMs(first, on)).toBe(1600);
  });
});
