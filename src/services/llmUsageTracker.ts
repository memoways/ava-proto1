/**
 * LLM Usage Tracker
 * 
 * Logs every OpenRouter call with token counts and costs.
 * 
 * FUTURE EXTENSIBILITY:
 * - Budget per session / per day: query SUM(cost_usd) WHERE created_at > today
 * - Alerts: check cost threshold after each log, trigger notification
 * - Fallback to cheaper model: if daily budget exceeded, swap model in openRouterLLM
 * - Rate limiting: count requests per minute per session
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const COST_ERROR_LOG_STORAGE_KEY = "ava_openrouter_cost_error_logs";
const COST_FETCH_TIMEOUT_MS = 10000;

export interface CostErrorLogEntry {
  session_id?: string | null;
  generation_id?: string | null;
  error_type: "not_found" | "timeout" | "server_error" | "network_error" | "http_error" | "unknown";
  status_code?: number | null;
  error_message?: string | null;
  source?: string;
  metadata_json?: Record<string, unknown>;
  occurred_at?: string;
}

export interface UsageLogEntry {
  session_id?: string | null;
  feature_key: string;
  request_type?: string;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  generation_id?: string | null;
  cost_usd?: number;
  status?: string;
  metadata_json?: Record<string, unknown>;
  error_message?: string | null;
}

function saveCostErrorLocally(entry: CostErrorLogEntry) {
  try {
    const existing = localStorage.getItem(COST_ERROR_LOG_STORAGE_KEY);
    const parsed = existing ? JSON.parse(existing) : [];
    const next = [
      {
        ...entry,
        occurred_at: entry.occurred_at || new Date().toISOString(),
      },
      ...((Array.isArray(parsed) ? parsed : []) as CostErrorLogEntry[]),
    ].slice(0, 100);
    localStorage.setItem(COST_ERROR_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[LLM Tracker] Local cost error log failed:", err);
  }
}

export async function logCostFetchError(entry: CostErrorLogEntry): Promise<void> {
  const occurredAt = entry.occurred_at || new Date().toISOString();
  const normalizedEntry = {
    session_id: entry.session_id || null,
    generation_id: entry.generation_id || null,
    error_type: entry.error_type,
    status_code: entry.status_code ?? null,
    error_message: entry.error_message || null,
    source: entry.source || "cost_fetch",
    metadata_json: entry.metadata_json || {},
    occurred_at: occurredAt,
  };

  saveCostErrorLocally(normalizedEntry);

  try {
    const { error } = await supabase
      .from("openrouter_cost_error_logs" as any)
      .insert(normalizedEntry as any);

    if (error) {
      console.error("[LLM Tracker] Cost error DB insert failed:", error.message);
    }
  } catch (err) {
    console.error("[LLM Tracker] Cost error DB insert exception:", err);
  }
}

function getCostErrorType(status?: number, err?: unknown): CostErrorLogEntry["error_type"] {
  if (status === 404) return "not_found";
  if (status && status >= 500) return "server_error";
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  if (err instanceof TypeError) return "network_error";
  if (status) return "http_error";
  return "unknown";
}

/**
 * Insert a usage log row. Returns the row id for later update.
 */
export async function logLLMUsage(entry: UsageLogEntry): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("llm_usage" as any)
      .insert({
        session_id: entry.session_id || null,
        feature_key: entry.feature_key,
        request_type: entry.request_type || "chat_completion",
        model: entry.model,
        prompt_tokens: entry.prompt_tokens || 0,
        completion_tokens: entry.completion_tokens || 0,
        total_tokens: entry.total_tokens || 0,
        generation_id: entry.generation_id || null,
        cost_usd: entry.cost_usd || 0,
        status: entry.status || "pending",
        metadata_json: entry.metadata_json || {},
        error_message: entry.error_message || null,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("[LLM Tracker] Insert error:", error.message);
      return null;
    }
    return (data as any)?.id || null;
  } catch (err) {
    console.error("[LLM Tracker] Exception:", err);
    return null;
  }
}

/**
 * Update an existing usage log row (e.g. with final cost from generation API).
 */
export async function updateLLMUsage(
  id: string,
  updates: Partial<UsageLogEntry>
): Promise<void> {
  try {
    const { error } = await supabase
      .from("llm_usage" as any)
      .update(updates as any)
      .eq("id", id);

    if (error) {
      console.error("[LLM Tracker] Update error:", error.message);
    }
  } catch (err) {
    console.error("[LLM Tracker] Update exception:", err);
  }
}

/**
 * Fetch the cost for a generation from OpenRouter's generation API.
 * This is called via the edge function proxy to keep the API key server-side.
 */
