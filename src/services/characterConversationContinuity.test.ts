import { describe, expect, it } from 'vitest';
import { characterHandoffGreeting, characterHandoffPauseLine, followsHandoffPause, characterRecallGreeting, characterRecoveryLine, characterRegister, latestCallTransfer, createInitialGreetingSelector, initialGreetingLines, greetingDelivery } from './characterConversationContinuity';
import { projectDeliveredConversation } from './responseDelivery';
import { buildExperienceFrame } from './experienceFrame';
import type { ConversationMessage } from '@/types';

describe('character call continuity', () => {
  it.each(['max', 'emma'] as const)('selects one %s profile alternative per call without immediate repetition across new calls', character => {
    const select = createInitialGreetingSelector();
    const profile = character === 'max' ? 'Allô. Max à l’appareil. Je vous écoute.' : 'Allô… c’est Emma. À qui je parle ?';
    expect(initialGreetingLines(character, profile, 'sandbox-ulrich')).toHaveLength(2);
    expect(initialGreetingLines(character, profile, 'prod')).toEqual([profile]);
    expect(initialGreetingLines(character, 'Édition du profil.', 'sandbox-ulrich')).toEqual(['Édition du profil.']);
    const first = select('call1', 'sandbox-ulrich', character, profile);
    expect(select('call1', 'sandbox-ulrich', character, 'Texte modifié après sélection.')).toBe(first);
    const next = select('call2', 'sandbox-ulrich', character, profile);
    expect(next).not.toBe(first);
    expect(select('call3', 'sandbox-ulrich', character, profile)).toBe(first);
    expect(select('call1', 'prod', character, 'Texte production.')).toBe('Texte production.');
    expect(select('single1', 'sandbox-ulrich', character, 'Unique.')).toBe('Unique.');
    expect(select('single2', 'sandbox-ulrich', character, 'Unique.')).toBe('Unique.');
  });
  it('keeps the three contexts distinct and excludes unplayed greeting words from shared evidence', () => {
    const text = 'Allô. Je vous écoute.';
    const initial = greetingDelivery('s:opening', 0, 'max', text);
    expect(projectDeliveredConversation([{ role: 'max', content: text, timestamp: 0, delivery: initial }])).toEqual([]);
    expect(greetingDelivery('s:opening', 0, 'max', text, { status: 'played', started: true }))
      .toMatchObject({ delivered: text, uncertain: '', privateContinuation: '', status: 'completed' });
    expect(greetingDelivery('s:opening', 0, 'max', text, { status: 'cancelled', started: true }))
      .toMatchObject({ delivered: '', uncertain: text, privateContinuation: '', status: 'cancelled' });
    expect(greetingDelivery('s:opening', 0, 'max', text, { status: 'failed', started: false }))
      .toMatchObject({ delivered: '', uncertain: '', privateContinuation: text });
    const firstTransfer = characterHandoffGreeting('emma', 'max', []);
    const returning = characterHandoffGreeting('emma', 'max', [{ role: 'emma', content: firstTransfer, timestamp: 0 }]);
    expect(firstTransfer).not.toBe(text);
    expect(returning).not.toBe(firstTransfer);
  });
  it.each(['max', 'emma'] as const)('varies %s recoveries and transfer greetings without another character’s words', character => {
    const from = character === 'max' ? 'emma' : 'max';
    const history: ConversationMessage[] = [];
    const greetings = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const text = characterHandoffGreeting(character, from, history);
      expect(greetings.has(text)).toBe(false);
      greetings.add(text);
      history.push({ role: character, content: text, timestamp: i, spokenWith: character });
    }
    const recovery = characterRecoveryLine(character, []);
    expect(characterRecoveryLine(character, [{ role: character, content: recovery, timestamp: 1 }])).not.toBe(recovery);
    expect(characterRecoveryLine(from, [])).not.toBe(recovery);
  });
  it('keeps only transfer provenance, even after the greeting leaves recent history', () => {
    const messages: ConversationMessage[] = [{ role: 'max', content: 'Allô.', timestamp: 1,
      spokenWith: 'max', callTransfer: { from: 'emma', returning: false } },
    ...Array.from({ length: 30 }, (_, i): ConversationMessage => ({ role: 'user', content: 'CONFIDENCE_PRIVEE', spokenWith: 'emma', timestamp: i + 2 }))];
    const context = buildExperienceFrame({ config: null, filmAnswer: null, callTransfer: latestCallTransfer('max', messages) }).prompt;
    expect(context).toMatch(/Emma/);
    expect(context).not.toContain('CONFIDENCE_PRIVEE');
    expect(context).toMatch(/sans connaître|ne connais pas/);
    expect(latestCallTransfer('emma', messages)).toBeUndefined();
  });
  it('does not repeat recovery lines separated by normal exchanges before exhausting the repertoire', () => {
    const history: ConversationMessage[] = [];
    const recoveries: string[] = [];
    for (let i = 0; i < 5; i++) {
      const line = characterRecoveryLine('max', history);
      expect(recoveries).not.toContain(line);
      recoveries.push(line);
      history.push({ role: 'max', content: line, timestamp: i });
      for (let j = 0; j < 8; j++) history.push({ role: 'max', content: 'Échange normal.', timestamp: i });
    }
    expect(characterRecoveryLine('max', history)).toBe(recoveries[0]);
  });
});

