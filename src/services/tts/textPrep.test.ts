import { describe, expect, it } from "vitest";
import { prepareTextForTTS } from "./textPrep";

describe("prepareTextForTTS character names", () => {
  it("never sends Eva to a provider: Ava, Emma, Max stay canonical", () => {
    expect(prepareTextForTTS("Max dit : Eva, Éva ou A.V.A. ? Emma sait.")).toBe("Max dit: Ava, Ava ou Ava? Emma sait.");
  });
});

describe("prepareTextForTTS Tavus Echo tags", () => {
  it("never reads an Echo emotion tag aloud", () => {
    expect(prepareTextForTTS('<emotion value="dejected"/> Je ne sais plus.')).toBe("Je ne sais plus.");
    expect(prepareTextForTTS("Avant. <emotion value='sad'/>Après.")).toBe("Avant. Après.");
    expect(prepareTextForTTS("Un > deux")).toBe("Un deux");
  });
});
