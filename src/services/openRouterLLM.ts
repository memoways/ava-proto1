import { consumeLLMSse } from "./llmSse";
import { observeVoice, observeService, type VoiceObserver, type ServiceObservation, type ServerObservation } from "./voiceTurnTelemetryV2";
import { trackLLMCall } from "./llmUsageTracker";
import { debugLogger } from "./debugLogger";
import { TimeoutError, withTimeout } from "./asyncUtils";
import { authenticatedFunctionFetch } from "./gameAuth";
import { isReasoningEnabledForModel } from "./settingsService";
import type { LLMCallDiagnosticTrace } from "@/types";
import { getSupportedSamplingParameters } from "./llmModelCapabilities";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  /** Called only after strict SSE completion; preserves the upstream reason. */
  onStreamComplete?: (finishReason: string | null) => void;
  onVoiceObservation?: VoiceObserver;
  onServiceObserved?: (value: ServiceObservation) => void;
  onServerObserved?: (value: ServerObservation) => void;
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
  const samplingParameters = getSupportedSamplingParameters(model, options?.temperature, options?.top_p);

  const startTime = Date.now();
  const debugId = debugLogger.logFetch("llm", `Stream ${model}`, `${SUPABASE_URL}/functions/v1/proxy-llm`, {
    model, temperature: options?.temperature, max_tokens: options?.max_tokens, messages_count: messages.length,
    first_system: messages[0]?.content?.slice(0, 100) + "…",
    last_user: messages[messages.length - 1]?.content?.slice(0, 200),
  });

  const controller = new AbortController();
  const abort = () => controller.abort(options?.signal?.reason);
  if (options?.signal?.aborted) abort();
  else options?.signal?.addEventListener("abort", abort, { once: true });
  let generationId: string | null = null;
  let usage: LLMUsagePayload | null = null;
  let finishReason: string | null = null;
  let firstToken = false;
  observeVoice(options?.onVoiceObservation, "llm_request");
  try {
    const response = await withTimeout(`LLM stream ${model}`,
      authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ messages, stream: true, model, ...samplingParameters,
          max_tokens: options?.max_tokens, timeout_ms: timeoutMs,
          reasoning: options?.reasoning ?? isReasoningEnabledForModel(model) }),
      }), timeoutMs, () => controller.abort());
    observeVoice(options?.onVoiceObservation, "llm_headers");
    if (!response.ok) throw new Error(`LLM error: ${response.status}`);
    if (!response.body) throw new Error('No response body');
    const fullText = await consumeLLMSse(response.body, content => {
      if (!firstToken) { firstToken = true; observeVoice(options?.onVoiceObservation, "first_token"); }
      onChunk(content, false);
    }, { signal: controller.signal, timeoutMs, onMetadata: value => {
      if (typeof value.id === 'string') generationId = value.id;
      if (value.usage) usage = value.usage as LLMUsagePayload;
      const choices = value.choices as Array<{ finish_reason?: unknown }> | undefined;
      if (Array.isArray(choices) && typeof choices[0]?.finish_reason === 'string') finishReason = choices[0].finish_reason;
      if (typeof value.model === 'string') observeService(options?.onServiceObserved, {
        service: 'llm', requested_provider: 'openrouter', requested_model: model,
        resolved_provider: 'openrouter', resolved_model: model,
        effective_provider: typeof value.provider === 'string' ? value.provider : null,
        effective_model: value.model, transport: 'sse', fallback: value.model !== model,
      });
      if (value._ava_observability) options?.onServerObserved?.(value._ava_observability as ServerObservation);
    }});
    if (controller.signal.aborted) throw new DOMException('LLM cancelled', 'AbortError');
    observeVoice(options?.onVoiceObservation, "llm_response");
    options?.onStreamComplete?.(finishReason);
    onChunk(fullText, true);
    const finalUsage = usage as LLMUsagePayload | null;
    trackLLMCall({ session_id: options?.session_id, feature_key: featureKey, model,
      prompt_tokens: finalUsage?.prompt_tokens, completion_tokens: finalUsage?.completion_tokens,
      total_tokens: finalUsage?.total_tokens, generation_id: generationId, status: 'success' });
    debugLogger.logResponse(debugId, 'llm', `Stream ${model}`, response.status, startTime);
    return fullText;
  } catch (error) {
    const failedUsage = usage as LLMUsagePayload | null;
    trackLLMCall({ session_id: options?.session_id, feature_key: featureKey, model,
      generation_id: generationId, prompt_tokens: failedUsage?.prompt_tokens,
      completion_tokens: failedUsage?.completion_tokens, total_tokens: failedUsage?.total_tokens,
      metadata: { finish_reason: finishReason },
      status: 'error', error_message: error instanceof Error ? error.message.slice(0, 200) : 'Stream failed' });
    throw error;
  } finally {
    controller.abort();
    options?.signal?.removeEventListener('abort', abort);
  }
}

export interface LLMUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LLMCallResult {
  finishReason?: string | null;
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
  const samplingParameters = getSupportedSamplingParameters(model, options?.temperature, options?.top_p);
  observeVoice(options?.onVoiceObservation, "llm_request", startedAt);

  let response: Response;
  try {
    response = await fetchProxyLLM(
      {
        messages,
        stream: false,
        model: options?.model,
        ...samplingParameters,
        max_tokens: options?.max_tokens,
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

  observeVoice(options?.onVoiceObservation, "llm_headers");
  if (!response.ok) {
    const err = await response.text();
    try { const technical = JSON.parse(err)?._ava_observability; if (technical) options?.onServerObserved?.(technical); } catch { /* Non-JSON error or collector failure. */ }
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
  observeVoice(options?.onVoiceObservation, "llm_response");
  observeService(options?.onServiceObserved, {
    service: options?.feature_key === "prd4_gm_post_turn" ? "gm" : "llm",
    requested_provider: "openrouter", requested_model: options?.model ?? null,
    resolved_provider: "openrouter", resolved_model: model,
    effective_provider: typeof data.provider === "string" ? data.provider : null,
    effective_model: typeof data.model === "string" && data.model ? data.model : null,
    transport: "http_batch", fallback: typeof data.model === "string" && data.model !== model,
  });
  try { if (data._ava_observability) options?.onServerObserved?.(data._ava_observability); } catch { /* diagnostic only */ }
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
    finishReason: typeof data.choices?.[0]?.finish_reason === 'string' ? data.choices[0].finish_reason : null,
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
