export interface OpenRouterPayloadInput {
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  reasoning?: boolean;
}

/** Pure constructor used by the proxy so diagnostics and tests observe its exact defaults. */
export function buildOpenRouterPayload(body: OpenRouterPayloadInput) {
  const model = body.model || "qwen/qwen-2.5-72b-instruct";
  const temperature = body.temperature ?? 0.8;
  const max_tokens = body.max_tokens ?? 500;
  const top_p = body.top_p ?? 0.95;
  const stream = body.stream ?? true;
  const isReasoningModel =
    /^openai\/(gpt-5|o1|o3|o4)/.test(model) ||
    /^deepseek\/deepseek-(chat-v3\.1|r1)/.test(model) ||
    /^x-ai\/grok-(4|3-mini)/.test(model);
  const reasoningRequested = body.reasoning === true;

  const upstreamBody: Record<string, unknown> = {
    model,
    messages: body.messages,
    temperature,
    max_tokens,
    top_p,
    stream,
    usage: { include: true },
  };
  if (reasoningRequested) {
    upstreamBody.reasoning = { enabled: true, exclude: false };
  } else if (isReasoningModel) {
    const isOpenAIReasoning = /^openai\/(gpt-5|o1|o3|o4)/.test(model);
    upstreamBody.reasoning = isOpenAIReasoning
      ? { effort: "minimal", exclude: true }
      : { enabled: false, exclude: true };
  }

  return { model, temperature, max_tokens, top_p, stream, upstreamBody };
}
