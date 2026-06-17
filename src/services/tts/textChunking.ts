/**
 * Provider-agnostic sentence splitting and TTS chunking.
 * Extracted from the previous elevenLabsTTS.ts so all TTS providers share the same
 * text segmentation logic (important for stable comparisons).
 */

import { prepareTextForTTS } from "@/services/tts/textPrep";

const MIN_SENTENCE_LEN = 80;
const ABBREVIATIONS = new Set([
  "m", "mme", "mlle", "dr", "pr", "me", "st", "ste",
  "etc", "cf", "p", "pp", "vs", "ex", "no", "n°",
]);

function isAbbreviationBreak(text: string, dotIndex: number): boolean {
  let start = dotIndex - 1;
  while (start >= 0 && /[A-Za-zÀ-ÿ]/.test(text[start])) start--;
  const word = text.slice(start + 1, dotIndex).toLowerCase();
  if (!word) return false;
  if (ABBREVIATIONS.has(word)) return true;
  if (word.length === 1 && /[A-Za-zÀ-ÿ]/.test(word)) return true;
  return false;
}

function isNumericDot(text: string, dotIndex: number): boolean {
  const prev = text[dotIndex - 1];
  const next = text[dotIndex + 1];
  return /\d/.test(prev || "") && /\d/.test(next || "");
}

/** Splits text into sentences for progressive TTS. Returns [completeSentences, remainingFragment]. */
export function extractSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  let buffer = "";
  let cursor = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isEnd = ch === "." || ch === "!" || ch === "?";
    if (!isEnd) continue;

    let endIdx = i;
    while (endIdx + 1 < text.length && (text[endIdx + 1] === "." || text[endIdx + 1] === "…")) endIdx++;

    if (ch === "." && endIdx === i) {
      if (isAbbreviationBreak(text, i)) continue;
      if (isNumericDot(text, i)) continue;
    }

    const after = text[endIdx + 1];
    if (after && !/\s/.test(after)) continue;

    const segment = text.slice(cursor, endIdx + 1).trim();
    cursor = endIdx + 1;
    if (!segment) continue;

    buffer = buffer ? `${buffer} ${segment}` : segment;
    if (buffer.length >= MIN_SENTENCE_LEN) {
      sentences.push(buffer);
      buffer = "";
    }
  }

  const remaining = (buffer ? `${buffer} ${text.slice(cursor)}` : text.slice(cursor)).trim();
  return [sentences, remaining];
}

const SINGLE_REQUEST_MAX_CHARS = 700;
const CHUNK_TARGET_CHARS = 420;

/** Prepares TTS segments long enough to preserve diction. Short responses stay one chunk. */
export function chunkTextForTTS(text: string): string[] {
  const prepared = prepareTextForTTS(text);
  if (!prepared) return [];
  if (prepared.length <= SINGLE_REQUEST_MAX_CHARS) return [prepared];

  const [sentences, leftover] = extractSentences(prepared);
  const parts = leftover && leftover.length > 3 ? [...sentences, leftover] : sentences;
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (!current) { current = part; continue; }
    if ((current + " " + part).length <= CHUNK_TARGET_CHARS) {
      current += " " + part;
    } else {
      chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
