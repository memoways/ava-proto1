import { describe, expect, it } from "vitest";
import { prepareTextForTTS } from "./textPrep";

describe("prepareTextForTTS character names", () => {
  it("never sends Eva to a provider: Ava, Emma, Max stay canonical", () => {
    expect(prepareTextForTTS("Max dit : Eva, Éva ou A.V.A. ? Emma sait.")).toBe("Max dit: Ava, Ava ou Ava? Emma sait.");
  });
});
