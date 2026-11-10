/**
 * Post-turn GM output read on real (anonymised) sandbox outputs, J3 measure of
 * 10 November 2026: every unreadable output was an indented, fenced object cut
 * by the 950-token budget while echoing the prior memory as objects.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "google/gemini-2.5-flash", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn() }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { evaluatePostTurnPRD4 } from "./gameMasterPRD4";
import { createEmptyConversationMemory } from "@/services/conversationMemoryV1";
import { describeUnreadableGmOutput, extractGmJson } from "./gmJsonOutput";
import { GM_MIN_MAX_TOKENS, GM_RUNTIME_OUTPUT_INSTRUCTIONS } from "@/services/gameMasterContract";

/** Head and tail of a real truncated output (ids and policy version anonymised). */
const REAL_TRUNCATED = `\`\`\`json
{
  "labels": {
    "themes": [],
    "topics": [
      "chevreuil",
      "couteau"
    ],
    "intentions": [
      "question"
    ]
  },
  "engagement_delta": 0,
  "confusion_detected": false,
  "role_usage_quality": "high",
  "topics_covered": [
    "chevreuil",
    "couteau"
  ],
  "transition_recommended": false,
  "cinematic_hint": null,
  "next_turn_guidance": "Max doit continuer à parler de ce qui le ronge, sans inventer de faits non canoniques.",
  "next_speech_state": "La digue cède",
  "end_recommended": false,
  "moderation_flag": false,
  "notes": "Le joueur introduit un élément non canonique ; Max recadre.",
  "trigger_video_id": null,
  "action": {
    "type": "none"
  },
  "player_switch_request": null,
  "memory_delta": {
    "interlocutor": {
      "name": null,
      "role": null,
      "traits": []
    },
    "userFacts": [],
    "maxDisclosures": [
      "Max ne se souvient pas d'un chevreuil devant le chalet le premier soir."
    ],
    "commitments": [],
    "openThreads": [
      {
        "id": "max_thread_a1",
        "text": "arrivée au chalet",
        "sourceTurn": 2
      },
      {
        "id": "max_thread_a2",
        "text": "sentiment d'impuissance",
        "sourceTurn": 2
      }
    ],
    "resolvedThreadIds": [],
    "topics": [
      {
        "id": "max_topic_b1",
        "text": "retour d'Ava",
        "sourceTurn": 1
      },
      {
        "id": "max`;

/** The same decision in the compact form now required, echo of the memory removed. */
const REAL_COMPACT = JSON.stringify({
  labels: { themes: [], topics: ["chevreuil", "couteau"], intentions: ["question"] },
  engagement_delta: 0, confusion_detected: false, role_usage_quality: "high", topics_covered: ["chevreuil", "couteau"],
  transition_recommended: false, cinematic_hint: null,
  next_turn_guidance: "Max doit continuer à parler de ce qui le ronge, sans inventer de faits non canoniques.",
  next_speech_state: null, end_recommended: false, moderation_flag: false,
  notes: "Le joueur introduit un élément non canonique ; Max recadre.", trigger_video_id: null,
  action: { type: "none" }, player_switch_request: null,
  memory_delta: {
    interlocutor: { name: null, role: null, traits: [] }, userFacts: [],
    maxDisclosures: ["Max ne se souvient pas d'un chevreuil devant le chalet le premier soir."],
    commitments: [], openThreads: ["homme ligoté"], resolvedThreadIds: [], topics: ["chevreuil"],
    lastExchange: "Le joueur évoque un chevreuil ; Max dit ne pas s'en souvenir.",
  },
});

const input = {
  sessionId: null, conversationHistory: [], userMessage: "Et le chevreuil devant le chalet ?",
  maxResponse: "Je ne m'en souviens pas.", currentCharacter: "max" as const, userRole: null,
  turnIndex: 4, timeElapsedSeconds: 180, sessionDurationSeconds: 900, minimumClosureSeconds: 600,
};
const usage = (completion_tokens: number) => ({ prompt_tokens: 5200, completion_tokens, total_tokens: 5200 + completion_tokens });
const metadata = { generationId: "gen", model: "google/gemini-2.5-flash", latencyMs: 4000, diagnosticTrace: null };

