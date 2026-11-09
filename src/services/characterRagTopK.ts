/** optimized_v3 deduplicates a wider RAG pool: the live turn never retrieves fewer than this. */
export const OPTIMIZED_V3_MIN_RAG_TOP_K = 6;

type PromptVariant = "legacy" | "compact_v1" | "rich_v2" | "optimized_v3";

/**
 * Character RAG top-k actually used by a live turn for this prompt variant.
 * Shared by the live orchestrator and the LLM judge replay so a reference run
 * reproduces the live retrieval.
 */
export function characterRagTopKForVariant(variant: PromptVariant | undefined, ragTopK: number | undefined): number {
  return variant === "optimized_v3"
    ? Math.max(OPTIMIZED_V3_MIN_RAG_TOP_K, ragTopK ?? 3)
    : ragTopK ?? 5;
}
