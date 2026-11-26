export interface OpenRouterPayloadInput {
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  reasoning?: boolean;
  /**
   * Opt-in: turn reasoning off even for models that think by default (Gemini 2.5 Flash).
   * Only short, latency-bound calls send it (overlay video selection); without it the
   * payload is unchanged for every other caller.
   */
  disable_reasoning?: boolean;
  /**
   * Opt-in OpenRouter provider preference (latency bench, lot 2). Sanitized by
   * `sanitizeProviderPreference`; absent for every Ava caller, so their payload is unchanged.
   */
  provider?: unknown;
  /**
   * Opt-in reasoning effort (latency bench, lot 2), for models the defaults below leave
   * thinking (gpt-oss, Gemini 3.x). Ignored when reasoning is requested; absent for Ava callers.
   */
  reasoning_effort?: unknown;
}

const REASONING_EFFORTS = new Set(["none", "minimal", "low", "medium", "high"]);

const PROVIDER_SORTS = new Set(["latency", "throughput", "price"]);
const PROVIDER_SLUG = /^[a-z0-9][a-z0-9._/-]{0,63}$/i;

/** Keeps only `sort`, `only`, `order` and `allow_fallbacks`, with bounded values; null when nothing valid. */
export function sanitizeProviderPreference(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof value.sort === "string" && PROVIDER_SORTS.has(value.sort)) out.sort = value.sort;
  for (const key of ["only", "order"] as const) {
    const list = value[key];
    if (!Array.isArray(list)) continue;
    const slugs = list.filter((item): item is string => typeof item === "string" && PROVIDER_SLUG.test(item)).slice(0, 8);
    if (slugs.length) out[key] = slugs;
  }
  if (typeof value.allow_fallbacks === "boolean") out.allow_fallbacks = value.allow_fallbacks;
  return Object.keys(out).length ? out : null;
}

/** Gemini 2.5 Flash / Flash-Lite think by default and can turn it off; Pro cannot (left untouched). */
const GEMINI_FLASH_THINKING = /^google\/gemini-2\.5-flash(?:$|[-:])/i;

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
  const forceReasoningOff = !reasoningRequested && body.disable_reasoning === true;

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
  } else if (forceReasoningOff && GEMINI_FLASH_THINKING.test(model)) {
    upstreamBody.reasoning = { enabled: false, exclude: true };
  }
  if (!reasoningRequested && typeof body.reasoning_effort === "string" && REASONING_EFFORTS.has(body.reasoning_effort)) {
    upstreamBody.reasoning = { effort: body.reasoning_effort, exclude: true };
  }
  const provider = sanitizeProviderPreference(body.provider);
  if (provider) upstreamBody.provider = provider;

  return { model, temperature, max_tokens, top_p, stream, upstreamBody };
}
