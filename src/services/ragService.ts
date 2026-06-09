import { debugLogger } from "./debugLogger";
import type { MaxTurnKnowledgeContext } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface RAGMatch {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  similarity: number;
  /** Cosine similarity from the vector retrieval (kept for traceability when rerank reorders). */
  retrieval_similarity?: number;
  /** Score returned by Voyage rerank-2.5 if reranking was applied. */
  rerank_score?: number;
  /** Owning character (null for shared sources like storyworld). */
  character_id?: string | null;
}

export interface RAGQueryOptions {
  recentContext?: string;
  matchCount?: number;
  matchThreshold?: number;
  /** Restrict character-scoped chunks to this character. Shared chunks (NULL) always remain visible. */
  characterId?: string | null;
  /** Embedding+rerank provider override; falls back to backend default. */
  provider?: "voyage" | "openai";
  /** Disable rerank explicitly. */
  rerank?: boolean;
  /** Override retrieve_k (top fetched before rerank). */
  retrieveK?: number;
  /** Pre-rewritten search query — when provided, used as-is instead of userMessage+context. */
  rewrittenQuery?: string;
}

async function callQueryRag(payload: Record<string, unknown>): Promise<{ matches: RAGMatch[]; embedding_provider?: string; rerank_used?: boolean; latency_ms?: number; error?: string; status?: number }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.text();
    return { matches: [], error: `HTTP ${response.status}: ${err.slice(0, 300)}`, status: response.status };
  }
  const data = await response.json();
  return {
    matches: data.matches || [],
    embedding_provider: data.embedding_provider,
    rerank_used: data.rerank_used,
    latency_ms: data.latency_ms,
  };
}

/**
 * Query RAG to find relevant narrative context for a conversation turn.
 * Combines user message + recent conversation for better semantic matching.
 */
export async function queryRAG(
  userMessage: string,
  recentContext?: string,
  matchCount = 5,
  matchThreshold = 0.3,
  options: Omit<RAGQueryOptions, "recentContext" | "matchCount" | "matchThreshold"> = {},
): Promise<RAGMatch[]> {
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("rag", `RAG query (top ${matchCount}${options.characterId ? `, char=${options.characterId.slice(0, 8)}` : ""})`, `${SUPABASE_URL}/functions/v1/query-rag`, { user_message: userMessage.slice(0, 200) });

  try {
    const res = await callQueryRag({
      query: options.rewrittenQuery || userMessage,
      user_message: userMessage,
      recent_context: recentContext,
      match_count: matchCount,
      match_threshold: matchThreshold,
      character_id: options.characterId ?? null,
      provider: options.provider,
      rerank: options.rerank,
      retrieve_k: options.retrieveK,
    });
    if (res.error) {
      debugLogger.logResponse(debugId, "rag", "RAG query", res.status || 500, startTime, res.error);
      return [];
    }
    debugLogger.logResponse(debugId, "rag", `RAG → ${res.matches.length} matches (${res.embedding_provider}${res.rerank_used ? "+rerank" : ""})`, 200, startTime, res.matches.map((m) => `${m.source_table}: ${m.content.slice(0, 80)}… (sim ${m.similarity.toFixed(2)})`).join("\n"));
    return res.matches;
  } catch (error) {
    debugLogger.logError("rag", "RAG query failed", error);
    return [];
  }
}

export interface RAGQueryDetailed {
  matches: RAGMatch[];
  latencyMs: number;
  embeddingProvider?: string;
  rerankUsed?: boolean;
  error?: string;
}

