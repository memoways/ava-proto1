import { describe, expect, it, vi } from "vitest";
import type { ConversationalSessionContext } from "@/types";
import {
  buildFollowUpMessages,
  describeContextForFollowUp,
  parseFollowUpResponse,
  requestFollowUp,
  sanitizeFollowUp,
  type FollowUpRequest,
} from "./conversationalFollowUp";
import { DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT, getQuestionnaireFollowUpSettings } from "./settingsService";

const context: ConversationalSessionContext = {
  session_id: "s1",
  film: "vu",
  teaser: { seen: true, skipped: false },
  starting_character: "max",
  characters_called: ["max"],
  handoffs: [],
  cinematics: [],
  duration_seconds: 312,
  turn_count: 9,
  avg_latency_ms: 2412,
  max_latency_ms: 6123,
  mic_errors: 2,
  hands_free: false,
  end_reason: "timer",
  device_class: "tablet",
  call_mode: "streaming_avatar",
  avatar_fallback: true,
  role_profile: null,
  posture: null,
  transcript_available: true,
};

const request: FollowUpRequest = {
  dimension: "fluidity",
  question: "Le déroulé : qu'est-ce qui a bien fonctionné ?",
  answer: "Bof, ça accrochait.",
  context,
};

describe("conversational follow-up", () => {
  it("gives the model qualitative context only, never measurements", () => {
    const facts = describeContextForFollowUp(context).join(" ");
    expect(facts).toContain("tablette");
    expect(facts).toContain("passé en voix seule");
    expect(facts).not.toMatch(/\d/);
    const [system, user] = buildFollowUpMessages("PROMPT", request);
    expect(system).toEqual({ role: "system", content: "PROMPT" });
    expect(user.content).toContain("Bof, ça accrochait.");
    expect(user.content).not.toMatch(/2412|6123|312|latence/i);
  });

  it("rejects follow-ups that cite a measurement or are not a single question", () => {
    expect(sanitizeFollowUp("Qu'est-ce qui accrochait, exactement ?")).toBe("Qu'est-ce qui accrochait, exactement ?");
    expect(sanitizeFollowUp("On a mesuré des latences, tu les as senties ?")).toBeNull();
    expect(sanitizeFollowUp("Les réponses prenaient 6 secondes, c'était gênant ?")).toBeNull();
    expect(sanitizeFollowUp("Tu as eu des erreurs micro ?")).toBeNull();
    expect(sanitizeFollowUp("Merci pour ta réponse.")).toBeNull();
    expect(sanitizeFollowUp(`${"Pourquoi ".repeat(40)}?`)).toBeNull();
    expect(sanitizeFollowUp(42)).toBeNull();
  });

  it("parses the JSON answer, including an explicit null", () => {
    expect(parseFollowUpResponse('{"follow_up": "Qu\'est-ce qui accrochait ?"}')).toBe("Qu'est-ce qui accrochait ?");
    expect(parseFollowUpResponse('```json\n{"follow_up": null}\n```')).toBeNull();
    expect(parseFollowUpResponse("Pas du JSON")).toBeNull();
  });

  it("returns no follow-up when proxy-llm fails or times out", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("timeout"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(requestFollowUp(request, { llm: failing, prompt: "P", timeoutMs: 10 })).resolves.toBeNull();
    expect(failing).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("does not call the model for an empty answer", async () => {
    const llm = vi.fn();
    await expect(requestFollowUp({ ...request, answer: "  " }, { llm, prompt: "P", timeoutMs: 10 })).resolves.toBeNull();
    expect(llm).not.toHaveBeenCalled();
  });

  it("passes the timeout and returns the sanitized question", async () => {
    const llm = vi.fn().mockResolvedValue('{"follow_up": "Qu\'est-ce qui accrochait ?"}');
    await expect(requestFollowUp(request, { llm, prompt: "P", timeoutMs: 4000, model: "m" })).resolves.toBe("Qu'est-ce qui accrochait ?");
    expect(llm.mock.calls[0][1]).toMatchObject({ timeoutMs: 4000, model: "m" });
  });

  it("ships an editorial default prompt that forbids citing measurements", () => {
    expect(getQuestionnaireFollowUpSettings().prompt).toBe(DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT);
    expect(DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT).toMatch(/ne cite jamais une mesure/);
    expect(DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT).toMatch(/ne suggère aucune réponse/);
  });
});
