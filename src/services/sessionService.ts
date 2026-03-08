import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ConversationMessage, QuestionnaireData } from "@/types";

export interface SessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  trust_level: number;
  conversation_log: ConversationMessage[];
  triggers_activated: string[];
  game_over_reason: string | null;
  questionnaire_responses: QuestionnaireData | null;
  duration_seconds: number | null;
  branch: string;
}

/** Create a new session row and return its ID */
export async function createSession(branch = "male"): Promise<string> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ branch, started_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error) {
    console.error("[Session] Failed to create:", error);
    throw error;
  }
  console.log("[Session] Created:", data.id);
  return data.id;
}

/** Update session with current game state (call after each turn) */
export async function updateSession(
  sessionId: string,
  updates: {
    trust_level?: number;
    conversation_log?: ConversationMessage[];
    triggers_activated?: string[];
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.trust_level !== undefined) payload.trust_level = updates.trust_level;
  if (updates.conversation_log) payload.conversation_log = JSON.parse(JSON.stringify(updates.conversation_log)) as Json;
  if (updates.triggers_activated) payload.triggers_activated = updates.triggers_activated;

  const { error } = await supabase
    .from("sessions")
    .update(payload)
    .eq("id", sessionId);

  if (error) {
    console.error("[Session] Failed to update:", error);
  }
}

/** End a session with final data */
export async function endSession(
  sessionId: string,
  data: {
    game_over_reason: string | null;
    trust_level: number;
    conversation_log: ConversationMessage[];
    triggers_activated: string[];
    duration_seconds: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
      game_over_reason: data.game_over_reason,
      trust_level: data.trust_level,
      conversation_log: JSON.parse(JSON.stringify(data.conversation_log)) as Json,
      triggers_activated: data.triggers_activated,
      duration_seconds: data.duration_seconds,
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[Session] Failed to end:", error);
  } else {
    console.log("[Session] Ended:", sessionId);
  }
}

/** Save questionnaire responses */
export async function saveQuestionnaire(
  sessionId: string,
  responses: QuestionnaireData
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      questionnaire_responses: JSON.parse(JSON.stringify(responses)) as Json,
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[Session] Failed to save questionnaire:", error);
  } else {
    console.log("[Session] Questionnaire saved");
  }
}
