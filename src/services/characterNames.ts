/**
 * Canonical spelling of the four character names. Speech models read what is
 * written, so a drifted spelling ("Eva") is a drifted pronunciation: every text
 * that reaches the screen, a TTS provider or a video avatar goes through here.
 */
export const CANONICAL_CHARACTER_NAMES = ["Ava", "Max", "Emma", "Léo"] as const;

/** Prompt rule shared by every character prompt (appended to the identity invariant). */
export const CHARACTER_NAME_RULE =
  "- Noms exacts : Ava (A-V-A, jamais Eva), Max, Emma, Léo.";

const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{N}_])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{N}_])";

// Drifts seen from LLMs and speech models, mapped to the canonical name.
const DRIFTS: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: new RegExp(`${NOT_LETTER_BEFORE}[EÉ]va[h]?${NOT_LETTER_AFTER}`, "giu"), canonical: "Ava" },
  { pattern: new RegExp(`${NOT_LETTER_BEFORE}Avah${NOT_LETTER_AFTER}`, "giu"), canonical: "Ava" },
  { pattern: new RegExp(`${NOT_LETTER_BEFORE}Emm?ah?${NOT_LETTER_AFTER}`, "giu"), canonical: "Emma" },
];

function matchCase(found: string, canonical: string): string {
  return found === found.toLocaleUpperCase("fr") && found.length > 1 ? canonical.toLocaleUpperCase("fr") : canonical;
}

/** Rewrite drifted spellings of Ava and Emma to the canonical name; other text is untouched. */
export function normalizeCharacterNames(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { pattern, canonical } of DRIFTS) {
    out = out.replace(pattern, (found) => matchCase(found, canonical));
  }
  return out;
}
