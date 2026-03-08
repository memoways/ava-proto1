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
export async function fetchGenerationCost(generationId: string): Promise<{
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} | null> {
  try {
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/proxy-llm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        _action: "get_generation_cost",
        generation_id: generationId,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[LLM Tracker] Cost fetch failed [${res.status}]:`, errText);
      return null;
    }
    const data = await res.json();
    console.log(`[LLM Tracker] Cost data for ${generationId}:`, data);
    return data;
  } catch (err) {
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
    // Small delay to let OpenRouter process the generation
    setTimeout(async () => {
      const costData = await fetchGenerationCost(params.generation_id!);
      if (costData) {
        await updateLLMUsage(logId, {
          cost_usd: costData.cost_usd,
          prompt_tokens: costData.prompt_tokens || params.prompt_tokens,
          completion_tokens: costData.completion_tokens || params.completion_tokens,
          total_tokens: costData.total_tokens || params.total_tokens,
          status: "completed",
        });
      } else {
        await updateLLMUsage(logId, { status: "cost_fetch_failed" });
      }
    }, 3000); // 3s delay for OpenRouter to finalize
  }
}
