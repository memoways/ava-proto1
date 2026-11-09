import { describe, expect, it } from "vitest";
import type { ConversationalDimensionKey, ConversationalSessionContext, DimensionAnswer, QuestionnaireConversationalData } from "@/types";
import { CONVERSATIONAL_DIMENSIONS, radarScores, validateConversationalQuestionnaire } from "./conversationalQuestionnaire";
import {
  buildFinalQuestionnaire,
  changeScore,
  editDimensionText,
  isEditedByUser,
  reviewBlockers,
  startReview,
  validatedSummary,
} from "./conversationalQuestionnaireReview";
import { aggregateConversational, conversationalRows, filterByDevice } from "./conversationalQuestionnaireAggregate";

const context = (device: ConversationalSessionContext["device_class"] = "smartphone"): ConversationalSessionContext => ({
  session_id: "s1", film: "vu", teaser: { seen: true, skipped: false }, starting_character: "max",
  characters_called: ["max"], handoffs: [], cinematics: [], duration_seconds: 200, turn_count: 4,
  avg_latency_ms: 1800, max_latency_ms: 3000, mic_errors: 0, hands_free: false, end_reason: "timer",
  device_class: device, call_mode: "tts", avatar_fallback: false, role_profile: null, posture: null,
  transcript_available: true,
});

function dims(scores: Array<1 | 2 | 3 | 4 | 5 | null>): Record<ConversationalDimensionKey, DimensionAnswer> {
  const out = {} as Record<ConversationalDimensionKey, DimensionAnswer>;
  CONVERSATIONAL_DIMENSIONS.forEach((key, i) => {
    out[key] = {
      question: `Q ${key}`,
      answer: `Réponse ${key}`,
      follow_up: key === "fluidity" ? { question: "Pourquoi ?", answer: "Les silences." } : null,
      score: scores[i],
      score_source: scores[i] === null ? null : i === 0 ? "voice_confirmed" : "touch",
      score_comment: null,
    };
  });
  return out;
}

const now = new Date("2026-11-08T12:00:00Z");

describe("final validation", () => {
  it("requires consent and keeps nothing edited when the participant only validates", () => {
    const review = startReview(dims([4, null, 3, 5, 2]));
    expect(reviewBlockers(review)).toEqual(["consent"]);
    expect(buildFinalQuestionnaire(review, context(), now)).toBeNull();
    const data = buildFinalQuestionnaire({ ...review, consent: true }, context(), now)!;
    expect(validateConversationalQuestionnaire(data)).toEqual([]);
    expect(data.summary).toEqual({ text: validatedSummary(data.dimensions), edited_by_user: false, validated_at: now.toISOString() });
    expect(data.summary.text).toContain("Intérêt — non évalué");
    expect(data.consent).toEqual({ transcript_storage: true, opt_in_updates: false, opt_in_feedback: false });
    expect(data.dimensions.fluidity.score_source).toBe("voice_confirmed");
  });

  it("marks edited_by_user as soon as one text changes, and not for whitespace", () => {
    const review = startReview(dims([4, 4, 4, 4, 4]));
    expect(isEditedByUser(editDimensionText(review, "immersion", "answer", "Réponse immersion  "))).toBe(false);
    expect(isEditedByUser(editDimensionText(review, "fluidity", "follow_up", "Les longs silences."))).toBe(true);
    expect(isEditedByUser(editDimensionText(review, "interest", "score_comment", "Bien"))).toBe(true);
    // No follow-up was asked: there is nothing to edit.
    expect(editDimensionText(review, "interest", "follow_up", "x")).toBe(review);
  });

  it("changes a score only through an explicit tap and keeps the original source when unchanged", () => {
    const review = startReview(dims([4, null, 3, 5, 2]));
    const touched = changeScore(review, "fluidity", 2);
    expect(touched.dimensions.fluidity).toMatchObject({ score: 2, score_source: "touch" });
    expect(isEditedByUser(touched)).toBe(true);
    expect(changeScore(touched, "fluidity", 4).dimensions.fluidity.score_source).toBe("voice_confirmed");
    expect(changeScore(review, "immersion", null).dimensions.immersion).toMatchObject({ score: null, score_source: null });
    expect(changeScore(review, "immersion", 0 as never).dimensions.immersion.score).toBeNull();
  });

  it("blocks an invalid email and drops opt-ins without an email", () => {
    const review = { ...startReview(dims([4, 4, 4, 4, 4])), consent: true, optInUpdates: true, optInFeedback: true };
    expect(reviewBlockers({ ...review, email: "lea@" })).toEqual(["email"]);
    expect(buildFinalQuestionnaire(review, context(), now)!.consent).toEqual({ transcript_storage: true, opt_in_updates: false, opt_in_feedback: false });
    expect(buildFinalQuestionnaire({ ...review, email: " lea@example.com " }, context(), now)!.consent).toEqual({
      transcript_storage: true, contact_email: "lea@example.com", opt_in_updates: true, opt_in_feedback: true,
    });
  });

  it("keeps not-rated dimensions out of the radar, never at 0", () => {
    const data = buildFinalQuestionnaire({ ...startReview(dims([4, null, 3, null, 2])), consent: true }, context(), now)!;
    const radar = radarScores(data);
    expect(radar.notRated).toEqual(["interest", "character_credibility"]);
    expect(Object.values(radar.rated)).not.toContain(0);
    expect(radar.rated).toEqual({ fluidity: 4, immersion: 3, emotional_engagement: 2 });
  });
});

