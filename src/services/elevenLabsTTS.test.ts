import { describe, expect, it } from "vitest";
import { chunkTextForTTS, extractSentences, prepareTextForTTS } from "@/services/elevenLabsTTS";

describe("elevenLabsTTS text preparation", () => {
  it("keeps short Max replies in one TTS request for prosody continuity", () => {
    const text = "Écoute, je ne sais pas qui tu es. Mais si tu sais quelque chose sur Ava, dis-le moi maintenant.";

    expect(chunkTextForTTS(text)).toEqual([text]);
  });

  it("normalizes artifacts that often hurt French TTS diction", () => {
    expect(prepareTextForTTS("**Max**: L'IA, le RAG et le TTS... (il soupire) Ava.")).toBe(
      "Max: L'I A, le rague et le T T S... Ava.",
    );
  });

  it("does not split on common French abbreviations or decimal numbers", () => {
    const firstSentence = "Dr. Martin arrive à 3.14 exactement pour présenter calmement les résultats détaillés de son analyse.";
    const [sentences, leftover] = extractSentences(`${firstSentence} Tu comprends ?`);

    expect(sentences).toEqual([firstSentence]);
    expect(leftover).toBe("Tu comprends ?");
  });
});
