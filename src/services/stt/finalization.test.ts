import { describe, expect, it } from "vitest";
import { combineTranscriptParts, pickMostCompleteTranscript } from "./finalization";

describe("STT finalization safeguards", () => {
  it("keeps the finalized prefix and the latest interim tail", () => {
    expect(combineTranscriptParts(
      "Je voulais te parler de ta sœur",
      "et de ce qui s'est passé hier soir",
    )).toBe("Je voulais te parler de ta sœur et de ce qui s'est passé hier soir");
  });

  it("does not duplicate a provider's full running transcript", () => {
    expect(combineTranscriptParts(
      "Je voulais te parler",
      "Je voulais te parler de ta sœur",
    )).toBe("Je voulais te parler de ta sœur");
  });

  it("uses live text when a corrected final has not arrived yet", () => {
    expect(pickMostCompleteTranscript(
      "Je voulais te parler de",
      "Je voulais te parler de la dernière soirée",
    )).toBe("Je voulais te parler de la dernière soirée");
  });
});
