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
import { asRuntimeCharacter } from "@/services/characterConversation";
import { ensureGameAuth } from "@/services/gameAuth";

const memoryCache = new Map<string, ConversationMemoryV1>();
const memoryInFlight = new Map<string, Promise<ConversationMemoryV1>>();
const memoryFetchVersion = new Map<string, number>();
let memoryCacheEpoch = 0;

function cacheMemoryAfterWrite(sessionId: string, memory: ConversationMemoryV1): ConversationMemoryV1 {
  const current = memoryCache.get(sessionId);
  if (current && current.lastTurn > memory.lastTurn) return current;
  memoryCache.set(sessionId, memory);
  // Any read that started before this write must not overwrite the newer
  // snapshot when it resolves later.
  memoryFetchVersion.set(sessionId, (memoryFetchVersion.get(sessionId) ?? 0) + 1);
  return memory;
}

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
  pending_handoff: Json | null;
  handoff_count: number;
}

export function clearConversationMemoryCache(sessionId?: string): void {
  if (sessionId) {
    memoryCache.delete(sessionId);
    memoryInFlight.delete(sessionId);
    memoryFetchVersion.set(sessionId, (memoryFetchVersion.get(sessionId) ?? 0) + 1);
  } else {
    memoryCacheEpoch += 1;
    memoryCache.clear();
    memoryInFlight.clear();
    memoryFetchVersion.clear();
  }
}

export async function fetchConversationMemory(
  sessionId: string | null | undefined,
  options: { force?: boolean } = {},
): Promise<ConversationMemoryV1> {
  if (!sessionId) return createEmptyConversationMemory();
  const cached = memoryCache.get(sessionId);
  if (cached && !options.force) return cached;
  if (!options.force) {
    const pending = memoryInFlight.get(sessionId);
    if (pending) return pending;
  }
  const fetchEpoch = memoryCacheEpoch;
  const fetchVersion = (memoryFetchVersion.get(sessionId) ?? 0) + 1;
  memoryFetchVersion.set(sessionId, fetchVersion);
  const request = (async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("conversation_memory, memory_last_turn")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) {
      console.warn("[ConversationMemory] fetch failed:", error.message);
      return createEmptyConversationMemory();
    }
    const memory = overlayDeliveries(sessionId, normalizeConversationMemory(data?.conversation_memory));
    const normalized = data?.memory_last_turn != null && data.memory_last_turn > memory.lastTurn
      ? { ...memory, lastTurn: data.memory_last_turn }
      : memory;
    if (fetchEpoch === memoryCacheEpoch && memoryFetchVersion.get(sessionId) === fetchVersion) memoryCache.set(sessionId, normalized);
    return normalized;
  })();
  if (!options.force) {
    memoryInFlight.set(sessionId, request);
    void request.finally(() => {
      if (memoryInFlight.get(sessionId) === request) memoryInFlight.delete(sessionId);
    }).catch(() => {});
  }
  return request;
}

function appendPostTurnEntry(current: unknown, entry: PRD4PostTurnEvaluation): PRD4PostTurnEvaluation[] {
  const entries = Array.isArray(current) ? current as PRD4PostTurnEvaluation[] : [];
  if (entry.turn_index != null && entries.some((candidate) => candidate.turn_index === entry.turn_index)) return entries;
  return [...entries, entry].slice(-80);
}

