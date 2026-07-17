import { describe, expect, it } from "vitest";
import { chunkTextForTTS } from "@/services/tts/textChunking";
import { prepareTextForTTS } from "@/services/tts/textPrep";

const LONG = "Les relations sont tendues. Après tout ce qui s'est passé, surtout avec Léo et Emma, c'est difficile de trouver un terrain d'entente. La communication est rompue et la méfiance est présente. Je ne sais pas comment réparer ça. Toi, comment gérerais-tu une telle situation ?";
// chunkTextForTTS runs prepareTextForTTS internally (e.g. normalises " ?" → "?").
const PREP = prepareTextForTTS(LONG);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("chunkTextForTTS", () => {
  it("keeps default behaviour (single chunk) when no options are passed", () => {
    // Historical thresholds: ≤900 chars stays one chunk — the ElevenLabs guarantee.
    expect(chunkTextForTTS(LONG)).toEqual([PREP]);
  });

  it("splits into finer chunks when smaller thresholds are provided (Gradium)", () => {
    const chunks = chunkTextForTTS(LONG, { maxSingleChars: 160, targetChars: 160 });
    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk stays reasonably short so the first one starts playing sooner.
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    // No content is lost.
    expect(norm(chunks.join(" "))).toBe(norm(PREP));
  });

  it("still returns a single chunk for short responses even with Gradium options", () => {
    const short = "Salut, c'est moi.";
    expect(chunkTextForTTS(short, { maxSingleChars: 160, targetChars: 160 })).toEqual([short]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkTextForTTS("   ")).toEqual([]);
  });
});
