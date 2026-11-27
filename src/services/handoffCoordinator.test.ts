import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '@/types';
import { HandoffCoordinator, completedCallExchanges, candidateEvidence, withdrawsHandoff, needsHandoffPreparation, withoutTransferOffer, handoffFinalizationMode, handoffFinalizationStep } from './handoffCoordinator';
import { advanceHandoffTurn, assessHandoffTurn, restoreHandoffOffer } from './characterHandoffState';
import { validInput } from './characterHandoff.fixtures';

describe('F1 request lifetime and delivered exchanges', () => {
  it.each([
    'Je cherchais une solution. Elle m’a demandé de la laisser tranquille.',
    'Je cherche une réponse. Max est inquiet.',
    'Ava a envie de parler avec toi.',
    'Je t’appelle parce qu’Emma est inquiète.',
    'Emma m’a appelé hier. Elle ne comprend pas.',
    'Il s’est passé quelque chose avec Emma.',
    'Je vais chercher une solution. Emma attend.',
    'Pourquoi voulez-vous parler avec Emma ?',
  ])('does not mistake an ordinary search for a transfer: %s', text => {
    expect(needsHandoffPreparation(text)).toBe(false);
  });
  it.each(['Je vais la chercher.', 'Je vais chercher Emma.', 'Je vais chercher Max.',
    'Je te passe Emma.', 'D’accord, je te la passe.', 'Je vais appeler Max.',
    'Je vais l’appeler. C’est Max, pas Matt.',
    'Je vais aller le chercher dans le salon et lui dire que vous voulez lui parler directement.',
    'Tu peux appeler Emma.', 'Je peux te mettre en relation avec Emma.'])('still holds an actual transfer candidate: %s', text => {
    expect(needsHandoffPreparation(text)).toBe(true);
  });
  // Session e6918bd8 (G1.3): these offers were spoken unheld and the GM-validated consent was dropped.
  it.each(['Je passe Emma.', 'Je passe Emma maintenant.', 'Je vais passer Emma.',
    'Oui… je peux lui transmettre l’appel. Elle est dans la cuisine.', 'Je lui passe l’appel.',
    'Je transmets l’appel à Emma.', 'Je te repasse Max.'])('holds a direct transfer phrasing: %s', text => {
    expect(needsHandoffPreparation(text)).toBe(true);
  });
  it.each(['Je passe mes nuits à attendre Emma.', 'Je ne passe pas Emma.', 'Il m’a transmis l’appel hier.',
    'Je passe devant la chambre d’Emma.'])('does not hold an unrelated passer/transmettre: %s', text => {
    expect(needsHandoffPreparation(text)).toBe(false);
  });
  it('drops only the transfer sentences of a withheld candidate', () => {
    expect(withoutTransferOffer('Oui… je peux lui transmettre l’appel. Elle est dans la cuisine. Je passe Emma.'))
      .toBe('Oui… Elle est dans la cuisine.');
    expect(withoutTransferOffer('Je passe Emma maintenant.')).toBe('');
    expect(withoutTransferOffer('Elle ne dort pas. Je ne sais pas quoi lui dire')).toBe('Elle ne dort pas. Je ne sais pas quoi lui dire');
  });
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

describe('handoff finalisation mode', () => {
  const base = { sessionId: 's', sourceCharacter: 'max' as const, orchestrationVersionId: 'v1', turnId: 's:1', turnIndex: 1 };
  const mode = (userText: string, reply: string, waitOnNameAlone = false) =>
    handoffFinalizationMode(advanceHandoffTurn(null, base, userText), userText, reply, 'max', waitOnNameAlone);

  it('skips when no passage is plausible', () => {
    expect(mode('On parle de l\u2019hôtel.', 'Je ne sais plus, c\u2019était la nuit.')).toBe('skip');
    expect(mode('On parle de l\u2019hôtel.', 'Je ne sais plus.', true)).toBe('skip');
    expect(handoffFinalizationMode(null, '', '', 'max')).toBe('skip');
    const idle = advanceHandoffTurn(null, base, 'Bonjour.');
    expect(handoffFinalizationMode({ ...idle, state: 'available' }, 'Merci', 'Je te la passe.', 'max')).toBe('skip');
  });

  it('blocks while a request is open or an offer is prepared', () => {
    const asked = advanceHandoffTurn(null, base, 'Je voudrais parler à Emma.');
    expect(asked.state).toBe('awaiting_character');
    expect(handoffFinalizationMode(asked, 'Oui.', 'Oui.', 'max')).toBe('blocking');
    expect(handoffFinalizationMode({ ...asked, state: 'prepared' }, 'Oui.', 'Oui.', 'max')).toBe('blocking');
  });

  it('blocks on a transfer offer or consent in the reply, even without a request', () => {
    expect(mode('D\u2019accord.', 'Je te la passe.')).toBe('blocking');
    expect(mode('Merci.', 'Je te transfère maintenant la ligne.')).toBe('blocking');
    expect(mode('Merci.', 'Tu peux parler à Emma, elle est là.')).toBe('blocking');
  });

  it.each([
    'Tu peux demander de causer avec Emma par exemple.',
    'Est-ce qu\u2019Emma est là, au bout du fil ?',
    'Emma, tu peux aller la chercher ?',
    'Et Emma, tu me la passes ?',
    'Je peux avoir Emma au téléphone ?',
  ])('blocks when the player speaks of contact: %s', userText => {
    expect(mode(userText, 'Peut-être.')).toBe('blocking');
  });

  // Real slow turns of the 2026-11-27 diagnosis: only the name was there.
  it.each([
    ['Ouais, mais du du coup, tu, qu\u2019est-ce que tu aimerais dire à Emma', 'Que je l\u2019aime.'],
    ['Mais du coup,', 'Je voudrais rester auprès d\u2019Emma sans lui mentir.'],
    ['Bonjour Max, j\u2019aimerais savoir comment tu vas.', 'Je ne sais plus comment parler à Emma.'],
    ['Comment ça s\u2019est passé ?', 'Emma était terrorisée.'],
  ])('validates a name alone in the background: %s', (userText, reply) => {
    expect(mode(userText, reply)).toBe('background');
    expect(mode(userText, reply, true)).toBe('blocking');
  });
});

describe('handoff finalisation step', () => {
  const never = () => { throw new Error('validation must not run'); };
  /** Lease of a name-only turn; `nextTurn` binds the following one, which gets a new request id. */
  const lease = () => {
    const coordinator = new HandoffCoordinator();
    const bind = (request: string) => coordinator.bind('s', 'call', 'max', 'v1', request);
    const first = bind('turn-1');
    return { first, nextTurn: () => bind('turn-2') };
  };

  it('answer before the next turn: a granted passage holds that turn, then is written', () => {
    const { first } = lease();
    expect(handoffFinalizationStep('background', first.current(), () => true)).toBe('hold');
  });

  it('answer after the next turn started: nothing is written over it and the loss is recorded', () => {
    const { first, nextTurn } = lease();
    const second = nextTurn();
    expect(handoffFinalizationStep('background', first.current(), () => true)).toBe('late');
    expect(handoffFinalizationStep('background', first.current(), () => false)).toBe('drop');
    expect(second.current()).toBe(true);
  });

  it('writes nothing for a refused or absent passage', () => {
    expect(handoffFinalizationStep('background', true, () => false)).toBe('idle');
    expect(handoffFinalizationStep('skip', true, never)).toBe('idle');
    expect(handoffFinalizationStep('skip', false, never)).toBe('drop');
  });

  it('keeps the previous behaviour for a blocking turn', () => {
    expect(handoffFinalizationStep('blocking', true, never)).toBe('write');
    expect(handoffFinalizationStep('blocking', false, never)).toBe('drop');
  });
});
