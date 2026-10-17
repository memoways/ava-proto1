import type { MaxRAGFormatOptions } from "@/services/ragService";
import { RICH_V2_RAG } from "@/agents/maxRichPromptCompiler";

/**
 * Même plafond pour toutes les variantes explicites : un souvenir de
 * 1 694 caractères passe entier, et trois souvenirs restent le maximum.
 * `compact_v1` et `legacy` utilisent les mêmes défauts de `formatMaxRAGContext`.
 */
export function maxRagFormatOptionsForVariant(variant?: string | null): MaxRAGFormatOptions {
  if (variant === "optimized_v3" || variant === "rich_v2") {
    return {
      maxItems: RICH_V2_RAG.maxItems,
      itemChars: RICH_V2_RAG.maxItemChars,
      totalChars: RICH_V2_RAG.maxTotalChars,
    };
  }
  return {};
}
