/**
 * PRD4 §14 — Persistance + sync Notion du nouveau questionnaire.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { QuestionnairePRD4Data } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function savePRD4Questionnaire(
  sessionId: string,
  data: QuestionnairePRD4Data,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ questionnaire_responses: JSON.parse(JSON.stringify(data)) as Json })
    .eq("id", sessionId);
  if (error) console.warn("[PRD4 questionnaire] save failed:", error.message);
}

export async function syncPRD4QuestionnaireToNotion(
  sessionId: string,
  data: QuestionnairePRD4Data,
): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-questionnaire`, {
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
