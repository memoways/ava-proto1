import { describe, expect, it } from 'vitest';
import { createGradiumSpeechPreparer, planGradiumSpeech, prepareTextForGradium, serializeGradiumSpeech } from './gradiumSpeech';

const words = (text: string) => text.toLocaleLowerCase('fr').match(/[\p{L}\p{N}]+/gu);
const spoken = (text: string, seconds?: 0.25 | 0.6 | 1) => planGradiumSpeech(text, seconds).filter(p => p.type === 'text').map(p => p.text).join(' ');

describe('A2 Gradium speech controls', () => {
  it.each(['Allô ? Oui… c’est vous qui deviez… Oui.', 'Mais après…', 'Ava — attends.', 'Mais elle —', 'Attends—', 'Je la laisserai pas toute seule.', 'Peut-être, oui.'])('preserves every word: %s', text => {
    expect(words(spoken(text, 0.6))).toEqual(words(prepareTextForGradium(text)));
    expect(serializeGradiumSpeech(planGradiumSpeech(text))).toBe(prepareTextForGradium(text));
  });
  it.each([0.25, 0.6, 1] as const)('uses only the documented break syntax for %ss, with surrounding spaces', seconds => {
    expect(serializeGradiumSpeech(planGradiumSpeech('Oui… attends — non…', seconds)))
      .toBe(`Oui <break time="${seconds}s" /> attends <break time="${seconds}s" /> non <break time="${seconds}s" /> `);
  });
  it('does not turn commas, firm replies or word hyphens into pauses', () => {
    expect(planGradiumSpeech('Peut-être, dit-il. Je la laisserai pas toute seule.', 1).every(p => p.type === 'text')).toBe(true);
  });
  it('removes input commands before normalization and never accepts LLM durations, flush or emotional tags', () => {
    const text = 'Oui <break time="99s" /> <flush> <angry>je sais</angry>. <break time="0.6s" />';
    expect(serializeGradiumSpeech(planGradiumSpeech(text, 1))).toBe('Oui je sais.');
    expect(prepareTextForGradium(text)).toBe('Oui je sais.');
    expect(serializeGradiumSpeech(planGradiumSpeech('Oui &lt;flush&gt; je sais.', 1))).toBe('Oui je sais.');
    expect(serializeGradiumSpeech(planGradiumSpeech('Oui [il soupire…] je sais.', 1))).toBe('Oui je sais.');
  });
  it('keeps the same words and control order at validated incremental boundaries', () => {
    const chunks = ['Allô ? Oui… c’est vous qui deviez… Oui.', 'Mais elle…', 'Je la laisserai pas toute seule.'];
    const prepare = createGradiumSpeechPreparer(() => 0.6);
    expect(chunks.map(prepare).join(' ').replace(/\s+/g, ' ').trim()).toBe(serializeGradiumSpeech(planGradiumSpeech(chunks.join(' '), 0.6)).trim());
  });
  it('bounds pauses across the whole turn, leaves extra ruptures cleaned and coalesces adjacent ones', () => {
    const prepare = createGradiumSpeechPreparer(() => 1);
    const wire = Array.from({ length: 12 }, () => prepare('Oui…')).join(' ');
    expect(wire.match(/<break/g)).toHaveLength(8);
    expect(wire.match(/Oui/g)).toHaveLength(12);
    expect(planGradiumSpeech('… Oui… — … non.', 1).filter(p => p.type === 'pause')).toHaveLength(1);
  });
});

describe('AP4-quater — workshop hesitations', () => {
  it('keeps ellipses only when asked, and still cleans them for the game', () => {
    expect(prepareTextForGradium('Je... je sais pas.', { keepEllipses: true })).toBe('Je... je sais pas.');
    expect(prepareTextForGradium('Je... je sais pas.')).toBe('Je, je sais pas.');
  });
});
