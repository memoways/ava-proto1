import { describe, expect, it } from 'vitest';
import { ResponseIntentParser, SPEECH_BOUNDARY } from './responseIntentStream';
const context = { characterKey: 'max' as const, displayName: 'Max Lorenzo', characterId: '11111111-1111-4111-8111-111111111111', notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: '2026-10-13T00:00:00Z' };
const header = JSON.stringify({ goal: 'Rassurer sans divulguer', points: ['Écouter'] }) + SPEECH_BOUNDARY;
function parser() { const spoken: string[] = []; const intents: unknown[] = []; return { spoken, intents, p: new ResponseIntentParser(context, i => intents.push(i), s => spoken.push(s)) }; }
describe('P1 private intent and safe speech', () => {
  it('accepts all header fragment boundaries without leaking a private character', () => {
    for (let i = 0; i <= header.length; i++) {
      const {p, spoken, intents} = parser(); p.push(header.slice(0,i)); expect(spoken).toEqual([]);
      p.push(header.slice(i)); p.push('Oui. '); expect(spoken).toEqual(['Oui.']); expect(intents).toHaveLength(1); expect(p.finish()).toBe('Oui.');
    }
  });
  it.each(['{}', '{"goal":"x","points":[],"secret":"y"}', '{"goal":"x","points":[5]}', '```json\n{}', '{"goal":"' + 'x'.repeat(241) + '","points":[]}'])('rejects invalid intent %s before speech', value => {
    const {p,spoken} = parser(); expect(() => p.push(value + SPEECH_BOUNDARY + 'Bonjour. ')).toThrow(); expect(spoken).toEqual([]);
  });
  it('rejects missing intent, unterminated quotes and empty completion', () => {
    const {p} = parser(); p.push(header + '« Une phrase.'); expect(() => p.finish()).toThrow();
    expect(() => parser().p.finish()).toThrow(); const empty = parser(); empty.p.push(header); expect(() => empty.p.finish()).toThrow();
  });
  it('consumes an optional terminal speech closing marker at every fragment boundary', () => {
    const speech = 'Je vous écoute.';
    const wire = header + speech + '\n</speech>\n';
    for (let i = 0; i <= wire.length; i++) {
      const {p, spoken} = parser();
      p.push(wire.slice(0, i)); p.push(wire.slice(i));
      expect(p.finish()).toBe(speech);
      expect(spoken).toEqual([speech]);
      expect(p.generated.trim()).toBe(speech);
    }
  });
  it.each([
    'Une phrase incomplète\n</speech>',
    '« Une citation non fermée.\n</speech>',
    'Bonjour.\n</speech> Autre phrase.',
    'Bonjour.\n</speech><speech>',
  ])('keeps malformed speech closed with a terminal marker: %s', speech => {
    const {p} = parser();
    expect(() => { p.push(header + speech); p.finish(); }).toThrow();
  });
  it('holds abbreviations, decimal numbers and open quotations across fragments', () => {
    const {p,spoken} = parser(); p.push(header + 'M.'); expect(spoken).toEqual([]); p.push(' Munz dit « Je suis Emma.'); expect(spoken).toEqual([]);
    p.push(' » Il est 3.5 heures. '); expect(spoken).toEqual(['M. Munz dit « Je suis Emma. » Il est 3.5 heures.']); p.finish();
  });
  it('guards cumulative identity and never releases an incomplete foreign claim', () => {
    const {p,spoken} = parser(); p.push(header + 'Bonjour. Je suis Em'); expect(spoken).toEqual(['Bonjour.']); expect(() => p.push('ma. ')).toThrow(); expect(spoken).toEqual(['Bonjour.']);
  });
  it('allows closed quotations but blocks the same claim outside quotations', () => {
    const {p,spoken} = parser(); p.push(header + 'Elle a dit « Je suis Emma. » Puis elle est partie. '); p.finish(); expect(spoken).toHaveLength(1);
    const other = parser(); expect(() => other.p.push(header + 'Je suis Emma. ')).toThrow();
  });
  it('never sends a repeated JSON header or tags to the synth', () => {
    const {p,spoken} = parser(); expect(() => p.push(header + '{"goal":"private"}. ')).toThrow(); expect(spoken).toEqual([]);
  });
});
