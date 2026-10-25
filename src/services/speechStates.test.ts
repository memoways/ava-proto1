import { describe, expect, it } from 'vitest';
import { ResponseIntentParser, SPEECH_BOUNDARY } from './responseIntentStream';
import { resolveNextSpeechState } from '@/agents/gameMasterPRD4';
import { buildSpeechStateBlock } from '@/agents/maxAgent';
import { normalizeRugosite, rugosityDirectorDirective, rugositySpeechDirective, selectSpeechState } from './speechRugosity';

const context = { characterKey: 'max' as const, displayName: 'Max Lorenzo', characterId: '11111111-1111-4111-8111-111111111111', notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: '2026-10-13T00:00:00Z' };

describe('en-tête privé « parole »', () => {
  it('accepte un état de parole déclaré sans le diffuser', () => {
    const intents: unknown[] = [];
    const spoken: string[] = [];
    const p = new ResponseIntentParser(context, i => intents.push(i), s => spoken.push(s));
    p.push(JSON.stringify({ goal: 'Écouter', points: [], parole: 'retenu' }) + SPEECH_BOUNDARY + 'Je vous écoute. ');
    expect(p.finish()).toBe('Je vous écoute.');
    expect(intents).toEqual([{ goal: 'Écouter', points: [], parole: 'retenu' }]);
    expect(spoken).toEqual(['Je vous écoute.']);
  });

  it('ignore une parole malformée sans faire échouer le tour', () => {
    const intents: unknown[] = [];
    const p = new ResponseIntentParser(context, i => intents.push(i), () => {});
    p.push(JSON.stringify({ goal: 'Écouter', points: [], parole: 'x'.repeat(41) }) + SPEECH_BOUNDARY + 'Oui. ');
    expect(p.finish()).toBe('Oui.');
    expect(intents).toEqual([{ goal: 'Écouter', points: [] }]);
  });

  it('rejette toujours une clé inconnue', () => {
    const p = new ResponseIntentParser(context, () => {}, () => {});
    expect(() => p.push(JSON.stringify({ goal: 'x', points: [], autre: 'y' }) + SPEECH_BOUNDARY + 'Oui. ')).toThrow();
  });
});

describe('resolveNextSpeechState', () => {
  const states = [
    { name: 'Retenu', description: 'parle peu' },
    { name: 'Ouvert', description: 'se confie' },
  ];
  it('valide le nom exact, insensible à la casse', () => {
    expect(resolveNextSpeechState('retenu', states)).toBe('Retenu');
    expect(resolveNextSpeechState(' Ouvert ', states)).toBe('Ouvert');
  });
  it('retombe sur null pour un état inconnu, une liste vide ou une valeur absente', () => {
    expect(resolveNextSpeechState('inventé', states)).toBeNull();
    expect(resolveNextSpeechState('Retenu', [])).toBeNull();
    expect(resolveNextSpeechState(null, states)).toBeNull();
    expect(resolveNextSpeechState(42, states)).toBeNull();
  });
});

describe('buildSpeechStateBlock', () => {
  it('ne rien injecter quand rugosité 0 et aucune proposition (comportement actuel)', () => {
    expect(buildSpeechStateBlock({ rugosite: 0 })).toBeUndefined();
    expect(buildSpeechStateBlock({})).toBeUndefined();
  });
  it('cite la proposition du GM et la déclaration attendue', () => {
    const block = buildSpeechStateBlock({ speechStateDirective: 'Retenu', rugosite: 0 });
    expect(block).toContain('« Retenu »');
    expect(block).toContain('"parole"');
  });
  it('ajoute la consigne de rugosité quand elle est réglée', () => {
    expect(buildSpeechStateBlock({ rugosite: 3 })).toContain('Rugosité 3/3');
  });
  it('ne force pas une rotation après deux déclarations identiques, même à rugosité 0', () => {
    expect(buildSpeechStateBlock({ rugosite: 0, speechStateHistory: ['Bloqué', 'Bloqué'] })).toBeUndefined();
    const block = buildSpeechStateBlock({ rugosite: 3, speechStateDirective: 'Bloqué', speechStateHistory: ['Bloqué', 'Bloqué'] });
    expect(block).toContain('déclencheurs');
    expect(block).not.toMatch(/Choisis un autre|jamais trois fois|Joue-le et déclare-le/);
  });
});

describe('rugosité', () => {
  it('valide seulement la fiche courante sans imposer de variété', () => {
    const states = [{ name: 'Bloqué' }, { name: 'Éclair' }];
    expect(selectSpeechState('Bloqué', states)).toBe('Bloqué');
    expect(selectSpeechState('Éclair', states)).toBe('Éclair');
    expect(selectSpeechState('Ancien état', states)).toBeNull();
  });
  it.each([1, 2, 3])('le niveau %s module les possibilités sans remplacer les déclencheurs', level => {
    for (const directive of [rugositySpeechDirective(level), rugosityDirectorDirective(level)]) {
      expect(directive).toContain('déclencheurs');
      expect(directive).toContain('réponse nette');
      expect(directive).not.toMatch(/privilégie les états bloqués|Ne cherche jamais la fluidité|propose souvent/);
    }
  });
  it('borne la valeur entre 0 et 3, 0 par défaut', () => {
    expect(normalizeRugosite(undefined)).toBe(0);
    expect(normalizeRugosite(-2)).toBe(0);
    expect(normalizeRugosite(9)).toBe(3);
    expect(normalizeRugosite(2)).toBe(2);
  });
  it('rugosité 0 = aucune consigne injectée', () => {
    expect(rugositySpeechDirective(0)).toBe('');
  });
});
