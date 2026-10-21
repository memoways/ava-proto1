import type { ConversationMessage } from '@/types';
import { describe, expect, it } from 'vitest';
import { advanceHandoffTurn, assessHandoffTurn, restoreHandoffOffer } from './characterHandoffState';
import { validInput } from './characterHandoff.fixtures';

const input = validInput();
const context = { sessionId: 'session', sourceCharacter: 'emma' as const, orchestrationVersionId: 'v6', turnId: 'session:11', turnIndex: 11 };
const history: ConversationMessage[] = [...Array.from({ length: 10 }, () => ({ role: 'user' as const, content: 'Contexte', timestamp: 0 })), { role: 'user' as const, content: input.userText, timestamp: 1, spokenWith: 'emma' as const },
  { role: 'emma' as const, content: input.delivery!.generated, timestamp: 2, spokenWith: 'emma' as const, delivery: input.delivery! }];
describe('handoff state ownership and lifetime', () => {
  it('requires delivered evidence and a current recommendation, without legacy regex', () => {
    const state = advanceHandoffTurn(null, context);
    const assessed = assessHandoffTurn(state, input);
    expect(assessed.validation.authorized).toBe(true);
    expect(assessed.state.state).toBe('available');
    expect(restoreHandoffOffer(assessed.state, context, history)?.targetCharacter).toBe('max');
    expect(restoreHandoffOffer(assessed.state, { ...context, sessionId: 'other' }, history)).toBeNull();
    expect(restoreHandoffOffer(assessed.state, { ...context, sourceCharacter: 'max' }, history)).toBeNull();
    expect(restoreHandoffOffer(assessed.state, { ...context, turnIndex: 12 }, history)).toBeNull();
    expect(restoreHandoffOffer(assessed.state, context, history.slice(0, 1))).toBeNull();
  });
  it('revokes at next submission and cannot recycle a prior affirmative reply', () => {
    const available = assessHandoffTurn(advanceHandoffTurn(null, context), input).state;
    const next = advanceHandoffTurn(available, { ...context, turnIndex: 12, turnId: 'session:12' });
    expect(next.state).toBe('none');
    expect(next.revision).not.toBe(available.revision);
    expect(restoreHandoffOffer(next, context, history)).toBeNull();
    expect(assessHandoffTurn(next, input).validation.reason).toBe('gm_late');
  });
  it('keeps a deferred request for at most two new messages, never as permission', () => {
    const deferred = structuredClone(input);
    deferred.evaluation.handoff_assessment!.consent.stance = 'defer';
    const open = assessHandoffTurn(advanceHandoffTurn(null, context), deferred).state;
    expect(open.state).toBe('awaiting_character');
    expect(open.openRequest?.expiresAfterTurnIndex).toBe(13);
    expect(advanceHandoffTurn(open, { ...context, turnIndex: 13, turnId: 'session:13' }).openRequest).toBeTruthy();
    expect(advanceHandoffTurn(open, { ...context, turnIndex: 14, turnId: 'session:14' }).openRequest).toBeNull();
    expect(restoreHandoffOffer(open, context, history)).toBeNull();
  });
  it('does not restore an old stamp, generated-only consent or different version', () => {
    const state = assessHandoffTurn(advanceHandoffTurn(null, context), input).state;
    expect(restoreHandoffOffer({ reason: 'old', targetCharacter: 'max', gmApproval: { turnId: context.turnId, orchestrationVersionId: 'v6' } }, context, history)).toBeNull();
    expect(restoreHandoffOffer(state, { ...context, orchestrationVersionId: 'v7' }, history)).toBeNull();
    const unheard = structuredClone(history); unheard[11].delivery!.delivered = '';
    expect(restoreHandoffOffer(state, context, unheard)).toBeNull();
  });
});

it('does not turn an accept classification without a recommendation into an open request', () => {
  const noAction = structuredClone(input);
  noAction.evaluation.action = { type: 'none' };
  const assessed = assessHandoffTurn(advanceHandoffTurn(null, context), noAction);
  expect(assessed.validation.reason).toBe('action_mismatch');
  expect(assessed.state).toMatchObject({ state: 'none', openRequest: null, offer: null });
});

it('can complete a still-open request on a later turn and restore only its delivered proof', () => {
  const deferred = structuredClone(input);
  deferred.evaluation.handoff_assessment!.consent.stance = 'defer';
  deferred.evaluation.action = { type: 'none' };
  const open = assessHandoffTurn(advanceHandoffTurn(null, context), deferred).state;
  const nextContext = { ...context, turnId: 'session:12', turnIndex: 12 };
  const nextState = advanceHandoffTurn(open, nextContext);
  const nextInput = structuredClone(input);
  nextInput.turnId = 'session:12'; nextInput.turnIndex = 12; nextInput.userText = 'Merci.';
  nextInput.delivery = { ...input.delivery!, turnId: 'session:12', turnIndex: 12 };
  nextInput.evaluation.turn_index = 12;
  Object.assign(nextInput.evaluation.handoff_assessment!, { turnId: 'session:12', turnIndex: 12 });
  const available = assessHandoffTurn(nextState, nextInput).state;
  expect(available.state).toBe('available');
  const log: ConversationMessage[] = [...history,
    { role: 'user', content: 'Merci.', timestamp: 3, spokenWith: 'emma' },
    { role: 'emma', content: nextInput.delivery!.generated, delivery: nextInput.delivery!, timestamp: 4, spokenWith: 'emma' }];
  expect(restoreHandoffOffer(available, nextContext, log)?.targetCharacter).toBe('max');
});

it('drops an open request on the character’s refusal even when the GM action is none', () => {
  const deferred = structuredClone(input); deferred.evaluation.handoff_assessment!.consent.stance = 'defer';
  const open = assessHandoffTurn(advanceHandoffTurn(null, context), deferred).state;
  const refused = structuredClone(input); refused.evaluation.handoff_assessment!.consent.stance = 'object';
  refused.evaluation.action = { type: 'none' };
  expect(assessHandoffTurn(open, refused).state).toMatchObject({ state: 'none', openRequest: null });
});
