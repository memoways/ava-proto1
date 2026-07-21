import { trackLLMCall } from "./llmUsageTracker";
import { debugLogger } from "./debugLogger";
import { TimeoutError, withTimeout } from "./asyncUtils";
import { authenticatedFunctionFetch } from "./gameAuth";
import { isReasoningEnabledForModel } from "./settingsService";
import type { LLMCallDiagnosticTrace } from "@/types";

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
  /** Hard client-side timeout. Keeps the conversation reactive even if the proxy/provider stalls. */
  timeoutMs?: number;
  /** Feature key for cost tracking (e.g. 'chat', 'game_master', 'analysis') */
  feature_key?: string;
  /** Session ID for cost tracking */
  session_id?: string | null;
  /** Cancels an obsolete conversation turn before its result reaches the UI. */
  signal?: AbortSignal;
  /** Force enable/disable reasoning. If undefined, reads from LLMSettings.LLM_REASONING[model]. */
  reasoning?: boolean;
  /** Return the exact sanitized proxy/upstream payload for an admin diagnostic session. */
  diagnostic_trace?: boolean;
}

type StreamCallback = (text: string, done: boolean) => void;
type LLMUsagePayload = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

const DEFAULT_LLM_TIMEOUT_MS = 18000;

function normalizeTimeoutError(err: unknown, label: string, timeoutMs: number): Error {
  if (err instanceof TimeoutError) return err;
  if (err instanceof DOMException && err.name === "AbortError") {
    return new TimeoutError(label, timeoutMs);
  }
  if (err instanceof Error && err.name === "AbortError") {
    return new TimeoutError(label, timeoutMs);
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function fetchProxyLLM(
  body: Record<string, unknown>,
  timeoutMs: number,
  label: string,
  parentSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const fetchPromise = authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  try {
    return await withTimeout(label, fetchPromise, timeoutMs, () => controller.abort());
  } catch (err) {
    if (parentSignal?.aborted) {
      throw new DOMException("Conversation turn aborted", "AbortError");
    }
    throw normalizeTimeoutError(err, label, timeoutMs);
  } finally {
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

/**
 * Streaming LLM call via proxy-llm Edge Function
 * Tracks usage in llm_usage table automatically.
 */
export async function streamLLM(
  messages: Message[],
  onChunk: StreamCallback,
  options?: LLMOptions
): Promise<string> {
  const model = options?.model || "qwen/qwen-2.5-72b-instruct";
  const featureKey = options?.feature_key || "chat";
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  const startTime = Date.now();
  const debugId = debugLogger.logFetch("llm", `Stream ${model}`, `${SUPABASE_URL}/functions/v1/proxy-llm`, {
    model, temperature: options?.temperature, max_tokens: options?.max_tokens, messages_count: messages.length,
    first_system: messages[0]?.content?.slice(0, 100) + "…",
    last_user: messages[messages.length - 1]?.content?.slice(0, 200),
  });

  let response: Response;
  try {
    response = await fetchProxyLLM(
      {
        messages,
        stream: true,
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        top_p: options?.top_p,
        timeout_ms: timeoutMs,
        reasoning: options?.reasoning ?? isReasoningEnabledForModel(model),
      },
      timeoutMs,
      `LLM stream ${model}`,
      options?.signal,
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    trackLLMCall({
      session_id: options?.session_id,
      feature_key: featureKey,
      model,
      status: "error",
      error_message: errorMessage.slice(0, 200),
    });
    throw err;
  }

  if (!response.ok) {
    const err = await response.text();
    debugLogger.logResponse(debugId, "llm", `Stream ${model}`, response.status, startTime, err);
    // Track error
    trackLLMCall({
      session_id: options?.session_id,
      feature_key: featureKey,
      model,
      status: "error",
      error_message: `HTTP ${response.status}: ${err.slice(0, 200)}`,
    });
    throw new Error(`LLM error: ${response.status} - ${err}`);
  }

  debugLogger.log({ service: "llm", level: "info", direction: "in", label: `Stream started (${model})`, durationMs: Date.now() - startTime });

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let usageData: LLMUsagePayload | null = null;
  let generationId: string | null = null;

  while (true) {
    const { done, value } = await withTimeout(
      `LLM stream read ${model}`,
      reader.read(),
      timeoutMs,
      () => reader.cancel().catch(() => {}),
    );
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

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
        debugLogger.log({ service: "llm", level: "success", direction: "in", label: `Stream complete (${model})`, durationMs: Date.now() - startTime, payload: `${fullText.length} chars, ${usageData?.total_tokens || "?"} tokens` });
        // Track usage after stream completes
        trackLLMCall({
          session_id: options?.session_id,
          feature_key: featureKey,
          model,
          prompt_tokens: usageData?.prompt_tokens,
          completion_tokens: usageData?.completion_tokens,
          total_tokens: usageData?.total_tokens,
          generation_id: generationId,
          status: "success",
        });
        return fullText;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onChunk(content, false);
        }
        // Capture usage data from the stream (sent in final chunk by OpenRouter)
        if (parsed.usage) {
          usageData = parsed.usage;
        }
        // Capture generation id
        if (parsed.id && !generationId) {
          generationId = parsed.id;
        }
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  onChunk(fullText, true);
  // Track even if no [DONE] marker received
  trackLLMCall({
    session_id: options?.session_id,
    feature_key: featureKey,
    model,
    prompt_tokens: usageData?.prompt_tokens,
    completion_tokens: usageData?.completion_tokens,
    total_tokens: usageData?.total_tokens,
    generation_id: generationId,
    status: "success",
  });
  return fullText;
}

export interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LLMCallResult {
  content: string;
  usage: LLMUsage | null;
  generationId: string | null;
  model: string;
  latencyMs: number;
  diagnosticTrace: LLMCallDiagnosticTrace | null;
}

export class LLMProxyRequestError extends Error {
  readonly diagnosticTrace: LLMCallDiagnosticTrace | null;

  constructor(message: string, diagnosticTrace: LLMCallDiagnosticTrace | null = null) {
    super(message);
    this.name = "LLMProxyRequestError";
    this.diagnosticTrace = diagnosticTrace;
  }
}

/**
 * Non-streaming LLM call returning both content and usage/latency metadata.
 * Use this in test/diagnostic UIs that need to display tokens.
 */
export async function callLLMWithUsage(
  messages: Message[],
  options?: LLMOptions
): Promise<LLMCallResult> {
  const model = options?.model || "qwen/qwen-2.5-72b-instruct";
  const featureKey = options?.feature_key || "chat";
  const startedAt = performance.now();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetchProxyLLM(
      {
        messages,
        stream: false,
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        top_p: options?.top_p,
        timeout_ms: timeoutMs,
        reasoning: options?.reasoning ?? isReasoningEnabledForModel(model),
        diagnostic_trace: options?.diagnostic_trace === true,
      },
      timeoutMs,
      `LLM request ${model}`,
      options?.signal,
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    trackLLMCall({
      session_id: options?.session_id,
      feature_key: featureKey,
      model,
      status: "error",
      error_message: errorMessage.slice(0, 200),
    });
    throw err;
  }

  if (!response.ok) {
    const err = await response.text();
    let diagnosticTrace: LLMCallDiagnosticTrace | null = null;
    if (options?.diagnostic_trace) {
      try {
        diagnosticTrace = (JSON.parse(err)?._ava_trace as LLMCallDiagnosticTrace | undefined) ?? null;
      } catch {
        diagnosticTrace = null;
      }
    }
    trackLLMCall({
      session_id: options?.session_id,
      feature_key: featureKey,
      model,
      status: "error",
      error_message: `HTTP ${response.status}: ${err.slice(0, 200)}`,
    });
    throw new LLMProxyRequestError(`LLM error: ${response.status} - ${err}`, diagnosticTrace);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || null;
  const generationId = data.id || null;
  const diagnosticTrace = options?.diagnostic_trace && data._ava_trace
    ? data._ava_trace as LLMCallDiagnosticTrace
    : null;

  trackLLMCall({
    session_id: options?.session_id,
    feature_key: featureKey,
    model,
    prompt_tokens: usage?.prompt_tokens,
    completion_tokens: usage?.completion_tokens,
    total_tokens: usage?.total_tokens,
    generation_id: generationId,
    status: "success",
  });

  return {
    content,
    usage,
    generationId,
    model: typeof data.model === "string" && data.model ? data.model : model,
    latencyMs: Math.round(performance.now() - startedAt),
    diagnosticTrace,
  };
}

/**
 * Non-streaming LLM call with automatic usage tracking.
 */
export async function callLLM(
  messages: Message[],
  options?: LLMOptions
): Promise<string> {
  const result = await callLLMWithUsage(messages, options);
  return result.content;
}
