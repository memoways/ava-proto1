import { describe, it, expect } from "vitest";
import { SPEECH_MODES, getSpeechMode, listSpeechModeIds } from "@/services/speechModes";

describe("speechModes catalog", () => {
  it("expose les 6 modes du plan éditorial", () => {
    expect(SPEECH_MODES).toHaveLength(6);
    expect(listSpeechModeIds()).toEqual(
      expect.arrayContaining([
        "ferme_mefiant",
        "testeur",
        "fragile",
        "accusateur",
        "confiant",
        "revelateur_partiel",
      ])
    );
  });

  it("résout un mode par id ou par label insensible à la casse", () => {
    expect(getSpeechMode("testeur")?.label).toBe("Testeur");
    expect(getSpeechMode("Fragile")?.id).toBe("fragile");
    expect(getSpeechMode("inconnu")).toBeUndefined();
    expect(getSpeechMode(null)).toBeUndefined();
  });

  it("chaque mode a au moins 2 indices de style", () => {
    for (const mode of SPEECH_MODES) {
      expect(mode.styleHints.length).toBeGreaterThanOrEqual(2);
      expect(mode.description).toBeTruthy();
    }
  });
});
