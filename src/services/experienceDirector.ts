import { supabase } from "@/integrations/supabase/client";
import type { DirectorAction, ExperienceDirectorDecisionV1 } from "@/types";

export type DirectorBlockReason =
  | "invalid_configuration"
  | "late_result"
  | "action_already_pending"
  | "handoff_before_minimum_turn"
  | "handoff_limit_reached"
  | "handoff_disabled"
  | "handoff_wrong_direction"
  | "target_not_ready"
  | "cinematic_disabled"
  | "cinematic_unavailable"
  | "cinematic_already_played"
  | "cinematic_cooldown"
  | "cinematic_limit_reached";

export interface DirectorGuardContext {
  configPublished: boolean;
  currentCharacter: "max" | "emma";
  userTurn: number;
  handoffCount: number;
  handoffPending: boolean;
  handoffsEnabled: boolean;
  minimumHandoffTurn: number;
  maximumHandoffsPerSession: number;
  emmaReady: boolean;
  playedVideoIds: string[];
  availableVideoIds: string[];
  lastVideoTurn: number | null;
  minimumVideoTurn: number;
  minimumTurnsBetweenVideos: number;
  maximumVideosPerSession: number;
  cinematicsEnabled: boolean;
  resultIsCurrent: boolean;
}

export interface GuardedDirectorDecision extends ExperienceDirectorDecisionV1 {
  accepted: boolean;
  blockedReason: DirectorBlockReason | null;
  recommendedAction: DirectorAction;
}

const NONE: DirectorAction = { type: "none" };

export function validateDirectorDecision(
  decision: ExperienceDirectorDecisionV1,
  context: DirectorGuardContext,
): GuardedDirectorDecision {
  const blocked = (reason: DirectorBlockReason): GuardedDirectorDecision => ({
    ...decision,
    accepted: false,
    blockedReason: reason,
    recommendedAction: decision.action,
    action: NONE,
  });
  const accepted = (): GuardedDirectorDecision => ({
    ...decision,
    accepted: true,
    blockedReason: null,
    recommendedAction: decision.action,
  });

  if (!context.configPublished) return blocked("invalid_configuration");
  if (!context.resultIsCurrent) return blocked("late_result");
  if (decision.action.type === "none") return accepted();
  if (context.handoffPending) return blocked("action_already_pending");

  if (decision.action.type === "handoff") {
    if (!context.handoffsEnabled || context.maximumHandoffsPerSession <= 0) return blocked("handoff_disabled");
    if (context.currentCharacter !== "max" || decision.action.targetCharacter !== "emma") {
      return blocked("handoff_wrong_direction");
    }
    if (context.userTurn < context.minimumHandoffTurn) return blocked("handoff_before_minimum_turn");
    if (context.handoffCount >= context.maximumHandoffsPerSession) return blocked("handoff_limit_reached");
    if (!context.emmaReady) return blocked("target_not_ready");
    return accepted();
  }

  if (decision.action.type === "cinematic") {
    if (!context.cinematicsEnabled) return blocked("cinematic_disabled");
    if (!context.availableVideoIds.includes(decision.action.videoId)) return blocked("cinematic_unavailable");
    if (context.playedVideoIds.includes(decision.action.videoId)) return blocked("cinematic_already_played");
    if (context.userTurn < context.minimumVideoTurn) return blocked("cinematic_cooldown");
    if (
      context.lastVideoTurn != null
      && context.userTurn - context.lastVideoTurn < context.minimumTurnsBetweenVideos
    ) return blocked("cinematic_cooldown");
    if (
      context.maximumVideosPerSession > 0
      && context.playedVideoIds.length >= context.maximumVideosPerSession
    ) return blocked("cinematic_limit_reached");
    return accepted();
  }

  return accepted();
}

export async function appendExperienceEvent(input: {
  sessionId: string;
  eventKey: string;
  eventType: string;
  turnId?: string | null;
  turnIndex?: number | null;
  character?: "max" | "emma" | null;
  orchestrationVersionId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from("experience_events" as never)
    .insert({
      session_id: input.sessionId,
      event_key: input.eventKey,
      event_type: input.eventType,
      turn_id: input.turnId ?? null,
      turn_index: input.turnIndex ?? null,
      character_key: input.character ?? null,
      orchestration_version_id: input.orchestrationVersionId ?? null,
      payload: input.payload ?? {},
    } as never);
  // Idempotency collisions are expected on retries and require no mutation.
  if (error && error.code !== "23505") throw error;
}
