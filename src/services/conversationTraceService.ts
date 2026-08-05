import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ConversationTurnTrace, ConversationTurnTraceRow } from "@/types";

export type ConversationTurnTraceSummary = Omit<ConversationTurnTraceRow, "trace">;

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function persistConversationTurnTrace(
  trace: ConversationTurnTrace,
  signal?: AbortSignal,
): Promise<{ id: string; writeLatencyMs: number }> {
  const startedAt = performance.now();
  let query = supabase
    .from("conversation_turn_traces")
    .upsert({
      session_id: trace.identity.sessionId,
      turn_id: trace.identity.turnId,
      turn_index: trace.identity.turnIndex,
      schema_version: trace.schemaVersion,
      character_name: trace.identity.characterName,
      status: trace.identity.status,
      trace: toJson(trace),
    }, { onConflict: "session_id,turn_index" });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query
    .select("id")
    .single();

  if (error) throw new Error(`Diagnostic trace persistence failed: ${error.message}`);
  return {
    id: data.id,
    writeLatencyMs: Math.round(performance.now() - startedAt),
  };
}

export async function patchConversationTurnTrace(
  sessionId: string,
  turnIndex: number,
  path: string[],
  value: unknown,
  signal?: AbortSignal,
): Promise<void> {
  let query = supabase.rpc("patch_conversation_turn_trace", {
    p_session_id: sessionId,
    p_turn_index: turnIndex,
    p_path: path,
    p_value: toJson(value),
  });
  if (signal) query = query.abortSignal(signal);
  const { error } = await query;
  if (error) throw new Error(`Diagnostic trace patch failed: ${error.message}`);
}

export async function fetchConversationTurnTraceSummaries(
  sessionId: string,
): Promise<ConversationTurnTraceSummary[]> {
  const { data, error } = await supabase
    .from("conversation_turn_traces")
    .select("id, session_id, turn_id, turn_index, schema_version, character_name, status, created_at, updated_at")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchConversationTurnTrace(
  sessionId: string,
  turnIndex: number,
): Promise<ConversationTurnTraceRow | null> {
  const { data, error } = await supabase
    .from("conversation_turn_traces")
    .select("id, session_id, turn_id, turn_index, schema_version, character_name, status, trace, created_at, updated_at")
    .eq("session_id", sessionId)
    .eq("turn_index", turnIndex)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    trace: data.trace as unknown as ConversationTurnTrace,
  };
}
