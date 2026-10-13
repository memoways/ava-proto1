import { describe, it, expect, vi } from 'vitest';
import { consumeLLMSse } from './llmSse';
const encoder = new TextEncoder();
const frame = (text: string) => `data: ${JSON.stringify({choices:[{delta:{content:text}}]})}\r\n\r\n`;
function stream(text: string, size = 1) { const bytes = encoder.encode(text); return new ReadableStream<Uint8Array>({start(c) { for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size)); c.close(); }}); }
describe('P1 SSE ownership and completion', () => {
  it('decodes fragmented UTF-8, CRLF, metadata and exact DONE', async () => {
    const chunks:string[]=[]; expect(await consumeLLMSse(stream(': ping\r\n\r\n' + frame('Écoute.') + 'data:[DONE]\n\n'), t=>chunks.push(t), {timeoutMs:1000})).toBe('Écoute.'); expect(chunks).toEqual(['Écoute.']);
  });
  it.each([frame('Bonjour.'), 'data:{broken}\n\n', 'data:{"error":{"message":"failed"}}\n\n', 'data:[DONE]\n\n', 'data:{"choices":[{"finish_reason":"length"}]}\n\n'])('rejects incomplete or failed stream', async raw => { await expect(consumeLLMSse(stream(raw),()=>{}, {timeoutMs:1000})).rejects.toThrow(); });
  it('cancels a pending reader on parent abort after headers and ignores late content', async () => {
    const c = new AbortController(), cancelled = vi.fn(), token=vi.fn();
    const body = new ReadableStream<Uint8Array>({cancel:cancelled});
    const pending=consumeLLMSse(body,token,{signal:c.signal,timeoutMs:1000}); c.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'}); expect(cancelled).toHaveBeenCalled(); expect(token).not.toHaveBeenCalled();
  });
  it('surfaces consumer failure rather than treating it as malformed JSON', async () => {
    await expect(consumeLLMSse(stream(frame('Bonjour.')+'data:[DONE]\n\n'),()=>{throw new Error('identity');},{timeoutMs:1000})).rejects.toThrow('identity');
  });
});
