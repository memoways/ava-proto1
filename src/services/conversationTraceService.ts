import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ConversationTurnTraceRow, ConversationTurnTraceV1 } from "@/types";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function persistConversationTurnTrace(
  trace: ConversationTurnTraceV1,
): Promise<{ id: string; writeLatencyMs: number }> {
  const startedAt = performance.now();
  const { data, error } = await supabase
    .from("conversation_turn_traces")
    .upsert({
      session_id: trace.identity.sessionId,
      turn_id: trace.identity.turnId,
      turn_index: trace.identity.turnIndex,
      schema_version: trace.schemaVersion,
      character_name: trace.identity.characterName,
      status: trace.identity.status,
      trace: toJson(trace),
    }, { onConflict: "session_id,turn_index" })
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
): Promise<void> {
  const { error } = await supabase.rpc("patch_conversation_turn_trace", {
    p_session_id: sessionId,
    p_turn_index: turnIndex,
    p_path: path,
    p_value: toJson(value),
  });
  if (error) throw new Error(`Diagnostic trace patch failed: ${error.message}`);
}

export async function fetchConversationTurnTraces(
  sessionId: string,
): Promise<ConversationTurnTraceRow[]> {
  const { data, error } = await supabase
    .from("conversation_turn_traces")
    .select("id, session_id, turn_id, turn_index, schema_version, character_name, status, trace, created_at, updated_at")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    ...row,
    trace: row.trace as unknown as ConversationTurnTraceV1,
  }));
}
