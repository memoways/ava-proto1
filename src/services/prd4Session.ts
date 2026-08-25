/**
 * PRD4 — helpers de persistance session (createSession + updates spécifiques).
 * Réutilise la table `sessions` existante.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ConversationMessage, RuntimeCharacter, UserRoleProfile } from "@/types";
import type { Database, Json } from "@/integrations/supabase/types";
import { ensureGameAuth } from "@/services/gameAuth";
import { trackEvent } from "@/services/posthogService";
import { getRuntimeContext } from "@/services/environmentContext";

type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];

function trackPersistence(operation: string, success: boolean, sessionId?: string): void {
  trackEvent("prd4_persistence_result", {
    operation,
    success,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

export async function createPRD4Session(
  userRole: UserRoleProfile | null,
  character = "max",
  extra?: SessionInsert,
): Promise<string> {
  await ensureGameAuth();
  const runtime = getRuntimeContext();
  const session: SessionInsert = {
    started_at: new Date().toISOString(),
    personnage_appele: character,
    player_role: (userRole as unknown as Json) ?? null,
    modalite_voix: "push_to_talk",
    ...extra,
    environment_id: runtime.environmentId,
    context_type: runtime.contextType,
    campaign_id: runtime.campaignId,
    tester_label: runtime.testerLabel,
    started_by_user_id: runtime.startedByUserId,
  };
  const { data, error } = await supabase
    .from("sessions")
    .insert(session)
    .select("id")
    .single();
  if (error) {
    trackPersistence("create_session", false);
    throw error;
  }
  trackPersistence("create_session", true, data.id);
  // Additive migration: older Lovable environments may not expose the RPC yet.
  // Session creation remains available, while migrated environments pin the
  // published GM version exactly once.
  const { error: pinError } = await supabase.rpc(
    "pin_current_orchestration_version" as never,
    { p_session_id: data.id } as never,
  );
  if (pinError) console.warn("[PRD4 session] orchestration pin unavailable:", pinError.message);
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
    .update(payload)
    .eq("id", sessionId);
  trackPersistence("update_onboarding", !error, sessionId);
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
  trackPersistence("update_conversation", !error, sessionId);
  if (error) console.warn("[PRD4 session] update conversation failed:", error.message);
}

export interface PRD4StreamingAvatarPayload {
  output_mode?: "tts" | "streaming_avatar";
  streaming_avatar_provider?: "heygen" | "tavus" | null;
  streaming_avatar_session_id?: string | null;
  streaming_avatar_connect_ms?: number | null;
  streaming_avatar_first_frame_ms?: number | null;
  streaming_avatar_first_speech_ms?: number | null;
  streaming_avatar_fallback_reason?: string | null;
}

export async function updatePRD4StreamingAvatar(
  sessionId: string,
  payload: PRD4StreamingAvatarPayload,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update(payload)
    .eq("id", sessionId);
  trackPersistence("update_streaming_avatar", !error, sessionId);
  if (error) console.warn("[PRD4 session] streaming avatar update failed:", error.message);
}

export async function updatePRD4ExperienceState(
  sessionId: string,
  payload: {
    activeCharacter?: "max" | "emma";
    pendingHandoff?: { reason: string; proposalGuidance: string; targetCharacter?: RuntimeCharacter } | null;
    handoffCount?: number;
  },
): Promise<void> {
  const update = {
    ...(payload.activeCharacter ? { active_character: payload.activeCharacter, personnage_appele: payload.activeCharacter } : {}),
    ...(payload.pendingHandoff !== undefined ? { pending_handoff: payload.pendingHandoff } : {}),
    ...(payload.handoffCount !== undefined ? { handoff_count: payload.handoffCount } : {}),
  };
  const { error } = await supabase
    .from("sessions" as never)
    .update(update as never)
    .eq("id", sessionId);
  trackPersistence("update_experience_state", !error, sessionId);
  if (error) throw error;
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
  trackPersistence("end_session", !error, sessionId);
  if (error) console.warn("[PRD4 session] end failed:", error.message);
}
