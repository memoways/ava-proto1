import { describe, expect, it } from 'vitest';
import { characterHandoffGreeting, characterRecoveryLine, latestCallTransfer, createInitialGreetingSelector, initialGreetingLines, greetingDelivery } from './characterConversationContinuity';
import { projectDeliveredConversation } from './responseDelivery';
import { buildExperienceFrame } from './experienceFrame';
import type { ConversationMessage } from '@/types';

describe('character call continuity', () => {
  it.each(['max', 'emma'] as const)('selects one %s profile alternative per call without immediate repetition across new calls', character => {
    const select = createInitialGreetingSelector();
    const profile = ' Allô. \r\n\nJe vous écoute.\nAllô. ';
    expect(initialGreetingLines(character, profile)).toEqual(['Allô.', 'Je vous écoute.']);
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
