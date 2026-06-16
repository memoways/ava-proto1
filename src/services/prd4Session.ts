/**
 * PRD4 — helpers de persistance session (createSession + updates spécifiques).
 * Réutilise la table `sessions` existante.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ConversationMessage, UserRoleProfile } from "@/types";
import type { Json } from "@/integrations/supabase/types";

export async function createPRD4Session(
  userRole: UserRoleProfile | null,
  character = "max",
  extra?: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      started_at: new Date().toISOString(),
      personnage_appele: character,
      player_role: (userRole as unknown as Json) ?? null,
      modalite_voix: "push_to_talk",
      ...(extra as any),
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export interface PRD4OnboardingPayload {
  ava_start_variant?: string;
  has_seen_film?: string | null;
  teaser_shown?: boolean;
  user_posture_raw?: string | null;
  user_posture_mode?: string | null;
  onboarding_started_at?: string | null;
  first_max_response_at?: string | null;
  onboarding_duration_ms?: number | null;
}

export async function updatePRD4Onboarding(
  sessionId: string,
  payload: PRD4OnboardingPayload,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update(payload as any)
    .eq("id", sessionId);
  if (error) console.warn("[PRD4 session] update onboarding failed:", error.message);
}


export async function updatePRD4Conversation(
  sessionId: string,
  conversation: ConversationMessage[],
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ conversation_log: JSON.parse(JSON.stringify(conversation)) as Json })
    .eq("id", sessionId);
  if (error) console.warn("[PRD4 session] update conversation failed:", error.message);
}

export async function endPRD4Session(
  sessionId: string,
  reason: string,
  conversation: ConversationMessage[],
  durationSeconds: number,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
      game_over_reason: reason,
      conversation_log: JSON.parse(JSON.stringify(conversation)) as Json,
      duration_seconds: durationSeconds,
    })
    .eq("id", sessionId);
  if (error) console.warn("[PRD4 session] end failed:", error.message);
}
