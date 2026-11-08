import { describe, expect, it } from "vitest";
import type { ConversationMessage, QuestionnaireConversationalData } from "@/types";
import {
  baseDimensionQuestions,
  buildSessionContext,
  CONVERSATIONAL_DIMENSIONS,
  emptyDimensionAnswer,
  normalizeScore,
  radarScores,
  validateConversationalQuestionnaire,
  type SessionContextInput,
} from "./conversationalQuestionnaire";

const msg = (role: ConversationMessage["role"], content: string, extra: Partial<ConversationMessage> = {}): ConversationMessage =>
  ({ role, content, timestamp: 1, ...extra });

function input(overrides: Partial<SessionContextInput> = {}): SessionContextInput {
  return {
    sessionId: "session-1",
    film: "vu",
    teaserSeen: true,
    teaserSkipped: false,
    startingCharacter: "max",
    conversation: [],
    watchedVideos: [],
    durationSeconds: 300,
    turnLatenciesMs: [],
    micErrors: 0,
    handsFree: false,
    endReason: "timer",
    deviceClass: "desktop",
    callMode: "streaming_avatar",
    avatarFallback: false,
    roleProfile: null,
    posture: null,
    ...overrides,
  };
}

function questionnaire(scores: Partial<Record<string, unknown>> = {}): QuestionnaireConversationalData {
  const dimensions = Object.fromEntries(CONVERSATIONAL_DIMENSIONS.map((key) => {
    const score = key in scores ? scores[key] : null;
    return [key, { ...emptyDimensionAnswer(`Question ${key}`), answer: "réponse", score, score_source: score == null ? null : "touch" }];
  })) as QuestionnaireConversationalData["dimensions"];
  return {
    version: "conversational-v1",
    submitted_at: "2026-11-08T10:00:00.000Z",
    dimensions,
    summary: { text: "Synthèse", edited_by_user: false, validated_at: "2026-11-08T10:00:00.000Z" },
    consent: { transcript_storage: true, opt_in_updates: false, opt_in_feedback: false },
    session_context: buildSessionContext(input()),
  };
}

describe("buildSessionContext", () => {
  it("reprend les personnages réellement entendus et les passages Max ↔ Emma depuis le journal", () => {
    const context = buildSessionContext(input({
      conversation: [
        msg("max", "Salut."),
        msg("user", "Passe-moi Emma", { spokenWith: "max" }),
        msg("emma", "C'est Emma.", { callTransfer: { from: "max", returning: false } }),
        msg("user", "Retour à Max", { spokenWith: "emma" }),
        msg("max", "Re.", { callTransfer: { from: "emma", returning: true } }),
      ],
    }));
    expect(context.characters_called).toEqual(["max", "emma"]);
    expect(context.handoffs).toEqual([
      { from: "max", to: "emma", returning: false },
      { from: "emma", to: "max", returning: true },
    ]);
    expect(context.turn_count).toBe(2);
    expect(context.transcript_available).toBe(true);
  });

  it("ignore une réplique vide : un personnage qui n'a rien dit n'est pas compté comme appelé", () => {
    const context = buildSessionContext(input({ conversation: [msg("max", "Bonjour"), msg("emma", "   ")] }));
    expect(context.characters_called).toEqual(["max"]);
    expect(context.handoffs).toEqual([]);
  });

  it("calcule les latences en écartant les valeurs invalides et garde null sans mesure", () => {
    expect(buildSessionContext(input({ turnLatenciesMs: [1000, 2001, Number.NaN, -5] }))).toMatchObject({
      avg_latency_ms: 1501, max_latency_ms: 2001,
    });
    expect(buildSessionContext(input())).toMatchObject({ avg_latency_ms: null, max_latency_ms: null });
  });

  it("reprend film, teaser, appareil, mode d'appel, repli avatar, mains libres et raison de fin", () => {
    const context = buildSessionContext(input({
      film: "pas_vu", teaserSeen: true, teaserSkipped: true, deviceClass: "smartphone", callMode: "tts",
      avatarFallback: false, handsFree: true, endReason: "user_ended", micErrors: 2,
      watchedVideos: [{ id: "v1", partial: true }, { id: "v1", partial: false }, { id: "v2", partial: false }],
    }));
    expect(context).toMatchObject({
      film: "pas_vu", teaser: { seen: true, skipped: true }, device_class: "smartphone", call_mode: "tts",
      hands_free: true, end_reason: "user_ended", mic_errors: 2,
      cinematics: [{ id: "v1", partial: false }, { id: "v2", partial: false }],
    });
  });
});

describe("questions de base", () => {
  it("ne demandent jamais ce que la session connaît déjà", () => {
    const questions = Object.values(baseDimensionQuestions({ characters_called: ["max", "emma"] })).join(" ").toLowerCase();
    for (const known of ["film", "teaser", "appareil", "téléphone", "tablette", "ordinateur", "durée", "minute", "latence",
      "combien", "avatar", "micro", "vidéo"]) {
      expect(questions).not.toContain(known);
    }
  });

  it("nomment seulement les personnages réellement appelés", () => {
    expect(baseDimensionQuestions({ characters_called: ["max"] }).character_credibility).toContain("Max crédible,");
    expect(baseDimensionQuestions({ characters_called: ["max", "emma"] }).character_credibility).toContain("Max et Emma crédibles");
  });
});

describe("non évalué ≠ 0", () => {
  it("normalise seulement un entier 1–5 ; 0 et le reste deviennent null", () => {
    expect([1, 2, 3, 4, 5].map(normalizeScore)).toEqual([1, 2, 3, 4, 5]);
    expect([0, 6, 2.5, "3", undefined, null, Number.NaN].map(normalizeScore)).toEqual([null, null, null, null, null, null, null]);
  });

  it("refuse un score 0 au lieu de le stocker", () => {
    expect(validateConversationalQuestionnaire(questionnaire({ fluidity: 0 }))).toContain("dimensions.fluidity.score");
  });

  it("accepte des dimensions non évaluées et les met à part dans le radar", () => {
    const data = questionnaire({ fluidity: 4, immersion: 2 });
    expect(validateConversationalQuestionnaire(data)).toEqual([]);
    expect(radarScores(data)).toEqual({
      rated: { fluidity: 4, immersion: 2 },
      notRated: ["interest", "character_credibility", "emotional_engagement"],
    });
  });

  it("exige une source de note cohérente", () => {
    const data = questionnaire({ fluidity: 4 });
    data.dimensions.fluidity.score_source = null;
    expect(validateConversationalQuestionnaire(data)).toContain("dimensions.fluidity.score_source");
  });
});