function payload(scores: Array<1 | 2 | 3 | 4 | 5 | null>, device: ConversationalSessionContext["device_class"]): QuestionnaireConversationalData {
  return buildFinalQuestionnaire({ ...startReview(dims(scores)), consent: true }, context(device), now)!;
}

describe("admin aggregate", () => {
  const sessions = [
    { id: "a-session", name: "A", questionnaire_responses: payload([4, null, 3, 5, 2], "smartphone") },
    { id: "b-session", name: null, questionnaire_responses: payload([2, null, null, 3, 4], "desktop") },
    { id: "c-prd4", name: "PRD4", questionnaire_responses: { version: "prd4", answers: {}, technical: {} } },
    { id: "d-legacy", name: "Legacy", questionnaire_responses: { experience_rating: 8, nps: 9 } },
    { id: "e-none", name: "Vide", questionnaire_responses: null },
  ];

  it("keeps only conversational answers and leaves PRD4/legacy aside", () => {
    expect(conversationalRows(sessions).map((row) => row.sessionId)).toEqual(["a-session", "b-session"]);
    expect(conversationalRows(sessions)[1].label).toBe("b-sessio");
  });

  it("averages only the given scores and counts « non évalué » apart", () => {
    const aggregate = aggregateConversational(conversationalRows(sessions));
    expect(aggregate.total).toBe(2);
    expect(aggregate.dimensions.fluidity).toEqual({ mean: 3, rated: 2, notRated: 0 });
    expect(aggregate.dimensions.interest).toEqual({ mean: null, rated: 0, notRated: 2 });
    expect(aggregate.dimensions.immersion).toEqual({ mean: 3, rated: 1, notRated: 1 });
    expect(aggregate.verbatims.fluidity[0]).toMatchObject({ label: "A", device: "smartphone", score: 4, followUp: { question: "Pourquoi ?", answer: "Les silences." } });
  });

  it("filters by device", () => {
    const rows = conversationalRows(sessions);
    expect(filterByDevice(rows, "all")).toHaveLength(2);
    expect(filterByDevice(rows, "desktop").map((row) => row.sessionId)).toEqual(["b-session"]);
    expect(aggregateConversational(filterByDevice(rows, "tablet")).total).toBe(0);
    expect(aggregateConversational(filterByDevice(rows, "smartphone")).dimensions.emotional_engagement.mean).toBe(2);
  });
});

describe("questionnaire layout per device", () => {
  it("maps the session device class to a layout, desktop when unknown", async () => {
    const { questionnaireLayoutFor, isTouchLayout } = await import("./conversationalQuestionnaireLayout");
    expect(questionnaireLayoutFor("smartphone")).toBe("phone");
    expect(questionnaireLayoutFor("tablet")).toBe("tablet");
    expect(questionnaireLayoutFor("desktop")).toBe("desktop");
    expect(questionnaireLayoutFor(undefined)).toBe("desktop");
    expect(isTouchLayout("tablet")).toBe(true);
    expect(isTouchLayout("desktop")).toBe(false);
  });
});
