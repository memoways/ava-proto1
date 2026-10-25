import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./gameAuth', () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock('./llmUsageTracker', () => ({ trackLLMCall: vi.fn() }));
vi.mock('./settingsService', () => ({ isReasoningEnabledForModel: () => false }));
vi.mock('./debugLogger', () => ({ debugLogger: { logFetch: vi.fn(), logResponse: vi.fn() } }));
import { authenticatedFunctionFetch } from './gameAuth';
import { trackLLMCall } from './llmUsageTracker';
import { ResponseIntentParser, SPEECH_BOUNDARY } from './responseIntentStream';
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


describe('lot 3 — SSE terminal proof at the real streaming call', () => {
  const context = { characterKey: 'max' as const, displayName: 'Max Lorenzo', characterId: '11111111-1111-4111-8111-111111111111',
    notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: '2026-10-25T00:00:00Z' };
  const header = JSON.stringify({ goal: 'PRIVATE', points: [] }) + SPEECH_BOUNDARY;
  const speech = 'Max, il… bon. Emma, elle reste Emma. Hein ?';
  const wire = header + speech + '\n</speech';
  const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  const terminal = (reason: string) => `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}\n\n`;
  it('accepts the known residue at all model-token splits and byte-fragmented SSE without replay', async () => {
    for (let split = 0; split <= wire.length; split++) {
      const bytes = new TextEncoder().encode(frame(wire.slice(0, split)) + frame(wire.slice(split)) + terminal('stop') + 'data: [DONE]\n\n');
      const body = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
      vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(body));
      const spoken: string[] = [];
      const parser = new ResponseIntentParser(context, () => {}, text => spoken.push(text));
      let normal = false;
      await streamLLM([], (text, done) => { if (!done) parser.push(text); }, { onStreamComplete: reason => { normal = reason === 'stop'; } });
      expect(parser.finish(normal)).toBe(speech);
      expect(spoken.join(' ')).toBe(speech);
      expect(spoken.join(' ')).not.toMatch(/PRIVATE|speech/);
    }
    expect(authenticatedFunctionFetch).toHaveBeenCalledTimes(wire.length + 1);
  });
  it.each(['length', 'error', 'content_filter', 'tool_calls', 'eof', 'missing_reason'])('does not rescue terminal %s after an emitted phrase', async reason => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(frame(wire)
      + (reason === 'eof' ? '' : (reason === 'missing_reason' ? '' : terminal(reason)) + 'data: [DONE]\n\n')));
    const spoken: string[] = [];
    const parser = new ResponseIntentParser(context, () => {}, text => spoken.push(text));
    let normal = false;
    await expect((async () => {
      await streamLLM([], (text, done) => { if (!done) parser.push(text); }, { onStreamComplete: r => { normal = r === 'stop'; } });
      return parser.finish(normal);
    })()).rejects.toThrow();
    expect(authenticatedFunctionFetch).toHaveBeenCalledOnce();
    expect(spoken.join(' ')).toBe(speech);
  });
});
