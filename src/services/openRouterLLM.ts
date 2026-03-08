const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

type StreamCallback = (text: string, done: boolean) => void;

/**
 * Streaming LLM call via proxy-llm Edge Function
 */
export async function streamLLM(
  messages: Message[],
  onChunk: StreamCallback,
  options?: LLMOptions
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      stream: true,
      ...options,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM error: ${response.status} - ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process SSE lines
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        onChunk(fullText, true);
        return fullText;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onChunk(content, false);
        }
      } catch {
        // Partial JSON, put back and wait
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  onChunk(fullText, true);
  return fullText;
}

/**
 * Non-streaming LLM call
 */
export async function callLLM(
  messages: Message[],
  options?: LLMOptions
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      stream: false,
      ...options,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
