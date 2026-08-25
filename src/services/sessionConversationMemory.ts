import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  ConversationMemoryDelta,
  ConversationMemoryV1,
  ConversationMessage,
  PRD4PostTurnEvaluation,
  RuntimeCharacter,
  UserRoleProfile,
} from "@/types";
import {
  createEmptyConversationMemory,
  mergeConversationMemory,
  normalizeConversationMemory,
} from "@/services/conversationMemoryV1";
import { parseHandoffOffer, type CharacterHandoffOffer } from "@/services/characterConversation";
import { ensureGameAuth } from "@/services/gameAuth";

const memoryCache = new Map<string, ConversationMemoryV1>();

export interface ResumablePRD4Session {
  id: string;
  started_at: string;
  resume_expires_at: string;
  conversation_log: ConversationMessage[];
  conversation_memory: ConversationMemoryV1;
  memory_last_turn: number;
  player_role: UserRoleProfile | null;
  user_posture_raw: string | null;
  user_posture_mode: string | null;
  has_seen_film: string | null;
  teaser_shown: boolean | null;
  triggers_activated: string[];
  diagnostic_trace_enabled: boolean;
  gm_post_turn_log: PRD4PostTurnEvaluation[];
  active_character: "max" | "emma";
  orchestration_version_id: string | null;
  pending_handoff: CharacterHandoffOffer | null;
  handoff_count: number;
}

export function clearConversationMemoryCache(sessionId?: string): void {
  if (sessionId) memoryCache.delete(sessionId);
  else memoryCache.clear();
}

export async function fetchConversationMemory(
  sessionId: string | null | undefined,
  options: { force?: boolean } = {},
): Promise<ConversationMemoryV1> {
  if (!sessionId) return createEmptyConversationMemory();
  const cached = memoryCache.get(sessionId);
  if (cached && !options.force) return cached;
  const { data, error } = await supabase
    .from("sessions")
    .select("conversation_memory, memory_last_turn")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    console.warn("[ConversationMemory] fetch failed:", error.message);
    return createEmptyConversationMemory();
  }
  const memory = normalizeConversationMemory(data?.conversation_memory);
  const normalized = data?.memory_last_turn != null && data.memory_last_turn > memory.lastTurn
    ? { ...memory, lastTurn: data.memory_last_turn }
    : memory;
  memoryCache.set(sessionId, normalized);
  return normalized;
}

function appendPostTurnEntry(current: unknown, entry: PRD4PostTurnEvaluation): PRD4PostTurnEvaluation[] {
  const entries = Array.isArray(current) ? current as PRD4PostTurnEvaluation[] : [];
  if (entry.turn_index != null && entries.some((candidate) => candidate.turn_index === entry.turn_index)) return entries;
  return [...entries, entry].slice(-80);
}

/**
 * Persiste le log GM et la mémoire dans une seule mise à jour filtrée par
 * `memory_last_turn`. En cas de course, relit puis rejoue la fusion une fois.
 */
export async function persistPostTurnMemory(
  sessionId: string,
  entry: PRD4PostTurnEvaluation,
  delta: ConversationMemoryDelta | null,
  turnIndex: number,
  activeCharacter: RuntimeCharacter = "max",
): Promise<ConversationMemoryV1> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase
      .from("sessions")
      .select("conversation_memory, memory_last_turn, gm_post_turn_log")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return createEmptyConversationMemory();

    const currentLastTurn = data.memory_last_turn ?? 0;
    const currentMemory = normalizeConversationMemory(data.conversation_memory);
    const nextMemory = delta && turnIndex > currentLastTurn
      ? mergeConversationMemory(currentMemory, delta, turnIndex, activeCharacter)
      : currentMemory;
    const nextLastTurn = delta && turnIndex > currentLastTurn ? turnIndex : currentLastTurn;
    const nextLog = appendPostTurnEntry(data.gm_post_turn_log, entry);
    const { data: updated, error: updateError } = await supabase
      .from("sessions")
      .update({
        conversation_memory: JSON.parse(JSON.stringify(nextMemory)) as Json,
        memory_last_turn: nextLastTurn,
        gm_post_turn_log: JSON.parse(JSON.stringify(nextLog)) as Json,
      })
      .eq("id", sessionId)
      .eq("memory_last_turn", currentLastTurn)
      .select("conversation_memory, memory_last_turn")
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) {
      const persisted = normalizeConversationMemory(updated.conversation_memory);
      memoryCache.set(sessionId, persisted);
      return persisted;
    }
  }
  // Both compare-and-swap attempts may lose to newer turns. Bypass the cache:
  // returning an older cached snapshot here would temporarily regress Max's
  // memory even though the database contains the correct newer state.
  const latest = await fetchConversationMemory(sessionId, { force: true });
  memoryCache.set(sessionId, latest);
  return latest;
}

export async function fetchResumablePRD4Session(now = new Date()): Promise<ResumablePRD4Session | null> {
  await ensureGameAuth();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, started_at, resume_expires_at, conversation_log, conversation_memory, memory_last_turn, player_role, user_posture_raw, user_posture_mode, has_seen_film, teaser_shown, triggers_activated, diagnostic_trace_enabled, gm_post_turn_log, active_character, orchestration_version_id, pending_handoff, handoff_count")
    .is("ended_at", null)
    .gt("resume_expires_at", now.toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[PRD4 resume] lookup failed:", error.message);
    return null;
  }
  if (!data?.started_at || !data.resume_expires_at) return null;
  const conversation = Array.isArray(data.conversation_log)
    ? data.conversation_log as unknown as ConversationMessage[]
    : [];
  if (!conversation.length) return null;
  const memory = normalizeConversationMemory(data.conversation_memory);
  memoryCache.set(data.id, memory);
  return {
    id: data.id,
    started_at: data.started_at,
    resume_expires_at: data.resume_expires_at,
    conversation_log: conversation,
    conversation_memory: memory,
    memory_last_turn: data.memory_last_turn ?? memory.lastTurn,
    player_role: data.player_role as unknown as UserRoleProfile | null,
    user_posture_raw: data.user_posture_raw,
    user_posture_mode: data.user_posture_mode,
    has_seen_film: data.has_seen_film,
    teaser_shown: data.teaser_shown,
    triggers_activated: data.triggers_activated ?? [],
    diagnostic_trace_enabled: data.diagnostic_trace_enabled,
    gm_post_turn_log: Array.isArray(data.gm_post_turn_log)
      ? data.gm_post_turn_log as unknown as PRD4PostTurnEvaluation[]
      : [],
    active_character: data.active_character === "emma" ? "emma" : "max",
    orchestration_version_id: data.orchestration_version_id,
    pending_handoff: parseHandoffOffer(data.pending_handoff),
    handoff_count: data.handoff_count ?? 0,
  };
}
