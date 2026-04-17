import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "./debugLogger";
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
  debugLogger.log({ service: "session", level: "info", direction: "out", label: "Create session", detail: `branch=${branch}` });
  const { data, error } = await supabase
    .from("sessions")
    .insert({ branch, started_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error) {
    debugLogger.logError("session", "Create session failed", error);
    console.error("[Session] Failed to create:", error);
    throw error;
  }
  debugLogger.log({ service: "session", level: "success", direction: "in", label: `Session created: ${data.id}` });
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
    variante_onboarding?: "A" | "B";
    modalite_voix?: "micro_ouvert" | "push_to_talk";
    personnage_appele?: string;
    narrative_end?: boolean;
  }
): Promise<void> {
  const payload: {
    trust_level?: number;
    conversation_log?: Json;
    triggers_activated?: string[];
    variante_onboarding?: string;
    modalite_voix?: string;
    personnage_appele?: string;
    narrative_end?: boolean;
  } = {};
  if (updates.trust_level !== undefined) payload.trust_level = updates.trust_level;
  if (updates.conversation_log) payload.conversation_log = JSON.parse(JSON.stringify(updates.conversation_log)) as Json;
  if (updates.triggers_activated) payload.triggers_activated = updates.triggers_activated;
  if (updates.variante_onboarding) payload.variante_onboarding = updates.variante_onboarding;
  if (updates.modalite_voix) payload.modalite_voix = updates.modalite_voix;
  if (updates.personnage_appele) payload.personnage_appele = updates.personnage_appele;
  if (updates.narrative_end !== undefined) payload.narrative_end = updates.narrative_end;

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Sync questionnaire responses to Notion */
export async function syncQuestionnaireToNotion(
  sessionId: string,
  questionnaire: QuestionnaireData,
  trustLevel: number,
  durationSeconds: number,
  gameOverReason: string | null
): Promise<void> {
  try {
    const startTime = Date.now();
    const debugId = debugLogger.logFetch("notion", "Sync questionnaire → Notion", `${SUPABASE_URL}/functions/v1/sync-questionnaire`, { sessionId });
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-questionnaire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionnaire,
        trustLevel,
        durationSeconds,
        gameOverReason,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      debugLogger.logResponse(debugId, "notion", "Sync questionnaire", res.status, startTime, err);
      console.error("[Notion] Questionnaire sync failed:", err);
    } else {
      debugLogger.logResponse(debugId, "notion", "Sync questionnaire OK", res.status, startTime);
      console.log("[Notion] Questionnaire synced successfully");
    }
  } catch (err) {
    debugLogger.logError("notion", "Questionnaire sync error", err);
    console.error("[Notion] Questionnaire sync error:", err);
  }
}
