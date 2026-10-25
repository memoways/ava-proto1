import { prepareTextForTTS } from './textPrep';

export type GradiumPauseSeconds = 0.25 | 0.6 | 1;
export type GradiumSpeechPart = { type: 'text'; text: string } | { type: 'pause'; seconds: GradiumPauseSeconds };
export const MAX_GRADIUM_PAUSES_PER_TURN = 8;

/** Provider commands can only be created by this adapter, never by input text. */
export function stripGradiumControlMarkup(text: string): string {
  return text.replace(/<[^>]*(?:>|$)/g, ' ').replace(/&lt;.*?(?:&gt;|$)/gi, ' ');
}

/** Keep the historical anti-click cleanup, including the disabled path. */
export function prepareTextForGradium(text: string): string {
  return prepareTextForTTS(stripGradiumControlMarkup(text))
    .replace(/\s*\.{3}\s*(?=[A-Za-zÀ-ÿ0-9])/g, ', ')
    .replace(/\.{3}/g, '.')
    .replace(/\s+[—–-]\s+/g, ', ')
    .replace(/[«»"“”()[\]]/g, '')
    .replace(/([,;:!?.])\s*,/g, '$1')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Receives validated speech units, not raw SSE tokens. Punctuation stays with words. */
export function planGradiumSpeech(text: string, seconds?: GradiumPauseSeconds, limit = MAX_GRADIUM_PAUSES_PER_TURN): GradiumSpeechPart[] {
  if (!seconds || ![0.25, 0.6, 1].includes(seconds)) return [{ type: 'text', text: prepareTextForGradium(text) }];
  const clean = prepareTextForTTS(stripGradiumControlMarkup(text));
  const parts: GradiumSpeechPart[] = [];
  const rupture = /…|\.{3,}|\s+[—–-](?=\s|$)|[—–]$/gu;
  let cursor = 0, count = 0;
  for (const match of clean.matchAll(rupture)) {
    if (count >= limit) break;
    const words = prepareTextForGradium(clean.slice(cursor, match.index));
    if (/[\p{L}\p{N}]/u.test(words)) parts.push({ type: 'text', text: words });
    if (parts.at(-1)?.type === 'text') { parts.push({ type: 'pause', seconds }); count++; }
    cursor = match.index! + match[0].length;
  }
  const tail = prepareTextForGradium(clean.slice(cursor));
  if (/[\p{L}\p{N}]/u.test(tail)) parts.push({ type: 'text', text: tail });
  return parts;
}

/** Official WS text syntax; these controls never enter dialogue or REST. */
export function serializeGradiumSpeech(parts: GradiumSpeechPart[]): string {
  return parts.map(part => part.type === 'text' ? part.text : `<break time="${part.seconds}s" />`).join(' ') + (parts.at(-1)?.type === 'pause' ? ' ' : '');
}

export function createGradiumSpeechPreparer(pause: () => GradiumPauseSeconds | undefined) {
  let remaining = MAX_GRADIUM_PAUSES_PER_TURN;
  return (text: string) => {
    const parts = planGradiumSpeech(text, pause(), remaining);
    remaining -= parts.filter(part => part.type === 'pause').length;
    return serializeGradiumSpeech(parts);
  };
}
