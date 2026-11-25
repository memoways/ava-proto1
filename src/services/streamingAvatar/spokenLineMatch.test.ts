import { describe, expect, it } from "vitest";
import { isSpokenLine, spokenLineProgress } from "./spokenLineMatch";

const line = "Allô… c’est Emma. À qui je parle ?";

describe("spoken line match", () => {
  it("accepts the line whatever the accents and punctuation", () => {
    expect(spokenLineProgress(line, "Allo, c'est Emma ")).toBe("reading");
    expect(isSpokenLine(line, "Allo c'est Emma, a qui je parle")).toBe(true);
  });

  it("spots an improvised greeting before it ends", () => {
    expect(spokenLineProgress(line, "What got you calling ")).toBe("diverged");
    expect(isSpokenLine(line, "What got you calling this late? How are you?")).toBe(false);
  });

  it("waits for enough words, ignoring the one still arriving", () => {
    expect(spokenLineProgress(line, "What got you call")).toBe("pending");
    expect(spokenLineProgress(line, "")).toBe("pending");
  });

  it("refuses a cut line, an added speech and silence", () => {
    expect(isSpokenLine(line, "Allô c'est Emma")).toBe(false);
    expect(isSpokenLine(line, `${line} Anyway, how was your day today my friend?`)).toBe(false);
    expect(isSpokenLine(line, "")).toBe(false);
  });
});
