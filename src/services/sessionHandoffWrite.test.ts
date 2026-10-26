import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import type { Json } from '@/integrations/supabase/types';
import { matchesHandoffWrite, type HandoffSnapshot } from './sessionHandoff';
import { advanceHandoffTurn } from './characterHandoffState';

const next = advanceHandoffTurn(null, { sessionId: 'session', sourceCharacter: 'emma',
  orchestrationVersionId: 'v1', turnId: 'session:2', turnIndex: 2 }, 'Je veux parler à Max.');
const expected: HandoffSnapshot = { id: 'session', orchestration_version_id: 'v1', active_character: 'emma',
  handoff_count: 0, pending_handoff: null, conversation_log: [] };
const actual: HandoffSnapshot = { ...expected, pending_handoff: next as unknown as Json };

describe('F1 ambiguous CAS acknowledgement', () => {
  it('recognizes this exact write without issuing a second mutation', () => {
    expect(matchesHandoffWrite(actual, expected, next)).toBe(true);
    const reordered = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(next))).reverse());
    expect(matchesHandoffWrite({ ...actual, pending_handoff: reordered as Json }, expected, next)).toBe(true);
    expect(matchesHandoffWrite({ ...actual, active_character: 'max', handoff_count: 1 }, expected, next, 'max')).toBe(true);
  });
  it.each([
    { id: 'another-session' }, { orchestration_version_id: 'v2' }, { active_character: 'max' as const },
    { handoff_count: 1 }, { pending_handoff: { ...next, revision: 'another-window' } as unknown as Json },
  ])('refuses to adopt foreign or advanced state: %j', patch => {
    expect(matchesHandoffWrite({ ...actual, ...patch }, expected, next)).toBe(false);
  });
});
