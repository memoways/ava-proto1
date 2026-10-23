import { describe, expect, it } from 'vitest';
import { characterHandoffGreeting, characterRecoveryLine, latestCallTransfer } from './characterConversationContinuity';
import { buildExperienceFrame } from './experienceFrame';
import type { ConversationMessage } from '@/types';

describe('character call continuity', () => {
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