/** Excludes legacy/global and foreign-character director results from live resume state. */
export function latestPostTurnForCharacter(
  entries: PRD4PostTurnEvaluation[],
  character: RuntimeCharacter,
): PRD4PostTurnEvaluation | null {
  return [...entries]
    .filter((entry) => entry.character_key === character)
    .sort((left, right) => (right.turn_index ?? 0) - (left.turn_index ?? 0))[0] ?? null;
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
  activeCharacter: RuntimeCharacter,
  signal?: AbortSignal,
): Promise<ConversationMemoryV1> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal?.throwIfAborted();
    const { data, error } = await supabase
      .from("sessions")
      .select("conversation_memory, memory_last_turn, gm_post_turn_log")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return createEmptyConversationMemory();

    const currentLastTurn = data.memory_last_turn ?? 0;
    const currentMemory = overlayDeliveries(sessionId, normalizeConversationMemory(data.conversation_memory));
    const nextMemory = delta && turnIndex > currentLastTurn
      ? mergeConversationMemory(currentMemory, delta, turnIndex, activeCharacter)
      : currentMemory;
    const nextLastTurn = delta && turnIndex > currentLastTurn ? turnIndex : currentLastTurn;
    const nextLog = appendPostTurnEntry(data.gm_post_turn_log, entry);
    signal?.throwIfAborted();
    let updateQuery = supabase.rpc("persist_conversation_memory_v4", {
      p_session_id: sessionId,
      p_expected_memory: data.conversation_memory,
      p_next_memory: JSON.parse(JSON.stringify(nextMemory)) as Json,
      p_expected_last_turn: currentLastTurn,
      p_next_last_turn: nextLastTurn,
      p_post_turn_log: JSON.parse(JSON.stringify(nextLog)) as Json,
    });
    if (signal) updateQuery = updateQuery.abortSignal(signal);
    const { data: updated, error: updateError } = await updateQuery.maybeSingle();
    if (updateError) throw updateError;
    if (updated) {
      const persisted = overlayDeliveries(sessionId, normalizeConversationMemory(updated.conversation_memory));
      cacheMemoryAfterWrite(sessionId, persisted);
      return persisted;
    }
  }
  // Both compare-and-swap attempts may lose to newer turns. Bypass the cache:
  // returning an older cached snapshot here would temporarily regress Max's
  // memory even though the database contains the correct newer state.
  const latest = await fetchConversationMemory(sessionId, { force: true });
  cacheMemoryAfterWrite(sessionId, latest);
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
  cacheMemoryAfterWrite(data.id, memory);
  const activeCharacter = asRuntimeCharacter(data.active_character);
  if (!activeCharacter) {
    console.warn("[PRD4 resume] session has no valid active character; resume refused");
    return null;
  }
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
    active_character: activeCharacter,
    orchestration_version_id: data.orchestration_version_id,
    pending_handoff: data.pending_handoff,
    handoff_count: data.handoff_count ?? 0,
  };
}

// Receipts are available locally before network persistence. They never change
// lastTurn: only the director owns the historical factual-memory cursor.
const pendingDeliveries = new Map<string, import('./responseDelivery').DeliveryByCharacter>();
const deliveryWrites = new Map<string, Promise<void>>();

function overlayDeliveries(sessionId: string, memory: ConversationMemoryV1): ConversationMemoryV1 {
  const overlay = pendingDeliveries.get(sessionId);
  if (!overlay) return memory;
  const merged = { ...memory.deliveryByCharacter };
  for (const character of ['max', 'emma'] as const) {
    if (!(merged[character]?.length || overlay[character]?.length)) continue;
    const byId = new Map((merged[character] ?? []).map(r => [r.turnId, r]));
    for (const receipt of overlay[character] ?? []) byId.set(receipt.turnId, receipt);
    merged[character] = [...byId.values()].sort((a, b) => a.turnIndex - b.turnIndex).slice(-16);
  }
  return { ...memory, version: 4, deliveryByCharacter: merged };
}

export function persistDeliveryReceipt(sessionId: string, receipt: import('./responseDelivery').ResponseDeliveryReceipt): Promise<void> {
  const overlay = pendingDeliveries.get(sessionId) ?? {};
  overlay[receipt.character] = [...(overlay[receipt.character] ?? []).filter(r => r.turnId !== receipt.turnId), receipt].slice(-16);
  pendingDeliveries.set(sessionId, overlay);
  cacheMemoryAfterWrite(sessionId, overlayDeliveries(sessionId, memoryCache.get(sessionId) ?? createEmptyConversationMemory()));
  const write = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await supabase.from('sessions').select('conversation_memory').eq('id', sessionId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Delivery session missing');
      const next = overlayDeliveries(sessionId, normalizeConversationMemory(data.conversation_memory));
      const { data: updated, error: updateError } = await supabase.rpc('persist_conversation_memory_v4', {
        p_session_id: sessionId,
        p_expected_memory: data.conversation_memory,
        p_next_memory: JSON.parse(JSON.stringify(next)) as Json,
      }).maybeSingle();
      if (updateError) throw updateError;
      if (updated) { cacheMemoryAfterWrite(sessionId, overlayDeliveries(sessionId, normalizeConversationMemory(updated.conversation_memory))); return; }
    }
    throw new Error('Delivery receipt persistence contention');
  };
  const pending = (deliveryWrites.get(sessionId) ?? Promise.resolve()).catch(() => {}).then(write);
  deliveryWrites.set(sessionId, pending);
  void pending.finally(() => { if (deliveryWrites.get(sessionId) === pending) deliveryWrites.delete(sessionId); }).catch(() => {});
  return pending;
}
