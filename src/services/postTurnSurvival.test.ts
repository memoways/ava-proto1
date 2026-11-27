import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/openRouterLLM', () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock('@/services/settingsService', () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: 'gm', LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock('@/services/videoTriggerService', () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/sessionConversationMemory', () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));
import { callLLMWithUsage } from '@/services/openRouterLLM';
import { persistPostTurnMemory } from '@/services/sessionConversationMemory';
import { evaluatePostTurnPRD4 } from '@/agents/gameMasterPRD4';
import { HandoffCoordinator } from './handoffCoordinator';

const reply = JSON.stringify({ engagement_delta: 1, confusion_detected: false, role_usage_quality: 'high', topics_covered: [],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: 'Continue.', end_recommended: false,
  moderation_flag: false, notes: '', trigger_video_id: null, labels: { themes: [], topics: [], intentions: [] },
  memory_delta: null, action: { type: 'none' }, player_switch_request: null });

describe('GM post-turn of an ordinary turn', () => {
  beforeEach(() => vi.clearAllMocks());

  // Sessions 9e2ba88c (turns 5 and 8) and ab76a0c9 (turn 13): the player spoke again while the GM was answering.
  it('completes and is persisted when the next turn starts during it', async () => {
    const coordinator = new HandoffCoordinator();
    const first = coordinator.bind('session', 'call', 'max', 'v1', 'request-4');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(callLLMWithUsage).mockImplementationOnce(async () => {
      await gate;
      return { content: reply, model: 'gm', usage: null, generationId: null, latencyMs: 1, diagnosticTrace: null };
    });
    const pending = evaluatePostTurnPRD4({ sessionId: 'session', conversationHistory: [], userMessage: 'Et Emma ?',
      maxResponse: 'Emma est inquiète.', userRole: null, currentCharacter: 'max', turnIndex: 4, timeElapsedSeconds: 60,
      sessionDurationSeconds: 900, minimumClosureSeconds: 600, orchestrationVersionId: 'v1', signal: first.postTurnSignal });
    await vi.waitFor(() => expect(callLLMWithUsage).toHaveBeenCalled());
    coordinator.bind('session', 'call', 'max', 'v1', 'request-5');
    release();
    const result = await pending;
    expect(result.execution_status).toBe('executed');
    expect(persistPostTurnMemory).toHaveBeenCalledOnce();
    // The passage itself is superseded: nothing of it may still be written.
    expect(first.current()).toBe(false);
    expect(first.signal.aborted).toBe(true);
  });

  it('keeps the post-turn when the player declines the passage', () => {
    const coordinator = new HandoffCoordinator();
    const lease = coordinator.bind('session', 'call', 'max', 'v1', 'request');
    coordinator.invalidate();
    expect(lease.current()).toBe(false);
    expect(lease.postTurnSignal.aborted).toBe(false);
    expect(coordinator.bind('session', 'call', 'max', 'v1', 'next').postTurnSignal).toBe(lease.postTurnSignal);
  });

  it.each([
    ['call end or restart', (c: HandoffCoordinator) => { c.endCall(); }],
    ['character change', (c: HandoffCoordinator) => { c.bind('session', 'call', 'emma', 'v1', 'request'); }],
    ['new call', (c: HandoffCoordinator) => { c.bind('session', 'call-2', 'max', 'v1', 'request'); }],
    ['new session', (c: HandoffCoordinator) => { c.bind('session-2', 'call', 'max', 'v1', 'request'); }],
    ['call change after a declined passage', (c: HandoffCoordinator) => { c.invalidate(); c.bind('session', 'call-2', 'max', 'v1', 'r'); }],
  ])('cancels the post-turn on %s', (_label, change) => {
    const coordinator = new HandoffCoordinator();
    const lease = coordinator.bind('session', 'call', 'max', 'v1', 'request');
    change(coordinator);
    expect(lease.postTurnSignal.aborted).toBe(true);
    expect(lease.current()).toBe(false);
  });
});
