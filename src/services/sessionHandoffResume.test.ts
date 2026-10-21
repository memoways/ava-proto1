import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchResumablePRD4Session, clearConversationMemoryCache } from './sessionConversationMemory';
import { advanceHandoffTurn, assessHandoffTurn, restoreHandoffOffer } from './characterHandoffState';
import { validInput } from './characterHandoff.fixtures';
import type { ConversationMessage } from '@/types';
const lookup = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock('@/services/gameAuth', () => ({ ensureGameAuth: vi.fn(async () => {}) }));
vi.mock('@/integrations/supabase/client', () => {
  const query = { select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: lookup.maybeSingle };
  return { supabase: { from: vi.fn(() => query) } };
});
const input = validInput();
const context = { sessionId: 'saved-session', sourceCharacter: 'emma' as const, orchestrationVersionId: 'v6', turnId: 'session:11', turnIndex: 11 };
const history: ConversationMessage[] = [...Array.from({ length: 10 }, () => ({ role: 'user' as const, content: 'Contexte', timestamp: 0 })),
  { role: 'user', content: input.userText, timestamp: 1, spokenWith: 'emma' },
  { role: 'emma', content: input.delivery!.generated, timestamp: 2, spokenWith: 'emma', delivery: input.delivery! }];
describe('saved offers through the actual session loading boundary', () => {
  beforeEach(() => { clearConversationMemoryCache(); lookup.maybeSingle.mockReset(); });
  it.each(['proof', 'stamp', 'none'] as const)('restores only current proof, not historical approval: %s', async kind => {
    const pending = kind === 'proof' ? assessHandoffTurn(advanceHandoffTurn(null, context), input).state
      : { targetCharacter: 'max', reason: 'Max peut éclairer ce sujet.', ...(kind === 'stamp'
        ? { gmApproval: { turnId: 'session:11', orchestrationVersionId: 'v6' } } : {}) };
    lookup.maybeSingle.mockResolvedValue({ error: null, data: { id: context.sessionId,
      started_at: '2026-10-21T09:00:00Z', resume_expires_at: '2026-10-21T09:20:00Z',
      active_character: 'emma', orchestration_version_id: 'v6', conversation_log: history, pending_handoff: pending } });
    const session = await fetchResumablePRD4Session(new Date('2026-10-21T09:10:00Z'));
    expect(restoreHandoffOffer(session?.pending_handoff, context, session!.conversation_log)?.targetCharacter ?? null)
      .toBe(kind === 'proof' ? 'max' : null);
    expect(restoreHandoffOffer(session?.pending_handoff, { ...context, orchestrationVersionId: 'v7' }, history)).toBeNull();
  });
});
