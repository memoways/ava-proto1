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
