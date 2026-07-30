import { describe, expect, it } from "vitest";
import { splitAvatarText } from "./textSegmentation";

describe("splitAvatarText", () => {
  it("keeps short text in a single exact chunk", () => {
    expect(splitAvatarText("Bonjour Max.")).toEqual(["Bonjour Max."]);
  });

  it("preserves the original text byte-for-byte when split", () => {
    const text =
      "Première phrase avec ponctuation. Deuxième phrase plus longue ! " +
      "Troisième phrase qui doit rester rigoureusement identique, espaces compris.";
    const chunks = splitAvatarText(text, 55);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(text);
  });

  it("never cuts an over-limit sentence in the middle", () => {
    const sentence = `${"x".repeat(50)}. `;
    const text = `${sentence}La suite.`;
    expect(splitAvatarText(text, 10)).toEqual([sentence, "La suite."]);
  });
});
