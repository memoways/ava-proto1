import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./gameAuth', () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock('./llmUsageTracker', () => ({ trackLLMCall: vi.fn() }));
vi.mock('./settingsService', () => ({ isReasoningEnabledForModel: () => false }));
vi.mock('./debugLogger', () => ({ debugLogger: { logFetch: vi.fn(), logResponse: vi.fn() } }));
import { authenticatedFunctionFetch } from './gameAuth';
import { trackLLMCall } from './llmUsageTracker';
import { streamLLM } from './openRouterLLM';
afterEach(() => vi.clearAllMocks());
describe('P1 failed stream evidence', () => {
  it.each(['length', 'error'])('retains terminal %s evidence without completing or emitting its content', async reason => {
    const frames = [
      { id: 'gen-failed', model: 'openai/gpt-5.6-luna', choices: [{ delta: { content: 'Bonjour.' } }] },
      { id: 'gen-failed', choices: [{ delta: { content: 'UNSAFE FINAL CONTENT' }, finish_reason: reason }], usage: { prompt_tokens: 1800, completion_tokens: 220, total_tokens: 2020 } },
    ].map(v => `data: ${JSON.stringify(v)}\n\n`).join('') + 'data: [DONE]\n\n';
    vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(frames));
    const chunk = vi.fn();
    await expect(streamLLM([{ role: 'user', content: 'Bonjour' }], chunk, { session_id: 'session-p1', model: 'openai/gpt-5.6-luna', max_tokens: 220 })).rejects.toThrow(`LLM response incomplete (${reason})`);
    expect(chunk.mock.calls).toEqual([['Bonjour.', false]]);
    expect(authenticatedFunctionFetch).toHaveBeenCalledTimes(1);
    expect(trackLLMCall).toHaveBeenCalledWith(expect.objectContaining({ generation_id: 'gen-failed', status: 'error', completion_tokens: 220, metadata: expect.objectContaining({ finish_reason: reason }) }));
  });
});
