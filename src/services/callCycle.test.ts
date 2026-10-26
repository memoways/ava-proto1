import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { withLegacyCallMarker, callTime, newCall, closedCallHistory, freshCallState, sourceCallId, canApplyPendingClose } from './callCycle';
import { completedCallExchanges } from './handoffCoordinator';
import { greetingDelivery, characterRecallGreeting } from './characterConversationContinuity';
import type { ConversationMessage } from '@/types';
import type { HandoffSnapshot } from './sessionHandoff';

const greeting = (now = 1000): ConversationMessage => ({ role: 'max', spokenWith: 'max', content: 'Allô.', timestamp: now,
  callStart: newCall(900, 600, now) });
const snapshot = (history: ConversationMessage[]): HandoffSnapshot => ({ id: 's', active_character: 'max', handoff_count: 3,
  orchestration_version_id: 'v', pending_handoff: null, conversation_log: history });
describe('F2 cycle metadata', () => {
  it('preserves paused budget through arbitrarily long grid/reload; running reload consumes real elapsed time', () => {
    const history = [greeting()];
    expect(callTime(history, 101000)).toMatchObject({ remainingSeconds: 500, paused: false });
    const closed = closedCallHistory(history, { at: 101000, remainingSeconds: 500, reason: 'user_hangup' });
    expect(callTime(closed, 999999999)).toMatchObject({ remainingSeconds: 500, elapsedSeconds: 400, paused: true });
    const recalled = { ...greeting(999999999), callStart: newCall(900, 500, 999999999) };
    expect(callTime([...closed, recalled], 1000000999)).toMatchObject({ remainingSeconds: 499, paused: false });
    expect(callTime(history, 999999999)?.remainingSeconds).toBe(0);
  });
  it('resets only complete exchanges even when recalling the same actor; greeting never counts', () => {
    const first = greeting();
    const user: ConversationMessage = { role: 'user', spokenWith: 'max', content: 'Secret Max', timestamp: 2000 };
    const reply: ConversationMessage = { role: 'max', spokenWith: 'max', content: 'Oui', timestamp: 3000,
      delivery: greetingDelivery('turn1', 1, 'max', 'Oui', { status: 'played', started: true }) };
    expect(completedCallExchanges([first, user, reply], 'max')).toBe(1);
    const next = greeting(5000);
    const history = [first, user, reply, next];
    expect(completedCallExchanges(history, 'max')).toBe(0);
    expect(sourceCallId(snapshot(history))).toBe(next.callStart!.id);
    expect(freshCallState(snapshot(history), 'max', next.callStart!.id)).toMatchObject({ sourceCallId: next.callStart!.id,
      sourceCharacter: 'max', state: 'none', openRequest: null, offer: null, orchestrationVersionId: 'v' });
    expect(snapshot(history).handoff_count).toBe(3);
    expect(history[1].content).toBe('Secret Max');
  });
  it('does not replay a close intent into another call, revision or experience', () => {
    const start = greeting(); const s = snapshot([start]);
    const intent = { callId: start.callStart!.id, at: 10, remainingSeconds: 400, reason: 'user_hangup', revision: null };
    expect(canApplyPendingClose(s, intent)).toBe(true);
    expect(canApplyPendingClose(snapshot([greeting()]), intent)).toBe(false);
    expect(canApplyPendingClose({ ...s, pending_handoff: freshCallState(s, 'max', intent.callId) as never }, intent)).toBe(false);
  });
  it('recall greetings do not invent a transfer or copy foreign confidences', () => {
    const history = [greeting(), { role: 'emma', spokenWith: 'emma', content: 'PRIVATE_EMMA', timestamp: 4 } as ConversationMessage];
    const line = characterRecallGreeting('max', history, 'First contact');
    expect(line).not.toContain('PRIVATE_EMMA'); expect(line).not.toContain('Emma'); expect(line).not.toBe('First contact');
    expect(characterRecallGreeting('emma', [greeting()], 'Hello Emma')).toBe('Hello Emma');
  });
  it('upgrades a legacy active call without losing history, complete exchanges or its sourceCallId', () => {
    const history: ConversationMessage[] = [
      { role: 'max', spokenWith: 'max', content: 'Allô', timestamp: 1 },
      { role: 'user', spokenWith: 'max', content: 'My secret', timestamp: 2 },
      { role: 'max', spokenWith: 'max', content: 'Oui', timestamp: 3,
        delivery: greetingDelivery('t', 1, 'max', 'Oui', { status: 'played', started: true }) },
    ];
    const upgraded = withLegacyCallMarker(snapshot(history), 900, 450, 1000);
    expect(upgraded).toHaveLength(3);
    expect(completedCallExchanges(upgraded, 'max')).toBe(1);
    expect(sourceCallId(snapshot(upgraded))).toBe('s:3');
    expect(callTime(upgraded, 1000)?.remainingSeconds).toBe(450);
    expect(upgraded.map(m => m.content)).toEqual(history.map(m => m.content));
  });

});
