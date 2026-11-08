/**
 * Conversational questionnaire — admin aggregate (lot 3), pure.
 *
 * Means use only the scores actually given; « non évalué » is counted apart
 * and never treated as 0. PRD4 and legacy answers are ignored here (they keep
 * their own rendering).
 */
import type { ConversationalDimensionKey, ConversationalSessionContext, QuestionnaireConversationalData } from "@/types";
import { CONVERSATIONAL_DIMENSIONS, isConversationalQuestionnaire, normalizeScore } from "./conversationalQuestionnaire";

export type DeviceFilter = "all" | ConversationalSessionContext["device_class"];

export const DEVICE_LABELS: Record<Exclude<DeviceFilter, "all">, string> = {
  smartphone: "Smartphone",
  tablet: "Tablette",
  desktop: "Desktop",
};

export interface ConversationalRow {
  sessionId: string;
  label: string;
  data: QuestionnaireConversationalData;
}

export interface DimensionAggregate {
  mean: number | null;
  rated: number;
  notRated: number;
}

export interface Verbatim {
  sessionId: string;
  label: string;
  device: ConversationalSessionContext["device_class"];
  score: 1 | 2 | 3 | 4 | 5 | null;
  answer: string;
  followUp: { question: string; answer: string } | null;
  comment: string | null;
}

export interface ConversationalAggregate {
  total: number;
  dimensions: Record<ConversationalDimensionKey, DimensionAggregate>;
  verbatims: Record<ConversationalDimensionKey, Verbatim[]>;
}

/** Picks the `conversational-v1` answers from admin session rows. */
export function conversationalRows(
  sessions: ReadonlyArray<{ id: string; name?: string | null; questionnaire_responses?: unknown }>,
): ConversationalRow[] {
  const rows: ConversationalRow[] = [];
  for (const session of sessions) {
    if (!isConversationalQuestionnaire(session.questionnaire_responses)) continue;
    rows.push({ sessionId: session.id, label: session.name || session.id.slice(0, 8), data: session.questionnaire_responses });
  }
  return rows;
}

export function filterByDevice(rows: readonly ConversationalRow[], device: DeviceFilter): ConversationalRow[] {
  return device === "all" ? [...rows] : rows.filter((row) => row.data.session_context?.device_class === device);
}

export function aggregateConversational(rows: readonly ConversationalRow[]): ConversationalAggregate {
  const dimensions = {} as Record<ConversationalDimensionKey, DimensionAggregate>;
  const verbatims = {} as Record<ConversationalDimensionKey, Verbatim[]>;
  for (const key of CONVERSATIONAL_DIMENSIONS) {
    let sum = 0;
    let rated = 0;
    let notRated = 0;
    verbatims[key] = [];
    for (const row of rows) {
      const dimension = row.data.dimensions?.[key];
      const score = normalizeScore(dimension?.score);
      if (score === null) notRated += 1;
      else { sum += score; rated += 1; }
      const answer = dimension?.answer?.trim() ?? "";
      const followAnswer = dimension?.follow_up?.answer?.trim() ?? "";
      const comment = dimension?.score_comment?.trim() || null;
      if (answer || followAnswer || comment) {
        verbatims[key].push({
          sessionId: row.sessionId,
          label: row.label,
          device: row.data.session_context?.device_class,
          score,
          answer,
          followUp: dimension?.follow_up ? { question: dimension.follow_up.question, answer: followAnswer } : null,
          comment,
        });
      }
    }
    dimensions[key] = { mean: rated ? Math.round((sum / rated) * 10) / 10 : null, rated, notRated };
  }
  return { total: rows.length, dimensions, verbatims };
}
