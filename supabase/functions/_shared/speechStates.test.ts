import { describe, expect, it } from "vitest";
import { parseSpeechStates } from "./speechStates";

describe("parseSpeechStates", () => {
  it("lit les états de Max sous « Tes états de parole »", () => {
    const text = `Tu parles par bribes.\n\nTes états de parole :\n- Bloqué : tu ne dis presque rien.\n- Tu tournes autour : tu évites.\n- La digue cède : ça déborde.\n- Éclair : une phrase nette.\n- L'espoir revient : tu demandes.\n\nAutre paragraphe.`;
    expect(parseSpeechStates(text).map((s) => s.name)).toEqual([
      "Bloqué", "Tu tournes autour", "La digue cède", "Éclair", "L'espoir revient",
    ]);
  });
  it("renvoie une liste vide sans titre", () => {
    expect(parseSpeechStates("- Bloqué : rien")).toEqual([]);
  });
  it("accepte le gras et les puces *", () => {
    expect(parseSpeechStates("Tes états de parole\n* **Tu décroches** : absente")[0]).toEqual({ name: "Tu décroches", description: "absente" });
  });
});