describe('scripted lines follow the register already used in the call (recette G1.2)', () => {
  const max = (content: string): ConversationMessage => ({ role: 'max', content, timestamp: 0 });
  const recette = [
    max('Allô. Max à l’appareil. Je vous écoute.'),
    { role: 'user', content: 'Écoute bonjour Max, je t’appelle.', timestamp: 0 } as ConversationMessage,
    max('Je ne vais pas bien. Je peux te donner les faits.'),
    max('Oui… tu peux essayer. Dis-lui seulement que tu penses à elle.'),
  ];

  it('detects tu after a formal greeting, vous otherwise', () => {
    expect(characterRegister('max', recette)).toBe('tu');
    expect(characterRegister('max', recette.slice(0, 2))).toBe('vous');
    expect(characterRegister('max', [])).toBe('vous');
    expect(characterRegister('max', [max('Reprends, je t’écoute.')])).toBe('tu');
    expect(characterRegister('max', [max('Je te passe Emma, et vous verrez.'), max('Rien.')])).toBe('vous');
  });

  it('keeps the withheld-transfer pause and recoveries in « tu » once Max says « tu »', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(characterHandoffPauseLine('max', recette)).not.toMatch(/\bvous\b|voulez|voudriez/);
      expect(characterRecoveryLine('max', recette)).not.toMatch(/\bvous\b|Reprenez|Attendez/);
    }
    expect(characterHandoffPauseLine('max', recette.slice(0, 1))).toMatch(/vous/);
  });

  it('recognizes a pause the character just said, in either register', () => {
    const user: ConversationMessage = { role: 'user', content: 'Tu pourrais me passer Emma', timestamp: 0 };
    const pause: ConversationMessage = { role: 'max', content: 'De quoi veux-tu lui parler, au juste ?', timestamp: 1 };
    expect(followsHandoffPause('max', [user, pause])).toBe(true);
    expect(followsHandoffPause('max', [user, pause, user])).toBe(true);
    expect(followsHandoffPause('max', [pause, user, { role: 'max', content: 'Je ne sais pas.', timestamp: 2 }, user])).toBe(false);
    expect(followsHandoffPause('emma', [user, pause])).toBe(false);
  });

  it('greets a returning player in the register the target already used', () => {
    const emma: ConversationMessage = { role: 'emma', content: 'Je t’écoute, dis-moi ce que tu sais.', timestamp: 0 };
    for (let i = 0; i < 6; i += 1) {
      expect(characterHandoffGreeting('emma', 'max', [emma])).not.toMatch(/\bvous\b/);
      expect(characterRecallGreeting('emma', [emma], null)).not.toMatch(/\bvous\b/);
    }
  });
});
