import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { update?: unknown; eq?: unknown[]; is?: unknown[] } = {};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (value: unknown) => {
        calls.update = value;
        return {
          eq: (...eq: unknown[]) => {
            calls.eq = eq;
            return { is: async (...is: unknown[]) => { calls.is = is; return { error: null }; } };
          },
        };
      },
    })),
  },
}));
vi.mock("@/services/posthogService", () => ({ trackEvent: vi.fn() }));
vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));

import { saveConversationalQuestionnaire } from "./prd4Questionnaire";
import { buildSessionContext, CONVERSATIONAL_DIMENSIONS, emptyDimensionAnswer } from "./conversationalQuestionnaire";
import type { QuestionnaireConversationalData } from "@/types";

function data(score: unknown): QuestionnaireConversationalData {
  const dimensions = Object.fromEntries(CONVERSATIONAL_DIMENSIONS.map((key) => [key, emptyDimensionAnswer(key)])) as
    QuestionnaireConversationalData["dimensions"];
  dimensions.fluidity = { ...dimensions.fluidity, score: score as 1, score_source: score == null ? null : "touch" };
  return {
    version: "conversational-v1", submitted_at: "2026-11-08T00:00:00.000Z", dimensions,
    summary: { text: "", edited_by_user: false, validated_at: "2026-11-08T00:00:00.000Z" },
    consent: { transcript_storage: true, opt_in_updates: false, opt_in_feedback: false },
    session_context: buildSessionContext({ sessionId: "s1", film: null, teaserSeen: false, teaserSkipped: false,
      startingCharacter: "max", conversation: [], watchedVideos: [], durationSeconds: 0, turnLatenciesMs: [], micErrors: 0,
      handsFree: false, endReason: null, deviceClass: "desktop", callMode: "tts", avatarFallback: false, roleProfile: null, posture: null }),
  };
}

describe("saveConversationalQuestionnaire", () => {
  beforeEach(() => { delete calls.update; delete calls.eq; delete calls.is; });

  it("écrit seulement si la session n'a pas encore de questionnaire (PRD4/legacy jamais écrasé)", async () => {
    await expect(saveConversationalQuestionnaire("s1", data(null))).resolves.toEqual({ saved: true });
    expect(calls.eq).toEqual(["id", "s1"]);
    expect(calls.is).toEqual(["questionnaire_responses", null]);
    const stored = (calls.update as { questionnaire_responses: QuestionnaireConversationalData }).questionnaire_responses;
    expect(stored.version).toBe("conversational-v1");
    expect(stored.dimensions.fluidity.score).toBeNull();
  });

  it("n'écrit rien quand une note vaut 0", async () => {
    const result = await saveConversationalQuestionnaire("s1", data(0));
    expect(result).toMatchObject({ saved: false, reason: "invalid" });
    expect(calls.update).toBeUndefined();
  });
});
