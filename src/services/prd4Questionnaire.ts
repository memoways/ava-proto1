/**
 * PRD4 §14 — Persistance + sync Notion du nouveau questionnaire.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { QuestionnaireConversationalData, QuestionnairePRD4Data } from "@/types";
import { validateConversationalQuestionnaire } from "@/services/conversationalQuestionnaire";
import { authenticatedFunctionFetch } from "@/services/gameAuth";
import { trackEvent } from "@/services/posthogService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function savePRD4Questionnaire(
  sessionId: string,
  data: QuestionnairePRD4Data,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ questionnaire_responses: JSON.parse(JSON.stringify(data)) as Json })
    .eq("id", sessionId);
  trackEvent("prd4_persistence_result", {
    operation: "save_questionnaire",
    success: !error,
    session_id: sessionId,
  });
  if (error) console.warn("[PRD4 questionnaire] save failed:", error.message);
}

export async function syncPRD4QuestionnaireToNotion(
  sessionId: string,
  data: QuestionnairePRD4Data,
): Promise<void> {
  try {
    const res = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/sync-questionnaire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionnaire: data,
        durationSeconds: data.technical.duration_seconds,
        voiceModality: "push_to_talk",
      }),
    });
    if (!res.ok) {
      console.warn("[PRD4 questionnaire] notion sync failed:", await res.text());
    }
  } catch (err) {
    console.warn("[PRD4 questionnaire] notion sync error:", err);
  }
}

// ============================================================================
// Conversational questionnaire (`conversational-v1`), stored next to PRD4.
// ============================================================================

export type ConversationalSaveResult = { saved: true } | { saved: false; reason: "invalid" | "error"; detail: string };

/**
 * Writes `conversational-v1` into `sessions.questionnaire_responses` only when
 * the session has no questionnaire yet: an existing PRD4 or legacy answer is
 * never overwritten. Under RLS a filtered update can match zero rows without
 * error, so "no error" means "written or already answered", not a read-back.
 */
export async function saveConversationalQuestionnaire(
  sessionId: string,
  data: QuestionnaireConversationalData,
): Promise<ConversationalSaveResult> {
  const problems = validateConversationalQuestionnaire(data);
  if (problems.length) {
    console.warn("[Conversational questionnaire] invalid payload:", problems);
    return { saved: false, reason: "invalid", detail: problems.join(", ") };
  }
  const { error } = await supabase
    .from("sessions")
    .update({ questionnaire_responses: JSON.parse(JSON.stringify(data)) as Json })
    .eq("id", sessionId)
    .is("questionnaire_responses", null);
  trackEvent("prd4_persistence_result", {
    operation: "save_questionnaire_conversational",
    success: !error,
    session_id: sessionId,
  });
  if (error) {
    console.warn("[Conversational questionnaire] save failed:", error.message);
    return { saved: false, reason: "error", detail: error.message };
  }
  return { saved: true };
}

export async function syncConversationalQuestionnaireToNotion(
  sessionId: string,
  data: QuestionnaireConversationalData,
): Promise<void> {
  try {
    const res = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/sync-questionnaire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionnaire: data,
        durationSeconds: data.session_context.duration_seconds,
        gameOverReason: data.session_context.end_reason,
      }),
    });
    if (!res.ok) console.warn("[Conversational questionnaire] notion sync failed:", await res.text());
  } catch (err) {
    console.warn("[Conversational questionnaire] notion sync error:", err);
  }
}
