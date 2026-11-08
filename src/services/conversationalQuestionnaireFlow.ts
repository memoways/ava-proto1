/**
 * Conversational questionnaire — voice path (lot 2), pure state machine.
 *
 * Plan: docs/plan_questionnaire_conversationnel.md. One dimension at a time:
 * open answer → at most ONE follow-up → score (1–5 or "not rated") → the
 * participant moves on explicitly. Nothing advances on its own; a score is
 * never inferred silently and has no default value.
 */
import type {
  ConversationalDimensionKey,
  ConversationalScore,
  DimensionAnswer,
} from "@/types";
import {
  CONVERSATIONAL_DIMENSIONS,
  emptyDimensionAnswer,
  normalizeScore,
} from "./conversationalQuestionnaire";

export type FlowStep = "answer" | "follow_up_pending" | "follow_up" | "score" | "review";

export interface FlowState {
  index: number;
  step: FlowStep;
  dimensions: Record<ConversationalDimensionKey, DimensionAnswer>;
  /** Dimensions for which a follow-up was already requested (answered or not): never twice. */
  followUpRequested: ConversationalDimensionKey[];
  /** Score heard in the participant's words, shown for confirmation, never applied silently. */
  proposedScore: ConversationalScore;
}

export const DIMENSION_LABELS: Record<ConversationalDimensionKey, string> = {
  fluidity: "Fluidité",
  interest: "Intérêt",
  immersion: "Immersion",
  character_credibility: "Crédibilité des personnages",
  emotional_engagement: "Engagement émotionnel",
};

export function currentDimension(state: FlowState): ConversationalDimensionKey {
  return CONVERSATIONAL_DIMENSIONS[Math.min(state.index, CONVERSATIONAL_DIMENSIONS.length - 1)];
}

/** « X/5 » marker. */
export function progressLabel(state: FlowState): string {
  return `${Math.min(state.index + 1, CONVERSATIONAL_DIMENSIONS.length)}/${CONVERSATIONAL_DIMENSIONS.length}`;
}

export function startFlow(questions: Record<ConversationalDimensionKey, string>): FlowState {
  const dimensions = {} as Record<ConversationalDimensionKey, DimensionAnswer>;
  for (const key of CONVERSATIONAL_DIMENSIONS) dimensions[key] = emptyDimensionAnswer(questions[key]);
  return { index: 0, step: "answer", dimensions, followUpRequested: [], proposedScore: null };
}

function patch(state: FlowState, key: ConversationalDimensionKey, change: Partial<DimensionAnswer>): FlowState["dimensions"] {
  return { ...state.dimensions, [key]: { ...state.dimensions[key], ...change } };
}

/** Whether the answer validated now may still receive a follow-up. */
export function canRequestFollowUp(state: FlowState): boolean {
  return state.step === "answer" && !state.followUpRequested.includes(currentDimension(state));
}

/**
 * The participant validated the open answer. Returns the next state; when a
 * follow-up may be asked the step becomes `follow_up_pending` (the caller asks
 * proxy-llm), otherwise the score step.
 */
export function submitAnswer(state: FlowState, text: string): FlowState {
  if (state.step !== "answer") return state;
  const answer = text.trim();
  if (!answer) return state;
  const key = currentDimension(state);
  const dimensions = patch(state, key, { answer });
  if (canRequestFollowUp(state)) {
    return { ...state, dimensions, step: "follow_up_pending", followUpRequested: [...state.followUpRequested, key] };
  }
  return { ...state, dimensions, step: "score", proposedScore: detectSpokenScore(answer) };
}

/** Result of the follow-up request: a question, or null (none needed, failure, timeout). */
export function applyFollowUp(state: FlowState, question: string | null): FlowState {
  if (state.step !== "follow_up_pending") return state;
  const key = currentDimension(state);
  const cleaned = question?.trim() ?? "";
  if (!cleaned) {
    return { ...state, step: "score", proposedScore: detectSpokenScore(state.dimensions[key].answer) };
  }
  return { ...state, step: "follow_up", dimensions: patch(state, key, { follow_up: { question: cleaned, answer: "" } }) };
}

export function submitFollowUpAnswer(state: FlowState, text: string): FlowState {
  if (state.step !== "follow_up") return state;
  const key = currentDimension(state);
  const followUp = state.dimensions[key].follow_up;
  if (!followUp) return state;
  const answer = text.trim();
  const dimensions = patch(state, key, { follow_up: { ...followUp, answer } });
  const proposedScore = detectSpokenScore(answer) ?? detectSpokenScore(state.dimensions[key].answer);
  return { ...state, dimensions, step: "score", proposedScore };
}

/**
 * Confirms the score of the current dimension. `null` = « je préfère ne pas
 * noter ». `voice_confirmed` is only accepted for the score that was heard.
 */
export function confirmScore(
  state: FlowState,
  score: ConversationalScore,
  source: "touch" | "voice_confirmed",
  comment: string | null = null,
): FlowState {
  if (state.step !== "score") return state;
  const key = currentDimension(state);
  const normalized = normalizeScore(score);
  const effectiveSource = normalized === null
    ? null
    : source === "voice_confirmed" && normalized === state.proposedScore ? "voice_confirmed" : "touch";
  const trimmedComment = comment?.trim() ? comment.trim() : null;
  const dimensions = patch(state, key, { score: normalized, score_source: effectiveSource, score_comment: trimmedComment });
  const isLast = state.index >= CONVERSATIONAL_DIMENSIONS.length - 1;
  return {
    ...state,
    dimensions,
    index: isLast ? state.index : state.index + 1,
    step: isLast ? "review" : "answer",
    proposedScore: null,
  };
}

const NUMBER_WORDS: Record<string, 1 | 2 | 3 | 4 | 5> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 };
const NUMBER = "([1-5]|un|une|deux|trois|quatre|cinq)";
const SCORE_PATTERNS: RegExp[] = [
  new RegExp(`\\b${NUMBER}\\s*(?:/|sur)\\s*(?:5|cinq)\\b`, "i"),
  new RegExp(`\\b(?:je\\s+(?:dirais|mettrais|donnerais|donne|mets|note)|(?:ma\\s+)?note\\s*(?::|de)?|j'?\\s*(?:dirais|mettrais|donnerais))\\s+${NUMBER}\\b`, "i"),
];

/**
 * A score the participant said themselves (« je dirais 4 », « 3 sur 5 »).
 * Returned for confirmation only; never stored without a tap.
 */
export function detectSpokenScore(text: string): ConversationalScore {
  const normalized = text.toLowerCase().replace(/[’`]/g, "'");
  for (const pattern of SCORE_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const raw = match[1];
    const value = /^[1-5]$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
    const score = normalizeScore(value);
    if (score !== null) return score;
  }
  return null;
}

export function isFlowComplete(state: FlowState): boolean {
  return state.step === "review";
}
