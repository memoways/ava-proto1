/**
 * Split provider-bound text without rewriting it. Joining the returned chunks
 * always reproduces the original string byte-for-byte.
 */
export function splitAvatarText(text: string, maxChars = 900): string[] {
  if (!text || text.length <= maxChars) return text ? [text] : [];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const hardEnd = Math.min(text.length, cursor + maxChars);
    if (hardEnd === text.length) {
      chunks.push(text.slice(cursor));
      break;
    }

    const window = text.slice(cursor, hardEnd);
    const sentenceBoundary = findLastSentenceBoundary(window);
    // Never cut inside a sentence. If one sentence is longer than the provider
    // target, keep it intact and let that one segment exceed the target.
    const nextSentenceBoundary = findFirstSentenceBoundary(text.slice(cursor));
    const relativeEnd = sentenceBoundary > 0
      ? sentenceBoundary
      : nextSentenceBoundary > 0
        ? nextSentenceBoundary
        : text.length - cursor;
    chunks.push(text.slice(cursor, cursor + relativeEnd));
    cursor += relativeEnd;
  }
  return chunks;
}

function findFirstSentenceBoundary(value: string): number {
  const match = /[.!?…](?:["»”')\]]*)\s+/u.exec(value);
  return match ? (match.index ?? 0) + match[0].length : -1;
}

function findLastSentenceBoundary(value: string): number {
  let result = -1;
  const pattern = /[.!?…](?:["»”')\]]*)\s+/gu;
  for (const match of value.matchAll(pattern)) {
    result = (match.index ?? 0) + match[0].length;
  }
  return result;
}
