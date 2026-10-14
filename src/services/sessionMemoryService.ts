import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "./debugLogger";
import type { ConversationMessage, RuntimeCharacter } from "@/types";
import { authenticatedFunctionFetch } from "./gameAuth";
import { createTimeoutSignal } from "./asyncUtils";
import type { CharacterExecutionContext } from "./characterIdentityGuard";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SessionSummaryRecord {
  session_id: string;
  character_key: RuntimeCharacter;
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
const summaryMissingCache = new Map<string, number>();
const summaryInFlight = new Map<string, Promise<SessionSummaryRecord | null>>();
const SUMMARY_MISSING_TTL_MS = 5_000;
let summaryCacheEpoch = 0;

function summaryCacheKey(sessionId: string, character: RuntimeCharacter): string {
  return `${sessionId}::${character}`;
}

/** Test/admin helper — vide le cache mémoire des résumés. */
export function clearSessionSummaryCache(): void {
  summaryCacheEpoch += 1;
  summaryCache.clear();
  summaryMissingCache.clear();
  summaryInFlight.clear();
}

/** Fetch the latest compressed summary for a session (null if none). */
export async function fetchSessionSummary(
  sessionId: string | undefined,
  character: RuntimeCharacter,
): Promise<SessionSummaryRecord | null> {
  if (!sessionId) return null;
  const cacheKey = summaryCacheKey(sessionId, character);
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;
  const missingUntil = summaryMissingCache.get(cacheKey);
  if (missingUntil && missingUntil > Date.now()) return null;
  if (missingUntil) summaryMissingCache.delete(cacheKey);
  const pending = summaryInFlight.get(cacheKey);
  if (pending) return pending;

  const requestEpoch = summaryCacheEpoch;
  const request = (async () => {
    try {
      // Fallback BDD : ne renvoie une ligne que pour un utilisateur admin
      // (RLS admin-only) — utile au banc d'essai, silencieusement vide en live.
      const { data, error } = await supabase
        .from("session_summaries")
        .select("session_id, character_key, summary, last_turn, updated_at")
        .eq("session_id", sessionId)
        .eq("character_key", character)
        .maybeSingle();
      if (error) {
        console.warn("[SessionMemory] fetch error", error.message);
        return null;
      }
      const record = (data as SessionSummaryRecord | null) ?? null;
      if (record && requestEpoch === summaryCacheEpoch) {
        const current = summaryCache.get(cacheKey);
        if (current && current.last_turn > record.last_turn) return current;
        summaryCache.set(cacheKey, record);
        summaryMissingCache.delete(cacheKey);
      } else if (!record && requestEpoch === summaryCacheEpoch) {
        // A confirmed absence is safe to coalesce briefly. Errors are never
        // cached as absence, so a transient RLS/network failure can recover.
        summaryMissingCache.set(cacheKey, Date.now() + SUMMARY_MISSING_TTL_MS);
      }
      return record;
    } catch (err) {
      console.warn("[SessionMemory] fetch exception", err);
      return null;
    } finally {
      if (summaryInFlight.get(cacheKey) === request) summaryInFlight.delete(cacheKey);
    }
  })();
  summaryInFlight.set(cacheKey, request);
  return request;
}

/** Fire-and-forget call to summarize-session. Does NOT throw. */
export async function summarizeSessionAsync(
  sessionId: string,
  conversation: ConversationMessage[],
  turnCount: number,
  character: RuntimeCharacter | CharacterExecutionContext,
): Promise<void> {
  if (!sessionId || !conversation.length) return;
  const characterKey = typeof character === "string" ? character : character.characterKey;
  const requestEpoch = summaryCacheEpoch;
  const startTime = Date.now();
  const debugId = debugLogger.logFetch("other", `summarize-session (turn=${turnCount})`, `${SUPABASE_URL}/functions/v1/summarize-session`, { session_id: sessionId, turn_count: turnCount });
  try {
    const timeout = createTimeoutSignal(5_000);
    const r = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/summarize-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        character_key: characterKey,
        ...(typeof character === "string" ? {} : { character_context: character }),
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
      const cacheKey = summaryCacheKey(sessionId, characterKey);
      const next: SessionSummaryRecord = {
        session_id: sessionId,
        character_key: characterKey,
        summary,
        last_turn: Number.isFinite(Number(data?.last_turn)) ? Number(data.last_turn) : turnCount,
        updated_at: new Date().toISOString(),
      };
      if (requestEpoch !== summaryCacheEpoch) return;
      const current = summaryCache.get(cacheKey);
      // Older fire-and-forget responses must not regress the summary used by
      // the next turn. Equal turns are last-write-wins by completion order.
      if (!current || next.last_turn >= current.last_turn) {
        summaryCache.set(cacheKey, next);
        summaryMissingCache.delete(cacheKey);
      }
    }
    debugLogger.logResponse(debugId, "other", `summary updated (${summary.length} chars)`, 200, startTime);
  } catch (err) {
    debugLogger.logError("other", "summarize-session exception", err);
  }
}
