import { describe, expect, it } from "vitest";
import { prepareTextForGradium } from "@/services/tts/providers/gradium";

describe("prepareTextForGradium", () => {
  it("removes ellipses, dashes and quotes that cause hiccups", () => {
    expect(prepareTextForGradium("Écoute... je sais pas — « Ava » (peut-être) est partie...")).toBe(
      "Écoute, je sais pas, Ava peut-être est partie.",
    );
  });
});
