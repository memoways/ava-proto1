import { supabase } from "@/integrations/supabase/client";
import type {
  DirectorAction,
  ExperienceDirectorConfig,
  ExperienceDirectorDecisionV1,
  HandoffTopicRule,
  PRD4TurnLabels,
} from "@/types";
import { characterDisplayName } from "@/services/characterConversation";

export type DirectorBlockReason =
  | "invalid_configuration"
  | "late_result"
  | "action_already_pending"
  | "handoff_before_minimum_turn"
  | "handoff_limit_reached"
  | "handoff_disabled"
  | "handoff_same_character"
  | "handoff_cooldown"
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
  lastHandoffTurn: number | null;
  handoffsEnabled: boolean;
  minimumHandoffTurn: number;
  maximumHandoffsPerSession: number;
  minimumTurnsBetweenHandoffs: number;
  targetReady: boolean;
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

function labelsMatchRule(labels: PRD4TurnLabels, rule: HandoffTopicRule): boolean {
  const themes = new Set((labels.themes ?? []).map((value) => value.trim().toLowerCase()));
  const topics = new Set((labels.topics ?? []).map((value) => value.trim().toLowerCase()));
  return rule.themes.some((theme) => themes.has(theme)) || rule.topics.some((topic) => topics.has(topic));
}

export function matchHandoffTopicRules(
  labels: PRD4TurnLabels,
  rules: HandoffTopicRule[] | undefined,
  currentCharacter: "max" | "emma",
): "max" | "emma" | null {
  for (const rule of rules ?? []) {
    if (rule.targetCharacter === currentCharacter) continue;
    if (labelsMatchRule(labels, rule)) return rule.targetCharacter;
  }
  return null;
}

export function handoffActionFromRule(
  targetCharacter: "max" | "emma",
  labels: PRD4TurnLabels,
): DirectorAction {
  const target = characterDisplayName(targetCharacter);
  const hint = [...labels.themes, ...labels.topics].filter(Boolean).slice(0, 3).join(", ");
  return {
    type: "handoff",
    targetCharacter,
    reason: hint ? `${target} est plus à même de parler de : ${hint}.` : `${target} peut éclairer ce sujet.`,
    proposalGuidance: `Propose naturellement au joueur de parler avec ${target}, sans le forcer.`,
  };
}

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
    if (decision.action.targetCharacter === context.currentCharacter) return blocked("handoff_same_character");
    if (context.userTurn < context.minimumHandoffTurn) return blocked("handoff_before_minimum_turn");
    if (context.handoffCount >= context.maximumHandoffsPerSession) return blocked("handoff_limit_reached");
    if (
      context.lastHandoffTurn != null
      && context.userTurn - context.lastHandoffTurn < context.minimumTurnsBetweenHandoffs
    ) return blocked("handoff_cooldown");
    if (!context.targetReady) return blocked("target_not_ready");
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

export function applyTopicHandoffFallback(
  decision: ExperienceDirectorDecisionV1,
  config: ExperienceDirectorConfig | null | undefined,
  currentCharacter: "max" | "emma",
): ExperienceDirectorDecisionV1 {
  if (decision.action.type !== "none") return decision;
  const target = matchHandoffTopicRules(decision.labels, config?.editor.handoffRules, currentCharacter);
  if (!target) return decision;
  return { ...decision, action: handoffActionFromRule(target, decision.labels) };
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
  if (error) console.warn("[experience_events] append failed:", error.message);
}
