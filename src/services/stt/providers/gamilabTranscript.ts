import { combineTranscriptParts } from "../finalization";

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Gamilab emits punctuation-only activity placeholders while refining text. */
export function isMeaningfulGamilabTranscript(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(normalize(text));
}

/** Rebuild the complete visible turn from Gamilab's corrected + live channels. */
export function buildGamilabTranscript(history: string, current: string): string {
  const corrected = isMeaningfulGamilabTranscript(history) ? history : "";
  const live = isMeaningfulGamilabTranscript(current) ? current : "";
  return combineTranscriptParts(corrected, live);
}
