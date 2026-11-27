/** Latency lot 3: pure helpers shared by the LLM client and the usage tracker. */

/** OpenRouter usage, with the cache detail it returns when `usage.include` is set. */
export interface OpenRouterUsageLike {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
}

/** Cached prompt tokens reported by OpenRouter; null when the provider says nothing. */
export function readCachedTokens(usage: OpenRouterUsageLike | null | undefined): number | null {
  const cached = usage?.prompt_tokens_details?.cached_tokens;
  return typeof cached === "number" && Number.isFinite(cached) && cached >= 0 ? Math.round(cached) : null;
}