/** Detailed RAG query for diagnostics: returns latency + provider + error if any. */
export async function queryRAGDetailed(
  userMessage: string,
  recentContext?: string,
  matchCount = 5,
  matchThreshold = 0.3,
  options: Omit<RAGQueryOptions, "recentContext" | "matchCount" | "matchThreshold"> = {},
): Promise<RAGQueryDetailed> {
  const startedAt = performance.now();
  try {
    const res = await callQueryRag({
      query: options.rewrittenQuery || userMessage,
      user_message: userMessage,
      recent_context: recentContext,
      match_count: matchCount,
      match_threshold: matchThreshold,
      character_id: options.characterId ?? null,
      provider: options.provider,
      rerank: options.rerank,
      retrieve_k: options.retrieveK,
    });
    return {
      matches: res.matches,
      latencyMs: Math.round(performance.now() - startedAt),
      embeddingProvider: res.embedding_provider,
      rerankUsed: res.rerank_used,
      error: res.error,
    };
  } catch (err) {
    return {
      matches: [],
      latencyMs: Math.round(performance.now() - startedAt),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const MAX_RAG_CONTEXT_CHARS = 420;
const MAX_KNOWLEDGE_ITEM_CHARS = 300;

function compactText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 1).trim()}…`;
}

/**
 * Format RAG matches into a context string for injection into the LLM prompt.
 */
export function formatRAGContext(matches: RAGMatch[]): string {
  if (!matches.length) return "";
  return matches
    .slice(0, 3)
    .map((m, i) => `[${i + 1}] (${m.source_table}, score: ${m.similarity.toFixed(2)})\n${compactText(m.content, MAX_RAG_CONTEXT_CHARS)}`)
    .join("\n\n");
}

/** Convenience: query RAG and return formatted context string. */
export async function getRAGContext(
  userMessage: string,
  recentContext?: string,
  matchCount = 3,
  options: Omit<RAGQueryOptions, "recentContext" | "matchCount" | "matchThreshold"> = {},
): Promise<string> {
  const matches = await queryRAG(userMessage, recentContext, matchCount, undefined, options);
  return formatRAGContext(matches);
}

export function buildKnowledgeContextFromRAG(matches: RAGMatch[]): MaxTurnKnowledgeContext {
  if (!matches.length) {
    return {
      allowedFacts: [],
      activeMemories: [],
      hypotheses: [],
      forbiddenTopics: [],
      blockedAssertions: [],
    };
  }

  const sorted = [...matches].sort((a, b) => b.similarity - a.similarity);
  const allowedFacts = sorted.slice(0, 3).map((match, index) => `[F${index + 1}] ${compactText(match.content, MAX_KNOWLEDGE_ITEM_CHARS)}`);
  const activeMemories = sorted.slice(0, 2).map((match, index) => `[M${index + 1}] ${compactText(match.content, MAX_KNOWLEDGE_ITEM_CHARS)}`);
  const hypotheses = sorted
    .filter((match) => match.similarity < 0.55)
    .slice(0, 2)
    .map((match, index) => `[H${index + 1}] Piste partielle seulement: ${compactText(match.content, MAX_KNOWLEDGE_ITEM_CHARS)}`);

  return {
    allowedFacts,
    activeMemories,
    hypotheses,
    forbiddenTopics: [
      "Toute information absente des faits autorisés du tour",
      "Toute révélation non encore débloquée par la progression narrative",
    ],
    blockedAssertions: [
      "Ne jamais transformer une hypothèse en souvenir certain",
      "Ne jamais inventer de détail concret (date, lieu, action, intention) absent des faits autorisés",
    ],
  };
}

// Default Notion database IDs for AVA project — only Caractères AVA is synced now.
export const AVA_NOTION_DATABASES = {
  characters: '30362322e59580bbb7b8dd49d516b341',
};

/**
 * Trigger a Notion → Supabase sync (manual, for admin use).
 */
export async function syncNotion(databases: Record<string, string> = AVA_NOTION_DATABASES): Promise<any> {
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("notion", "Sync Notion → Supabase", `${SUPABASE_URL}/functions/v1/sync-notion`, databases);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ databases }),
  });

  if (!response.ok) {
    const err = await response.text();
    debugLogger.logResponse(debugId, "notion", "Sync Notion", response.status, startTime, err);
    throw new Error(`Sync error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  debugLogger.logResponse(debugId, "notion", "Sync Notion complete", response.status, startTime, JSON.stringify(data).slice(0, 500));
  return data;
}

/** Lightweight LLM-based query rewriter — turns "et toi ?" into a self-contained search query. */
export async function rewriteRAGQuery(userMessage: string, recentContext?: string, characterName?: string): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/rewrite-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_message: userMessage, recent_context: recentContext, character_name: characterName }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const q = (data?.query || "").toString().trim();
    return q.length > 0 ? q : null;
  } catch {
    return null;
  }
}
