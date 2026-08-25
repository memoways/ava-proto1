import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "./debugLogger";
import type { ConversationMessage, RuntimeCharacter } from "@/types";
import { authenticatedFunctionFetch } from "./gameAuth";
import { createTimeoutSignal } from "./asyncUtils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SessionSummaryRecord {
  session_id: string;
  summary: string;
  last_turn: number;
  updated_at: string;
}

// Cache mémoire des résumés, alimenté par la réponse de summarize-session.
// Nécessaire car la policy RLS (migration 20260712150404) réserve le SELECT
// sur session_summaries aux admins : le joueur anonyme ne peut PAS relire
// son résumé en BDD. Sans ce cache, le bloc "SOUVENIRS DE LA SESSION" n'est
// jamais injecté dans le prompt de Max et la re-summarisation se déclenche
// à chaque tour (last_turn perçu = 0). Les sessions ne survivent pas à un
// rechargement de page (historique en mémoire), donc ce cache suffit au live.
const summaryCache = new Map<string, SessionSummaryRecord>();

function summaryCacheKey(sessionId: string, character?: RuntimeCharacter): string {
  return character ? `${sessionId}::${character}` : sessionId;
}

/** Test/admin helper — vide le cache mémoire des résumés. */
export function clearSessionSummaryCache(): void {
  summaryCache.clear();
}

/** Fetch the latest compressed summary for a session (null if none). */
export async function fetchSessionSummary(
  sessionId: string | undefined,
  character?: RuntimeCharacter,
): Promise<SessionSummaryRecord | null> {
  if (!sessionId) return null;
  const cacheKey = summaryCacheKey(sessionId, character);
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;
  // A character-scoped live cache must not fall back to the global DB row:
  // that summary is not isolated and would leak the other conversation.
  if (character) return null;
  try {
    // Fallback BDD : ne renvoie une ligne que pour un utilisateur admin
    // (RLS admin-only) — utile au banc d'essai, silencieusement vide en live.
    const { data, error } = await supabase
      .from("session_summaries")
      .select("session_id, summary, last_turn, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) {
      console.warn("[SessionMemory] fetch error", error.message);
      return null;
    }
    const record = (data as SessionSummaryRecord | null) ?? null;
    if (record) summaryCache.set(cacheKey, record);
    return record;
  } catch (err) {
    console.warn("[SessionMemory] fetch exception", err);
    return null;
  }
}

/** Fire-and-forget call to summarize-session. Does NOT throw. */
export async function summarizeSessionAsync(
  sessionId: string,
  conversation: ConversationMessage[],
  turnCount: number,
  character?: RuntimeCharacter,
): Promise<void> {
  if (!sessionId || !conversation.length) return;
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("other", `summarize-session (turn=${turnCount})`, `${SUPABASE_URL}/functions/v1/summarize-session`, { session_id: sessionId, turn_count: turnCount });
  try {
    const timeout = createTimeoutSignal(5_000);
    const r = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/summarize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        conversation: conversation.map((m) => ({ role: m.role, content: m.content })),
        turn_count: turnCount,
      }),
      signal: timeout.signal,
    }).finally(timeout.cancel);
    if (!r.ok) {
      const txt = await r.text();
      debugLogger.logResponse(debugId, "other", "summarize-session failed", r.status, startTime, txt.slice(0, 200));
      return;
    }
    const data = await r.json();
    const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
    if (summary) {
      summaryCache.set(summaryCacheKey(sessionId, character), {
        session_id: sessionId,
        summary,
        last_turn: Number.isFinite(Number(data?.last_turn)) ? Number(data.last_turn) : turnCount,
        updated_at: new Date().toISOString(),
      });
    }
    debugLogger.logResponse(debugId, "other", `summary updated (${summary.length} chars)`, 200, startTime);
  } catch (err) {
    debugLogger.logError("other", "summarize-session exception", err);
  }
}
