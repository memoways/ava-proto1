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
  // gpt-5-mini et la famille gpt-5.6 rejettent temperature/top_p (400 OpenRouter).
  const supportsSamplingParameters =
    !/^openai\/gpt-5-mini(?:$|[-:])/i.test(model) && !/^openai\/gpt-5\.6-/i.test(model);
  const temperature = supportsSamplingParameters ? (body.temperature ?? 0.8) : undefined;
  const max_tokens = body.max_tokens ?? 500;
  const top_p = supportsSamplingParameters ? (body.top_p ?? 0.95) : undefined;
  const stream = body.stream ?? true;
  const isReasoningModel =
    /^openai\/(gpt-5|o1|o3|o4)/.test(model) ||
    /^deepseek\/deepseek-(chat-v3\.1|r1)/.test(model) ||
    /^x-ai\/grok-(4|3-mini)/.test(model);
  const reasoningRequested = body.reasoning === true;

  const upstreamBody: Record<string, unknown> = {
    model,
    messages: body.messages,
    max_tokens,
    stream,
    usage: { include: true },
  };
  if (temperature !== undefined) upstreamBody.temperature = temperature;
  if (top_p !== undefined) upstreamBody.top_p = top_p;
  if (reasoningRequested) {
    upstreamBody.reasoning = { enabled: true, exclude: false };
  } else if (isReasoningModel) {
    const isGpt56 = /^openai\/gpt-5\.6-/i.test(model);
    const isOpenAIReasoning = /^openai\/(gpt-5|o1|o3|o4)/.test(model);
    upstreamBody.reasoning = isGpt56
      ? { effort: "none", exclude: true }
      : isOpenAIReasoning
        ? { effort: "minimal", exclude: true }
        : { enabled: false, exclude: true };
  }


  return { model, temperature, max_tokens, top_p, stream, upstreamBody };
}
