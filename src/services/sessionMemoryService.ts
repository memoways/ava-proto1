import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "./debugLogger";
import type { ConversationMessage } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SessionSummaryRecord {
  session_id: string;
  summary: string;
  last_turn: number;
  updated_at: string;
}

/** Fetch the latest compressed summary for a session (null if none). */
export async function fetchSessionSummary(sessionId: string | undefined): Promise<SessionSummaryRecord | null> {
  if (!sessionId) return null;
  try {
    const { data, error } = await supabase
      .from("session_summaries")
      .select("session_id, summary, last_turn, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) {
      console.warn("[SessionMemory] fetch error", error.message);
      return null;
    }
    return (data as SessionSummaryRecord | null) ?? null;
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
): Promise<void> {
  if (!sessionId || !conversation.length) return;
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("other", `summarize-session (turn=${turnCount})`, `${SUPABASE_URL}/functions/v1/summarize-session`, { session_id: sessionId, turn_count: turnCount });
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/summarize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        conversation: conversation.map((m) => ({ role: m.role, content: m.content })),
        turn_count: turnCount,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      debugLogger.logResponse(debugId, "other", "summarize-session failed", r.status, startTime, txt.slice(0, 200));
      return;
    }
    const data = await r.json();
    debugLogger.logResponse(debugId, "other", `summary updated (${data?.summary?.length || 0} chars)`, 200, startTime);
  } catch (err) {
    debugLogger.logError("other", "summarize-session exception", err);
  }
}
