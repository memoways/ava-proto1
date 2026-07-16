import { describe, expect, it } from "vitest";
import { buildGamilabTranscript, isMeaningfulGamilabTranscript } from "./gamilabTranscript";

describe("Gamilab transcript reconstruction", () => {
  it("rejects Gamilab activity placeholders as speech", () => {
    expect(isMeaningfulGamilabTranscript("… … ... …")).toBe(false);
    expect(buildGamilabTranscript("Je voulais vous parler", "… … … … …")).toBe("Je voulais vous parler");
  });

  it("keeps corrected history and the latest lexical live tail", () => {
    expect(buildGamilabTranscript(
      "Je voulais vous parler de Max",
      "et de la disparition d'Ava",
    )).toBe("Je voulais vous parler de Max et de la disparition d'Ava");
  });
});