describe("GM post-turn output — real sandbox outputs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifies the real truncated output as cut by the budget, without keeping its text", () => {
    expect(extractGmJson(REAL_TRUNCATED)).toBeUndefined();
    const diagnostic = describeUnreadableGmOutput(REAL_TRUNCATED, "length", 936);
    expect(diagnostic).toEqual({ output_shape: "truncated", finish_reason: "length", output_chars: REAL_TRUNCATED.length, completion_tokens: 936 });
    expect(JSON.stringify(diagnostic)).not.toMatch(/chevreuil|chalet/);
  });

  it("records the bounded shape on an invalid post-turn and keeps the game neutral", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...metadata, content: REAL_TRUNCATED, finishReason: "length", usage: usage(936) });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.execution_status).toBe("invalid");
    expect(result.execution_reason).toBe("invalid_json");
    expect(result.validation_issues).toEqual([{ code: "json_unreadable", output_shape: "truncated", finish_reason: "length", output_chars: REAL_TRUNCATED.length, completion_tokens: 936 }]);
    expect(result.memory_delta).toBeNull();
    expect(result.action).toEqual({ type: "none" });
    expect(JSON.stringify(result)).not.toMatch(/chevreuil devant/);
  });

  it("asks for a compact object without memory echo and keeps budget headroom", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...metadata, content: REAL_COMPACT, finishReason: "stop", usage: usage(520) });
    const result = await evaluatePostTurnPRD4(input);
    const [messages, options] = vi.mocked(callLLMWithUsage).mock.calls[0];
    expect(options).toMatchObject({ max_tokens: GM_MIN_MAX_TOKENS });
    expect(GM_MIN_MAX_TOKENS).toBeGreaterThanOrEqual(1600);
    expect(messages[0].content).toContain(GM_RUNTIME_OUTPUT_INSTRUCTIONS);
    expect(GM_RUNTIME_OUTPUT_INSTRUCTIONS).toMatch(/compact sur une seule ligne/);
    expect(GM_RUNTIME_OUTPUT_INSTRUCTIONS).toMatch(/jamais une copie de la mémoire/);
    expect(result.execution_status).toBe("executed");
    expect(result.next_turn_guidance).toContain("Max doit continuer");
    expect(result.memory_delta?.openThreads).toEqual(["homme ligoté"]);
    expect(result.max_tokens).toBe(GM_MIN_MAX_TOKENS);
  });

  it("shows prior memory items as id — text strings, never as objects to echo", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...metadata, content: REAL_COMPACT, finishReason: "stop", usage: usage(520) });
    const before = { ...createEmptyConversationMemory(), lastTurn: 3,
      openThreads: [{ id: "max_thread_a1", text: "arrivée au chalet", sourceTurn: 2 }],
      topics: [{ id: "max_topic_b1", text: "retour d'Ava", sourceTurn: 1 }] };
    await evaluatePostTurnPRD4({ ...input, conversationMemoryBefore: before });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    const section = prompt.slice(prompt.indexOf("## MÉMOIRE AVANT LE TOUR"));
    expect(section).toContain('"openThreads":["max_thread_a1 — arrivée au chalet"]');
    expect(section).toContain('"topics":["max_topic_b1 — retour d\'Ava"]');
    expect(section.split("\n")[1]).not.toContain('"sourceTurn":2');
  });

  it("drops echoed memory objects rather than storing them", async () => {
    const echoed = JSON.parse(REAL_COMPACT);
    echoed.memory_delta.openThreads = [{ id: "max_thread_a1", text: "arrivée au chalet", sourceTurn: 2 }, "homme ligoté"];
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ ...metadata, content: JSON.stringify(echoed), finishReason: "stop", usage: usage(600) });
    const result = await evaluatePostTurnPRD4(input);
    expect(result.memory_delta?.openThreads).toEqual(["homme ligoté"]);
  });
});
