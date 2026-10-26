import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '@/types';
import { HandoffCoordinator, completedCallExchanges, candidateEvidence, withdrawsHandoff } from './handoffCoordinator';
import { advanceHandoffTurn, assessHandoffTurn, restoreHandoffOffer } from './characterHandoffState';
import { validInput } from './characterHandoff.fixtures';

describe('F1 request lifetime and delivered exchanges', () => {
  it('uses the same lease for any registry member and rejects a replaced request/call/version', () => {
    const coordinator = new HandoffCoordinator<'one' | 'two' | 'three'>();
    for (const character of ['one', 'two', 'three'] as const) {
      const lease = coordinator.bind('session', 'call1', character, 'v1', 'request1');
      expect(coordinator.bind('session', 'call1', character, 'v1', 'request1').signal).toBe(lease.signal);
      expect(lease.current()).toBe(true);
      coordinator.bind('session', 'call1', character, 'v1', 'request2');
      expect(lease.current()).toBe(false);
      expect(lease.signal.aborted).toBe(true);
      const next = coordinator.bind('session', 'call2', character, 'v1', 'request2');
      coordinator.bind('session', 'call2', character, 'v2', 'request2');
      expect(next.current()).toBe(false);
    }
  });
  it('counts fragments as a single exchange and excludes greeting/interrupted output; resets on return', () => {
    const r = candidateEvidence('Réponse.', 's:1', 1, 'max');
    const history: ConversationMessage[] = [
      { role: 'max', content: 'Bonjour', timestamp: 0, spokenWith: 'max', delivery: { ...r, turnId: 'opening' } },
      ...['un', 'deux', 'trois'].map(content => ({ role: 'user' as const, content, timestamp: 1, spokenWith: 'max' as const })),
      { role: 'max', content: r.generated, timestamp: 2, spokenWith: 'max', delivery: r },
      { role: 'user', content: 'suite', timestamp: 3, spokenWith: 'max' },
      { role: 'max', content: r.generated, timestamp: 4, spokenWith: 'max', delivery: { ...r, turnId: 's:2', status: 'interrupted' } },
    ];
    expect(completedCallExchanges(history, 'max')).toBe(1);
    history.push({ role: 'emma', content: 'Allô', timestamp: 5, spokenWith: 'emma', callTransfer: { from: 'max', returning: false } },
      { role: 'max', content: 'Rebonjour', timestamp: 6, spokenWith: 'max', callTransfer: { from: 'emma', returning: true } });
    expect(completedCallExchanges(history, 'max')).toBe(0);
  });
  it('retains a delivered offer across thanks, but not explicit withdrawal/version/call changes', () => {
    const input = validInput();
    const context = { sessionId: 'session', sourceCharacter: 'emma' as const, orchestrationVersionId: 'v6', turnId: input.turnId, turnIndex: input.turnIndex };
    const available = assessHandoffTurn(advanceHandoffTurn(null, context, input.userText), input).state;
    const next = advanceHandoffTurn(available, { ...context, turnId: 'session:12', turnIndex: 12 }, 'Merci.');
    expect(next).toMatchObject({ state: 'available', requestId: available.requestId, offer: available.offer });
    expect(next.revision).not.toBe(available.revision); // CAS transcript protection remains live
    const requested = advanceHandoffTurn(null, context, input.userText);
    const retried = advanceHandoffTurn(requested, { ...context, turnId: 'session:12', turnIndex: 12 }, input.userText);
    expect(retried.requestId).toBe(requested.requestId);
    expect(retried.revision).not.toBe(requested.revision);
    const log: ConversationMessage[] = [...Array.from({ length: 10 }, () => ({ role: 'user' as const, content: 'contexte', timestamp: 0 })),
      { role: 'user', content: input.userText, timestamp: 1, spokenWith: 'emma' },
      { role: 'emma', content: input.delivery!.generated, timestamp: 2, spokenWith: 'emma', delivery: input.delivery! },
      { role: 'user', content: 'Merci.', timestamp: 3, spokenWith: 'emma' }];
    expect(restoreHandoffOffer(next, { ...context, turnIndex: 12 }, log)).toBeTruthy();
    expect(advanceHandoffTurn(next, context, 'Finalement je reste avec toi.').offer).toBeNull();
    expect(advanceHandoffTurn(next, { ...context, orchestrationVersionId: 'v7' }, 'Merci.').offer).toBeNull();
    expect(withdrawsHandoff('Merci, continuons à parler de ce souvenir.')).toBe(false);
    expect(withdrawsHandoff('Je ne veux pas parler à la police.')).toBe(false);
    expect(withdrawsHandoff('Je ne veux pas parler à Emma.')).toBe(true);
    expect(withdrawsHandoff("Je ne veux plus l’appeler.")).toBe(true);
    expect(withdrawsHandoff('Finalement continuons notre discussion.')).toBe(true);
  });
});
