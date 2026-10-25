import { describe, expect, it } from 'vitest';
import { ResponseIntentParser, SPEECH_BOUNDARY, buildResponseStreamContract } from './responseIntentStream';
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
  it.each(['\r\n<speech>\r\n', '\\n<speech>\\n', '\n\n<speech>\n\n', '<speech>'])('accepts equivalent marker layout %j without speaking private JSON', boundary => {
    const wire = JSON.stringify({ goal: 'PRIVATE_HEADER', points: [] }) + boundary + 'Je vous écoute.';
    for (let i = 0; i <= wire.length; i++) {
      const { p, spoken } = parser(); p.push(wire.slice(0, i)); p.push(wire.slice(i));
      expect(p.finish()).toBe('Je vous écoute.');
      expect(spoken).toEqual(['Je vous écoute.']);
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
      expect(p.finish(true)).toBe(speech);
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
  it.each(["Moi, ça va. Non. J'en sais rien. Mais elle…", 'Je la laisserai pas toute seule.', 'Je… je sais pas. Emma, elle… elle reste Emma. Hein ?', 'Je... non. C’est pas...', 'Max, il… bon.', 'Emma, elle —', 'Je suis Max… enfin. Je suis fatigué…', 'Elle disait « Je suis Emma… »'])('préserve les reprises et suspensions volontaires à chaque frontière : %s', speech => {
    const wire = header + speech;
    for (let split = 0; split <= wire.length; split++) {
      const { p, spoken } = parser(); p.push(wire.slice(0, split)); p.push(wire.slice(split));
      expect(p.finish(true)).toBe(speech);
      expect(spoken.join(' ')).toBe(speech);
    }
  });
  it.each(['Je suis Em…', 'Je suis Em...ma.', 'Je m’appelle Em…', 'je suis em…', 'Ici Em…', 'Une phrase incomplète', '« Emma, elle…', '{"parole":"Bloqué"}…'])('refuse encore les identités et réponses incomplètes : %s', speech => {
    const { p } = parser();
    expect(() => { p.push(header + speech); p.finish(); }).toThrow();
  });
});


describe('lot 3 — terminal closing residue', () => {
  it('distingue fin technique et pensée ouverte dans le même budget', () => {
    const contract = buildResponseStreamContract(220);
    expect(contract).not.toContain('achève ta réponse');
    expect(contract).toContain('fin technique normale');
    expect(contract).toContain('pensée peut rester ouverte');
    expect(contract).toContain('45 mots maximum');
    expect(contract).toContain('goal : 8 mots maximum');
  });
  it('forbids model-generated closing markers in the effective contract', () => {
    expect(buildResponseStreamContract(220)).toContain('Ne ferme jamais <speech>');
  });
  it('accepts only the known T2 residue after confirmed normal completion at every token boundary', () => {
    const speech = 'Je vous écoute.';
    const wire = header + speech + '\n</speech';
    for (let split = 0; split <= wire.length; split++) {
      const { p, spoken } = parser();
      p.push(wire.slice(0, split)); p.push(wire.slice(split));
      expect(p.finish(true)).toBe(speech);
      expect(spoken).toEqual([speech]);
      expect(p.generated.trim()).toBe(speech);
    }
  });
  it.each(['Une phrase coupée', '« Une citation.', 'Je suis Em…', 'Je suis Emma.', '{"goal":"privé"}.'])('never rescues unsafe speech %s', speech => {
    const { p } = parser();
    expect(() => { p.push(header + speech + '\n</speech'); p.finish(true); }).toThrow();
  });
  it.each(['</spe', '</speech x', '</other>', '</speech> Autre phrase.', '</speech><speech>'])('rejects other residues %s', residue => {
    const { p } = parser();
    expect(() => { p.push(header + 'Bonjour.\n' + residue); p.finish(true); }).toThrow();
  });
  it('requires a normal upstream completion for a truncated closing marker', () => {
    const { p } = parser(); p.push(header + 'Bonjour.\n</speech');
    expect(() => p.finish(false)).toThrow();
  });
});