export async function fetchGenerationCost(
  generationId: string,
  context?: { session_id?: string | null; source?: string; metadata_json?: Record<string, unknown> }
): Promise<{
  available?: boolean;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} | null> {
  try {
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), COST_FETCH_TIMEOUT_MS);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        _action: "get_generation_cost",
        generation_id: generationId,
      }),
    });
    clearTimeout(timeoutId);
    const rawText = await res.text();
    let payload: any = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const errText = rawText;
      await logCostFetchError({
        session_id: context?.session_id,
        generation_id: generationId,
        error_type: getCostErrorType(res.status),
        status_code: res.status,
        error_message: errText.slice(0, 500),
        source: context?.source || "cost_fetch",
        metadata_json: {
          ...(context?.metadata_json || {}),
          stage: "fetch_generation_cost",
        },
      });
      // OpenRouter may return 404 while generation accounting is still propagating.
      // This is non-blocking for gameplay; retryCostFetch will try again later.
      if (res.status === 404) {
        console.warn(`[LLM Tracker] Cost not available yet for ${generationId} [404], retrying later.`);
        return null;
      }
      console.warn(`[LLM Tracker] Cost fetch unavailable [${res.status}]:`, errText);
      return null;
    }

    if (payload?.available === false) {
      await logCostFetchError({
        session_id: context?.session_id,
        generation_id: generationId,
        error_type: payload?.error_type || getCostErrorType(payload?.status_code),
        status_code: payload?.status_code ?? null,
        error_message: String(payload?.details || payload?.error || "Generation cost unavailable").slice(0, 500),
        source: context?.source || "cost_fetch",
        metadata_json: {
          ...(context?.metadata_json || {}),
          stage: "fetch_generation_cost",
          retryable: payload?.retryable ?? false,
        },
      });

      if (payload?.status_code === 404) {
        console.warn(`[LLM Tracker] Cost not available yet for ${generationId} [404], retrying later.`);
        return null;
      }

      console.warn(`[LLM Tracker] Generation cost unavailable:`, payload);
      return null;
    }

    const data = payload;
    console.log(`[LLM Tracker] Cost data for ${generationId}:`, data);
    return data;
  } catch (err) {
    await logCostFetchError({
      session_id: context?.session_id,
      generation_id: generationId,
      error_type: getCostErrorType(undefined, err),
      error_message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      source: context?.source || "cost_fetch",
      metadata_json: {
        ...(context?.metadata_json || {}),
        stage: "fetch_generation_cost",
      },
    });
    console.error("[LLM Tracker] Cost fetch exception:", err);
    return null;
  }
}

/**
 * Full tracking flow: log initial entry, then async fetch cost and update.
 * Call this after receiving an OpenRouter response.
 */
export async function trackLLMCall(params: {
  session_id?: string | null;
  feature_key: string;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  generation_id?: string | null;
  status?: string;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const logId = await logLLMUsage({
    session_id: params.session_id,
    feature_key: params.feature_key,
    model: params.model,
    prompt_tokens: params.prompt_tokens,
    completion_tokens: params.completion_tokens,
    total_tokens: params.total_tokens,
    generation_id: params.generation_id,
    status: params.status || "success",
    metadata_json: params.metadata,
    error_message: params.error_message,
  });

  if (!logId) return;

  // Async: fetch cost from OpenRouter generation API if we have a generation_id
  if (params.generation_id) {
    retryCostFetch(logId, params.generation_id!, params, [15000, 30000, 60000]);
  }
}

/**
 * Retry cost fetch with escalating delays.
 */
async function retryCostFetch(
  logId: string,
  generationId: string,
  params: { session_id?: string | null; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  delays: number[]
): Promise<void> {
  if (delays.length === 0) {
    console.warn(`[LLM Tracker] Cost unavailable after all retries for ${generationId}`);
    await updateLLMUsage(logId, { status: "cost_fetch_failed" });
    return;
  }

  const [delay, ...remaining] = delays;
  setTimeout(async () => {
    console.log(`[LLM Tracker] Fetching cost for ${generationId} (delay=${delay}ms, retries left=${remaining.length})`);
    try {
      const costData = await fetchGenerationCost(generationId, {
        session_id: params.session_id,
        source: "cost_fetch_retry",
        metadata_json: {
          retries_remaining: remaining.length,
        },
      });
      if (costData && costData.cost_usd > 0) {
        await updateLLMUsage(logId, {
          cost_usd: costData.cost_usd,
          prompt_tokens: costData.prompt_tokens || params.prompt_tokens,
          completion_tokens: costData.completion_tokens || params.completion_tokens,
          total_tokens: costData.total_tokens || params.total_tokens,
          status: "completed",
        });
        console.log(`[LLM Tracker] Cost updated: $${costData.cost_usd} for ${generationId}`);
      } else {
        // Retry with next delay
        retryCostFetch(logId, generationId, params, remaining);
      }
    } catch (err) {
      await logCostFetchError({
        session_id: params.session_id,
        generation_id: generationId,
        error_type: getCostErrorType(undefined, err),
        error_message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        metadata_json: {
          stage: "retry_cost_fetch",
          retries_remaining: remaining.length,
        },
      });
      console.error(`[LLM Tracker] Cost fetch error:`, err);
      retryCostFetch(logId, generationId, params, remaining);
    }
  }, delay);
}

/**
 * Retry cost fetch for a specific row (called from admin UI).
 */
export async function retryCostForRow(row: {
  id: string;
  session_id?: string | null;
  generation_id: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}): Promise<boolean> {
  if (!row.generation_id) return false;
  const costData = await fetchGenerationCost(row.generation_id, {
    session_id: row.session_id,
    source: "cost_fetch_admin_retry",
  });
  if (costData && costData.cost_usd > 0) {
    await updateLLMUsage(row.id, {
      cost_usd: costData.cost_usd,
      prompt_tokens: costData.prompt_tokens || row.prompt_tokens,
      completion_tokens: costData.completion_tokens || row.completion_tokens,
      total_tokens: costData.total_tokens || row.total_tokens,
      status: "completed",
    });
    return true;
  }
  return false;
}
