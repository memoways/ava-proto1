import type { MaxRAGFormatOptions } from "@/services/ragService";
import { RICH_V2_RAG } from "@/agents/maxRichPromptCompiler";

/**
 * Politique RAG par variante de prompt Max.
 * `compact_v1` et `legacy` conservent exactement le comportement actuel ;
 * seuls les souvenirs de 900 caractères (3 × 900 = 2 700) s'appliquent à `rich_v2`.
 */
export function maxRagFormatOptionsForVariant(variant?: string | null): MaxRAGFormatOptions {
  if (variant === "optimized_v3") {
    return { maxItems: 3, itemChars: 700, totalChars: 1_800 };
  }
  if (variant === "rich_v2") {
    return {
      maxItems: RICH_V2_RAG.maxItems,
      itemChars: RICH_V2_RAG.maxItemChars,
      totalChars: RICH_V2_RAG.maxTotalChars,
    };
  }
  return {};
}
