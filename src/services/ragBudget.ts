/**
 * Injection budget for editorial souvenirs.
 * The longest current body is 1_694 characters. 2_000 also covers the parent
 * period and the surviving character prefix. 6_100 is 3 × 2_000 plus the
 * "Souvenir N" labels. See docs/plan_chunking_souvenirs_editoriaux.md.
 */
export const MAX_MAX_RAG_ITEMS = 3;
export const MAX_MAX_RAG_ITEM_CHARS = 2_000;
export const MAX_MAX_RAG_CONTEXT_CHARS = 6_100;
