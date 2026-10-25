import { withTimeout } from './asyncUtils';

/** Strict SSE consumer. Transport EOF is not a completion marker. */
export async function consumeLLMSse(body: ReadableStream<Uint8Array>, onToken: (text: string) => void,
  options: { signal?: AbortSignal; timeoutMs: number; onMetadata?: (v: Record<string, unknown>) => void }): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', data: string[] = [], text = '', completed = false;
  const aborted = () => { if (options.signal?.aborted) throw new DOMException('LLM stream cancelled', 'AbortError'); };
  const cancel = () => { void reader.cancel(options.signal?.reason).catch(() => {}); };
  options.signal?.addEventListener('abort', cancel, { once: true });
  const event = () => {
    if (!data.length) return;
    const payload = data.join('\n'); data = [];
    if (payload.trim() === '[DONE]') { completed = true; return; }
    const value = JSON.parse(payload);
    // Preserve terminal technical evidence before rejecting its content.
    options.onMetadata?.(value);
    if (value.error) throw new Error(`LLM SSE error: ${value.error.message ?? 'upstream failure'}`);
    const choice = value.choices?.[0];
    if (typeof choice?.finish_reason === 'string' && choice.finish_reason !== 'stop') throw new Error(`LLM response incomplete (${choice.finish_reason})`);
    const content = choice?.delta?.content;
    if (typeof content === 'string' && content) { text += content; onToken(content); }
  };
  const line = (raw: string) => {
    const value = raw.replace(/\r$/, '');
    if (!value) event();
    else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  };
  try {
    aborted();
    while (!completed) {
      const chunk = await withTimeout('LLM stream body', reader.read(), options.timeoutMs, cancel);
      aborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let i: number;
      while ((i = buffer.indexOf('\n')) >= 0 && !completed) {
        line(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
      }
      if (buffer.length > 65536) throw new Error('LLM SSE event too large');
      if (chunk.done) { if (buffer) line(buffer); event(); break; }
    }
    aborted();
    if (!completed || !text.trim()) throw new Error('LLM EOF without complete response');
    return text;
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
