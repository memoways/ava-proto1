import { describe, expect, it } from "vitest";
import { classifyAfterAbandonedFlush, combineTranscriptParts, pickMostCompleteTranscript } from "./finalization";

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

  it("drops the late tail of an abandoned flush until its acknowledgement", () => {
    expect(classifyAfterAbandonedFlush(2000, 1000, { fromFinalize: false })).toBe("drop");
    expect(classifyAfterAbandonedFlush(2000, 1000, { fromFinalize: true })).toBe("acknowledge");
  });

  it("accepts new speech once the stale window is over or was never opened", () => {
    expect(classifyAfterAbandonedFlush(2000, 2000, { fromFinalize: false })).toBe("accept");
    expect(classifyAfterAbandonedFlush(0, 500, { fromFinalize: false })).toBe("accept");
  });
});
