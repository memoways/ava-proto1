import { debugLogger } from "./debugLogger";
import { supabase } from "@/integrations/supabase/client";
import type { MaxTurnKnowledgeContext } from "@/types";
import { authenticatedFunctionFetch } from "./gameAuth";
import { createTimeoutSignal } from "./asyncUtils";
import { RAG_DEFAULT_RETRIEVE_K } from "@/config/experienceRuntime";

import { getCachedSession } from "@/services/gameAuth";

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
  /** 1-based position returned by pgvector before reranking. */
  retrieval_rank?: number;
  /** Owning character (null for shared sources like storyworld). */
  character_id?: string | null;
}

export interface RAGQueryOptions {
  recentContext?: string;
  matchCount?: number;
  matchThreshold?: number;
  /** Restrict character-scoped chunks to this character. Shared chunks (NULL) always remain visible. */
  characterId?: string | null;
  /** Disable rerank explicitly. */
  rerank?: boolean;
  /** Override retrieve_k (top fetched before rerank). */
  retrieveK?: number;
  /** Voyage reranker override used by the isolated RAG laboratory. */
  rerankModel?: "rerank-2.5" | "rerank-2.5-lite";
  /** Whether Voyage may truncate over-long reranker inputs. */
  rerankTruncation?: boolean;
  /** Return the full pre-rerank pool. Reserved for diagnostics to keep live payloads small. */
  includeRetrievalMatches?: boolean;
  /** Pre-rewritten search query — when provided, used as-is instead of userMessage+context. */
  rewrittenQuery?: string;
  /** Cancels an obsolete conversation turn. */
  signal?: AbortSignal;
  /** Hard client deadline; callers should fall back to an empty RAG result. */
  timeoutMs?: number;
}

