import { debugLogger } from "./debugLogger";
import type { MaxTurnKnowledgeContext } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface RAGMatch {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  similarity: number;
}

/**
 * Query RAG to find relevant narrative context for a conversation turn.
 * Combines user message + recent conversation for better semantic matching.
 */
export async function queryRAG(
  userMessage: string,
  recentContext?: string,
  matchCount = 5,
  matchThreshold = 0.3
): Promise<RAGMatch[]> {
  const query = recentContext
    ? `${userMessage}\n\nContexte récent: ${recentContext}`
    : userMessage;

  try {
    const startTime = Date.now();
    const debugId = debugLogger.logFetch("rag", `RAG query (${matchCount} matches)`, `${SUPABASE_URL}/functions/v1/query-rag`, { query: query.slice(0, 200) });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        match_count: matchCount,
        match_threshold: matchThreshold,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      debugLogger.logResponse(debugId, "rag", "RAG query", response.status, startTime, err);
      console.error(`[RAG] Error: ${response.status} - ${err}`);
      return [];
    }

    const data = await response.json();
    const matches = data.matches || [];
    debugLogger.logResponse(debugId, "rag", `RAG → ${matches.length} matches`, response.status, startTime, matches.map((m: any) => `${m.source_table}: ${m.content.slice(0, 80)}… (${m.similarity.toFixed(2)})`).join("\n"));
    return matches;
  } catch (error) {
    debugLogger.logError("rag", "RAG query failed", error);
    console.error('[RAG] Failed to query:', error);
    return [];
  }
}

export interface RAGQueryDetailed {
  matches: RAGMatch[];
  latencyMs: number;
  error?: string;
}

/** Detailed RAG query for diagnostics: returns latency + error if any. */
export async function queryRAGDetailed(
  userMessage: string,
  recentContext?: string,
  matchCount = 5,
  matchThreshold = 0.3,
): Promise<RAGQueryDetailed> {
  const startedAt = performance.now();
  const query = recentContext ? `${userMessage}\n\nContexte récent: ${recentContext}` : userMessage;
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, match_count: matchCount, match_threshold: matchThreshold }),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      const err = await response.text();
      return { matches: [], latencyMs, error: `HTTP ${response.status}: ${err.slice(0, 300)}` };
    }
    const data = await response.json();
    return { matches: data.matches || [], latencyMs };
  } catch (err) {
    return {
      matches: [],
      latencyMs: Math.round(performance.now() - startedAt),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Format RAG matches into a context string for injection into the LLM prompt.
 */
export function formatRAGContext(matches: RAGMatch[]): string {
  if (!matches.length) return '';

  return matches
    .map((m, i) => `[${i + 1}] (${m.source_table}, score: ${m.similarity.toFixed(2)})\n${m.content}`)
    .join('\n\n');
}

/**
 * Convenience: query RAG and return formatted context string.
 */
export async function getRAGContext(
  userMessage: string,
  recentContext?: string,
  matchCount = 3
): Promise<string> {
  const matches = await queryRAG(userMessage, recentContext, matchCount);
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
  const allowedFacts = sorted.slice(0, 3).map((match, index) => `[F${index + 1}] ${match.content}`);
  const activeMemories = sorted.slice(0, 2).map((match, index) => `[M${index + 1}] ${match.content}`);
  const hypotheses = sorted
    .filter((match) => match.similarity < 0.55)
    .slice(0, 2)
    .map((match, index) => `[H${index + 1}] Piste partielle seulement: ${match.content}`);

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

// Default Notion database IDs for AVA project
export const AVA_NOTION_DATABASES = {
  characters: '30362322e59580bbb7b8dd49d516b341',
  storyworld: '30362322e595806e9ef2fc62b7819980',
  gameplay_steps: '73282ee05a414cee8307ae98ff48546d',
  video_triggers: '478685a5b31e45b5bc534bcf905b9124',
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
