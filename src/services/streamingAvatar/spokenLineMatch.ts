/**
 * Tells whether a persona that only receives Ava's line as a note (Nuance) is
 * actually reading it, from the transcript of what it says. Pure.
 */

/** Words looked ahead in the expected line, so a dropped or merged word is not a divergence. */
const LOOKAHEAD = 3;
/** Words heard before a partial transcript is judged. */
const MIN_JUDGED_WORDS = 4;
/** Words in line before the persona counts as reading it. */
const MIN_VERIFIED_WORDS = 3;
const PARTIAL_RATIO = 0.6;
const FINAL_RATIO = 0.8;

export type SpokenLineProgress = "pending" | "reading" | "diverged";

export function spokenLineProgress(expected: string, spoken: string): SpokenLineProgress {
  const target = words(expected);
  const heard = words(spoken);
  // The last word may still be arriving.
  if (/[\p{L}\p{N}]$/u.test(spoken)) heard.pop();
  const matched = matchedInOrder(target, heard);
  if (heard.length >= MIN_JUDGED_WORDS && matched < heard.length * PARTIAL_RATIO) return "diverged";
  const needed = Math.min(MIN_VERIFIED_WORDS, target.length);
  return needed > 0 && matched >= needed && matched >= heard.length * PARTIAL_RATIO
    ? "reading"
    : "pending";
}

/** True when the finished reply is Ava's line: nearly all of it, and little else. */
export function isSpokenLine(expected: string, spoken: string): boolean {
  const target = words(expected);
  const heard = words(spoken);
  if (!target.length || !heard.length) return false;
  const matched = matchedInOrder(target, heard);
  return matched >= target.length * FINAL_RATIO && matched >= heard.length * FINAL_RATIO;
}

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function matchedInOrder(target: string[], heard: string[]): number {
  let from = 0;
  let matched = 0;
  for (const word of heard) {
    const at = target.slice(from, from + LOOKAHEAD + 1).indexOf(word);
    if (at < 0) continue;
    matched += 1;
    from += at + 1;
  }
  return matched;
}
