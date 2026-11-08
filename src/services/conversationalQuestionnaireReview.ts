/**
 * Conversational questionnaire — final validation (lot 3), pure.
 *
 * Plan: docs/plan_questionnaire_conversationnel.md. The participant reviews a
 * summary per dimension, may correct every text, changes a score only with an
 * explicit tap, gives consent to keep the transcript (never the audio), may
 * leave an email and opt-ins, then « Valider et envoyer » is the only trigger
 * of the definitive save.
 */
import type {
  ConversationalDimensionKey,
  ConversationalScore,
  ConversationalSessionContext,
  DimensionAnswer,
  QuestionnaireConversationalData,
} from "@/types";
import { CONVERSATIONAL_DIMENSIONS, CONVERSATIONAL_VERSION, normalizeScore } from "./conversationalQuestionnaire";
import { DIMENSION_LABELS } from "./conversationalQuestionnaireFlow";

export type EditableField = "answer" | "follow_up" | "score_comment";

export interface ReviewState {
  /** Dimensions as captured during the conversation, kept to detect edits. */
  original: Record<ConversationalDimensionKey, DimensionAnswer>;
  dimensions: Record<ConversationalDimensionKey, DimensionAnswer>;
  consent: boolean;
  email: string;
  optInUpdates: boolean;
  optInFeedback: boolean;
}

function clone(dimensions: Record<ConversationalDimensionKey, DimensionAnswer>) {
  const copy = {} as Record<ConversationalDimensionKey, DimensionAnswer>;
  for (const key of CONVERSATIONAL_DIMENSIONS) {
    const d = dimensions[key];
    copy[key] = { ...d, follow_up: d.follow_up ? { ...d.follow_up } : null };
  }
  return copy;
}

export function startReview(dimensions: Record<ConversationalDimensionKey, DimensionAnswer>): ReviewState {
  return {
    original: clone(dimensions),
    dimensions: clone(dimensions),
    consent: false,
    email: "",
    optInUpdates: false,
    optInFeedback: false,
  };
}

/** Edits one text of a dimension. The follow-up answer exists only when a follow-up was asked. */
export function editDimensionText(
  state: ReviewState,
  key: ConversationalDimensionKey,
  field: EditableField,
  text: string,
): ReviewState {
  const current = state.dimensions[key];
  let next: DimensionAnswer;
  if (field === "answer") next = { ...current, answer: text };
  else if (field === "score_comment") next = { ...current, score_comment: text };
  else {
    if (!current.follow_up) return state;
    next = { ...current, follow_up: { ...current.follow_up, answer: text } };
  }
  return { ...state, dimensions: { ...state.dimensions, [key]: next } };
}

/**
 * Explicit tap on a score pastille (or « je préfère ne pas noter » = null).
 * Re-tapping the score already confirmed keeps its original source.
 */
export function changeScore(state: ReviewState, key: ConversationalDimensionKey, score: ConversationalScore): ReviewState {
  const normalized = normalizeScore(score);
  const current = state.dimensions[key];
  const original = state.original[key];
  const source = normalized === null
    ? null
    : normalized === original.score ? original.score_source : "touch";
  return {
    ...state,
    dimensions: { ...state.dimensions, [key]: { ...current, score: normalized, score_source: source } },
  };
}

const norm = (value: string | null | undefined) => (value ?? "").trim();

/** True as soon as one text or one score differs from what was captured. */
export function isEditedByUser(state: ReviewState): boolean {
  return CONVERSATIONAL_DIMENSIONS.some((key) => {
    const a = state.original[key];
    const b = state.dimensions[key];
    return norm(a.answer) !== norm(b.answer)
      || norm(a.follow_up?.answer) !== norm(b.follow_up?.answer)
      || norm(a.score_comment) !== norm(b.score_comment)
      || a.score !== b.score;
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** Reasons the « Valider et envoyer » button stays disabled; empty = ready. */
export function reviewBlockers(state: ReviewState): string[] {
  const blockers: string[] = [];
  if (!state.consent) blockers.push("consent");
  if (state.email.trim() && !isValidEmail(state.email)) blockers.push("email");
  return blockers;
}

/** Validated summary text, one line per dimension, from the (possibly edited) texts. */
export function validatedSummary(dimensions: Record<ConversationalDimensionKey, DimensionAnswer>): string {
  return CONVERSATIONAL_DIMENSIONS.map((key) => {
    const d = dimensions[key];
    const parts = [`${DIMENSION_LABELS[key]} — ${d.score === null ? "non évalué" : `${d.score}/5`}`];
    if (norm(d.answer)) parts.push(norm(d.answer));
    if (norm(d.follow_up?.answer)) parts.push(norm(d.follow_up?.answer));
    if (norm(d.score_comment)) parts.push(norm(d.score_comment));
    return parts.join(" · ");
  }).join("\n");
}

/** Definitive payload; returns null while a blocker remains (no save possible). */
export function buildFinalQuestionnaire(
  state: ReviewState,
  context: ConversationalSessionContext,
  now: Date = new Date(),
): QuestionnaireConversationalData | null {
  if (reviewBlockers(state).length) return null;
  const timestamp = now.toISOString();
  const dimensions = {} as Record<ConversationalDimensionKey, DimensionAnswer>;
  for (const key of CONVERSATIONAL_DIMENSIONS) {
    const d = state.dimensions[key];
    dimensions[key] = {
      ...d,
      answer: norm(d.answer),
      follow_up: d.follow_up ? { question: d.follow_up.question, answer: norm(d.follow_up.answer) } : null,
      score_comment: norm(d.score_comment) || null,
    };
  }
  const email = state.email.trim();
  return {
    version: CONVERSATIONAL_VERSION,
    submitted_at: timestamp,
    dimensions,
    summary: { text: validatedSummary(dimensions), edited_by_user: isEditedByUser(state), validated_at: timestamp },
    consent: {
      transcript_storage: true,
      ...(email ? { contact_email: email } : {}),
      // Opt-ins mean nothing without a way to reach the participant.
      opt_in_updates: !!email && state.optInUpdates,
      opt_in_feedback: !!email && state.optInFeedback,
    },
    session_context: context,
  };
}