async function callQueryRag(
  payload: Record<string, unknown>,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{
  matches: RAGMatch[];
  retrieval_matches?: RAGMatch[];
  query?: string;
  search_input?: string;
  embedding_provider?: string;
  embedding_profile?: string;
  document_embedding_model?: string;
  query_embedding_model?: string;
  embedding_dimension?: number;
  embedding_dtype?: string;
  rerank_used?: boolean;
  rerank_model?: string;
  rerank_query?: string;
  rerank_error?: string;
  latency_ms?: number;
  error?: string;
  status?: number;
}> {
  const timeout = createTimeoutSignal(options?.timeoutMs ?? 5000, options?.signal);
  const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: timeout.signal,
  }).finally(timeout.cancel);
  if (!response.ok) {
    const err = await response.text();
    return { matches: [], error: `HTTP ${response.status}: ${err.slice(0, 300)}`, status: response.status };
  }
  const data = await response.json();
  return {
    matches: data.matches || [],
    retrieval_matches: data.retrieval_matches || [],
    query: data.query,
    search_input: data.search_input,
    embedding_provider: data.embedding_provider,
    embedding_profile: data.embedding_profile,
    document_embedding_model: data.document_embedding_model,
    query_embedding_model: data.query_embedding_model,
    embedding_dimension: data.embedding_dimension,
    embedding_dtype: data.embedding_dtype,
    rerank_used: data.rerank_used,
    rerank_model: data.rerank_model,
    rerank_query: data.rerank_query,
    rerank_error: data.rerank_error,
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
      query: options.rewrittenQuery || undefined,
      user_message: userMessage,
      recent_context: recentContext,
      match_count: matchCount,
      match_threshold: matchThreshold,
      character_id: options.characterId ?? null,
      rerank: options.rerank,
      retrieve_k: options.retrieveK,
      rerank_model: options.rerankModel,
      rerank_truncation: options.rerankTruncation,
      include_retrieval_matches: options.includeRetrievalMatches,
    }, { signal: options.signal, timeoutMs: options.timeoutMs });
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
  /** Full vector candidate pool, in cosine-similarity order, before reranking. */
  retrievalMatches: RAGMatch[];
  latencyMs: number;
  embeddingProvider?: string;
  embeddingProfile?: string;
  documentEmbeddingModel?: string;
  queryEmbeddingModel?: string;
  embeddingDimension?: number;
  embeddingDtype?: string;
  rerankUsed?: boolean;
  rerankModel?: string;
  rerankQuery?: string;
  rerankError?: string;
  serverLatencyMs?: number;
  searchInput: string;
  request: {
    userMessage: string;
    recentContext: string;
    rewrittenQuery: string | null;
    matchCount: number;
    matchThreshold: number;
    characterId: string | null;
    rerankRequested: boolean;
    retrieveK: number;
    rerankModel: "rerank-2.5" | "rerank-2.5-lite";
    rerankTruncation: boolean;
  };
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
      query: options.rewrittenQuery || undefined,
      user_message: userMessage,
      recent_context: recentContext,
      match_count: matchCount,
      match_threshold: matchThreshold,
      character_id: options.characterId ?? null,
      rerank: options.rerank,
      retrieve_k: options.retrieveK,
      rerank_model: options.rerankModel,
      rerank_truncation: options.rerankTruncation,
      include_retrieval_matches: options.includeRetrievalMatches,
    }, { signal: options.signal, timeoutMs: options.timeoutMs });
    return {
      matches: res.matches,
      retrievalMatches: res.retrieval_matches?.length ? res.retrieval_matches : res.matches,
      latencyMs: Math.round(performance.now() - startedAt),
      embeddingProvider: res.embedding_provider,
      embeddingProfile: res.embedding_profile,
      documentEmbeddingModel: res.document_embedding_model,
      queryEmbeddingModel: res.query_embedding_model,
      embeddingDimension: res.embedding_dimension,
      embeddingDtype: res.embedding_dtype,
      rerankUsed: res.rerank_used,
      rerankModel: res.rerank_model,
      rerankQuery: res.rerank_query,
      rerankError: res.rerank_error,
      serverLatencyMs: res.latency_ms,
      searchInput: res.search_input || options.rewrittenQuery || [userMessage, recentContext ? `Contexte récent: ${recentContext}` : ""].filter(Boolean).join("\n\n"),
      request: {
        userMessage,
        recentContext: recentContext || "",
        rewrittenQuery: options.rewrittenQuery || null,
        matchCount,
        matchThreshold,
        characterId: options.characterId ?? null,
        rerankRequested: options.rerank !== false,
        retrieveK: options.retrieveK ?? Math.max(matchCount, RAG_DEFAULT_RETRIEVE_K),
        rerankModel: options.rerankModel ?? "rerank-2.5-lite",
        rerankTruncation: options.rerankTruncation !== false,
      },
      error: res.error,
    };
  } catch (err) {
    return {
      matches: [],
      retrievalMatches: [],
      latencyMs: Math.round(performance.now() - startedAt),
      searchInput: options.rewrittenQuery || [userMessage, recentContext ? `Contexte récent: ${recentContext}` : ""].filter(Boolean).join("\n\n"),
      request: {
        userMessage,
        recentContext: recentContext || "",
        rewrittenQuery: options.rewrittenQuery || null,
        matchCount,
        matchThreshold,
        characterId: options.characterId ?? null,
        rerankRequested: options.rerank !== false,
        retrieveK: options.retrieveK ?? Math.max(matchCount, RAG_DEFAULT_RETRIEVE_K),
        rerankModel: options.rerankModel ?? "rerank-2.5-lite",
        rerankTruncation: options.rerankTruncation !== false,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Generous limits: les chunks RAG sont déjà ~1000 chars. Tronquer à 300 coupait
// au milieu de phrases (ex: "…habites à Lausanne" perdu).
const MAX_RAG_CONTEXT_CHARS = 1200;
const MAX_KNOWLEDGE_ITEM_CHARS = 900;
export const MAX_MAX_RAG_ITEMS = 3;
export const MAX_MAX_RAG_ITEM_CHARS = 700;
export const MAX_MAX_RAG_CONTEXT_CHARS = 2_100;
const RAG_OVERLAP_WINDOW_CHARS = 120;

function compactText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 1).trim()}…`;
}

function compactAtSentenceBoundary(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (maxChars <= 0) return "";
  if (clean.length <= maxChars) return clean;
  if (maxChars === 1) return "…";
  const candidate = clean.slice(0, maxChars - 1).trimEnd();
  const matches = [...candidate.matchAll(/[.!?…](?=\s|$)/g)];
  const sentenceEnd = matches.at(-1)?.index;
  if (sentenceEnd !== undefined && sentenceEnd + 1 >= Math.floor(maxChars * 0.45)) {
    return candidate.slice(0, sentenceEnd + 1).trim();
  }
  const wordEnd = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, Math.max(0, wordEnd)).trim()}…`;
}

