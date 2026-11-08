import { describe, expect, it } from "vitest";
import type { ConversationalSessionContext } from "@/types";
import { baseDimensionQuestions, CONVERSATIONAL_DIMENSIONS, validateConversationalQuestionnaire } from "./conversationalQuestionnaire";
import {
  applyFollowUp,
  buildProvisionalQuestionnaire,
  canRequestFollowUp,
  confirmScore,
  currentDimension,
  detectSpokenScore,
  progressLabel,
  rawSummary,
  startFlow,
  submitAnswer,
  submitFollowUpAnswer,
  type FlowState,
} from "./conversationalQuestionnaireFlow";
import { getGameplaySettings, normalizeQuestionnaireMode } from "./settingsService";

const context: ConversationalSessionContext = {
  session_id: "s1",
  film: "pas_vu",
  teaser: { seen: true, skipped: false },
  starting_character: "max",
  characters_called: ["max", "emma"],
  handoffs: [{ from: "max", to: "emma", returning: false }],
  cinematics: [],
  duration_seconds: 240,
  turn_count: 6,
  avg_latency_ms: 2400,
  max_latency_ms: 5200,
  mic_errors: 1,
  hands_free: true,
  end_reason: "timer",
  device_class: "smartphone",
  call_mode: "tts",
  avatar_fallback: false,
  role_profile: null,
  posture: null,
  transcript_available: true,
};

const questions = baseDimensionQuestions(context);

/** Answer, follow-up (none), score: the five dimensions in order. */
function runDimension(state: FlowState, answer: string, score: 1 | 2 | 3 | 4 | 5 | null): FlowState {
  return confirmScore(applyFollowUp(submitAnswer(state, answer), null), score, "touch");
}

describe("conversational questionnaire flow", () => {
  it("chains the five dimensions in order with a X/5 marker and never advances on its own", () => {
    let state = startFlow(questions);
    const seen: string[] = [];
    for (let i = 0; i < CONVERSATIONAL_DIMENSIONS.length; i += 1) {
      seen.push(currentDimension(state));
      expect(progressLabel(state)).toBe(`${i + 1}/5`);
      const answered = submitAnswer(state, "Ça marchait parce que la voix était claire.");
      // Still on the same dimension until the participant confirms a score.
      expect(currentDimension(answered)).toBe(seen[i]);
      state = confirmScore(applyFollowUp(answered, null), 4, "touch");
    }
    expect(seen).toEqual([...CONVERSATIONAL_DIMENSIONS]);
    expect(state.step).toBe("review");
  });

  it("asks at most one follow-up per dimension", () => {
    let state = submitAnswer(startFlow(questions), "Bof.");
    expect(state.step).toBe("follow_up_pending");
    expect(state.followUpRequested).toEqual(["fluidity"]);
    state = applyFollowUp(state, "Qu'est-ce qui t'a fait dire bof ?");
    expect(state.step).toBe("follow_up");
    state = submitFollowUpAnswer(state, "Il y avait des blancs.");
    expect(state.step).toBe("score");
    expect(state.dimensions.fluidity.follow_up).toEqual({ question: "Qu'est-ce qui t'a fait dire bof ?", answer: "Il y avait des blancs." });
    // Re-entering the answer step for the same dimension cannot request a second follow-up.
    const replay: FlowState = { ...state, step: "answer" };
    expect(canRequestFollowUp(replay)).toBe(false);
    expect(submitAnswer(replay, "Encore bof.").step).toBe("score");
  });

  it("goes straight to the score when the follow-up fails (null)", () => {
    const state = applyFollowUp(submitAnswer(startFlow(questions), "Très fluide, je dirais 4."), null);
    expect(state.step).toBe("score");
    expect(state.dimensions.fluidity.follow_up).toBeNull();
    expect(state.proposedScore).toBe(4);
  });

  it("keeps « not rated » (null) distinct from any score and never defaults", () => {
    let state = startFlow(questions);
    for (const key of CONVERSATIONAL_DIMENSIONS) expect(state.dimensions[key].score).toBeNull();
    state = runDimension(state, "Je ne sais pas trop.", null);
    expect(state.dimensions.fluidity.score).toBeNull();
    expect(state.dimensions.fluidity.score_source).toBeNull();
    expect(state.dimensions.fluidity.score).not.toBe(0);
    state = runDimension(state, "Intéressant au début.", 1);
    expect(state.dimensions.interest.score).toBe(1);
  });

  it("confirms a spoken score only for the score heard; otherwise it is a touch", () => {
    const scoring = applyFollowUp(submitAnswer(startFlow(questions), "Franchement 3 sur 5."), null);
    expect(scoring.proposedScore).toBe(3);
    expect(confirmScore(scoring, 3, "voice_confirmed").dimensions.fluidity.score_source).toBe("voice_confirmed");
    expect(confirmScore(scoring, 5, "voice_confirmed").dimensions.fluidity.score_source).toBe("touch");
  });

  it("detects spoken scores without inventing one", () => {
    expect(detectSpokenScore("je dirais 4")).toBe(4);
    expect(detectSpokenScore("Je mettrais cinq")).toBe(5);
    expect(detectSpokenScore("2/5")).toBe(2);
    expect(detectSpokenScore("trois sur cinq")).toBe(3);
    expect(detectSpokenScore("j’ai parlé 4 minutes avec Max")).toBeNull();
    expect(detectSpokenScore("je dirais 7")).toBeNull();
    expect(detectSpokenScore("c'était bien")).toBeNull();
  });

  it("builds a valid provisional payload with a raw summary", () => {
    let state = startFlow(questions);
    const scores = [4, null, 3, 5, 2] as const;
    for (const score of scores) state = runDimension(state, "Réponse.", score);
    const data = buildProvisionalQuestionnaire(state, context, new Date("2026-11-08T12:00:00Z"));
    expect(validateConversationalQuestionnaire(data)).toEqual([]);
    expect(data.summary).toEqual({ text: rawSummary(state), edited_by_user: false, validated_at: "2026-11-08T12:00:00.000Z" });
    expect(data.summary.text).toContain("Intérêt — non évalué");
    expect(data.session_context).toBe(context);
  });

  it("never turns session context into a question", () => {
    const texts = Object.values(questions).join(" ").toLowerCase();
    for (const forbidden of ["film", "smartphone", "latence", "durée", "minutes", "avatar", "mains libres", "micro"]) {
      expect(texts).not.toContain(forbidden);
    }
  });
});

describe("questionnaire mode setting", () => {
  it("falls back to the PRD4 form unless conversational is chosen explicitly", () => {
    expect(getGameplaySettings().QUESTIONNAIRE_MODE).toBe("prd4");
    expect(normalizeQuestionnaireMode(undefined)).toBe("prd4");
    expect(normalizeQuestionnaireMode("anything")).toBe("prd4");
    expect(normalizeQuestionnaireMode(true)).toBe("prd4");
    expect(normalizeQuestionnaireMode("conversational")).toBe("conversational");
  });
});
