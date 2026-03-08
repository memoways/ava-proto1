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
  matchThreshold = 0.5
): Promise<RAGMatch[]> {
  const query = recentContext
    ? `${userMessage}\n\nContexte récent: ${recentContext}`
    : userMessage;

  try {
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
      console.error(`[RAG] Error: ${response.status} - ${err}`);
      return [];
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error('[RAG] Failed to query:', error);
    return [];
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
  matchCount = 5
): Promise<string> {
  const matches = await queryRAG(userMessage, recentContext, matchCount);
  return formatRAGContext(matches);
}

/**
 * Trigger a Notion → Supabase sync (manual, for admin use).
 */
export async function syncNotion(databases: Record<string, string>): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ databases }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sync error: ${response.status} - ${err}`);
  }

  return response.json();
}