function cleanMaxMemoryContent(content: string): string {
  return content
    .replace(/\bPartie\s+\d+\s*\/\s*\d+\b\s*[:—-]?/gi, "")
    .replace(/^\s*\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sharesConsecutiveWindow(a: string, b: string, windowChars = RAG_OVERLAP_WINDOW_CHARS): boolean {
  const left = a.toLocaleLowerCase("fr");
  const right = b.toLocaleLowerCase("fr");
  if (left.length < windowChars || right.length < windowChars) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  for (let index = 0; index <= shorter.length - windowChars; index += 1) {
    if (longer.includes(shorter.slice(index, index + windowChars))) return true;
  }
  return false;
}

/**
 * Format RAG matches into a context string for injection into the LLM prompt.
 */
export function formatRAGContext(matches: RAGMatch[]): string {
  if (!matches.length) return "";
  return matches
    .slice(0, 5)
    .map((m, i) => `[${i + 1}] (${m.source_table}, score: ${m.similarity.toFixed(2)})\n${compactText(m.content, MAX_RAG_CONTEXT_CHARS)}`)
    .join("\n\n");
}

/**
 * PRD4 live formatter: metadata stays in the trace, while Max receives only
 * deduplicated narrative memories within the declared prompt budget.
 */
export interface MaxRAGFormatOptions {
  /** Caractères max par souvenir (compact_v1 : 700 · rich_v2 : 900). */
  itemChars?: number;
  /** Budget total du bloc RAG (compact_v1 : 2 100 · rich_v2 : 2 700). */
  totalChars?: number;
  maxItems?: number;
}

export function formatMaxRAGContext(matches: RAGMatch[], options: MaxRAGFormatOptions = {}): string {
  const itemChars = options.itemChars ?? MAX_MAX_RAG_ITEM_CHARS;
  const totalChars = options.totalChars ?? MAX_MAX_RAG_CONTEXT_CHARS;
  const maxItems = options.maxItems ?? MAX_MAX_RAG_ITEMS;
  const selected: string[] = [];
  for (const match of matches) {
    const clean = cleanMaxMemoryContent(match.content);
    if (!clean || selected.some((existing) => sharesConsecutiveWindow(existing, clean))) continue;
    selected.push(compactAtSentenceBoundary(clean, itemChars));
    if (selected.length >= maxItems) break;
  }

  let output = "";
  for (let index = 0; index < selected.length; index += 1) {
    const prefix = output ? `\n\nSouvenir ${index + 1}\n` : `Souvenir ${index + 1}\n`;
    const remaining = totalChars - output.length - prefix.length;
    if (remaining <= 0) break;
    const content = compactAtSentenceBoundary(selected[index], remaining);
    if (!content) break;
    output += `${prefix}${content}`;
  }
  return output;
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
  const allowedFacts = sorted.slice(0, 5).map((match, index) => `[F${index + 1}] ${compactText(match.content, MAX_KNOWLEDGE_ITEM_CHARS)}`);
  const activeMemories = sorted.slice(0, 2).map((match, index) => `[M${index + 1}] ${compactText(match.content, MAX_KNOWLEDGE_ITEM_CHARS)}`);

  // PAS d'hypothèses : tout chunk remonté par le RAG est considéré comme fait
  // canonique du récit. Étiqueter en "hypothèse" pousse Max à esquiver des
  // informations correctes (ex. son lieu d'habitation).
  return {
    allowedFacts,
    activeMemories,
    hypotheses: [],
    forbiddenTopics: [],
    blockedAssertions: [
      "Ne jamais inventer un personnage, un événement ou une relation absent du contexte narratif",
    ],
  };
}

// Default Notion database IDs for AVA project.
// - characters: Base Caractères AVA (personnages éditoriaux + RAG)
// - videos: Base "🎬 Vidéos AVA" (triggers vidéo joués par le Game Master)
export const AVA_NOTION_DATABASES = {
  characters: '30362322e59580bbb7b8dd49d516b341',
  videos: '478685a5b31e45b5bc534bcf905b9124',
};

/**
 * Trigger a Notion → Supabase sync (manual, for admin use).
 */
export async function syncNotion(databases: Record<string, string> = AVA_NOTION_DATABASES): Promise<unknown> {
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("notion", "Sync Notion → Supabase", `${SUPABASE_URL}/functions/v1/sync-notion`, databases);

  const cachedAuthSession = await getCachedSession();
  const token = cachedAuthSession?.access_token;
  const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/rewrite-query`, {
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
