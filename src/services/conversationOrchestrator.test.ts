import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock LLM + settings BEFORE importing modules
vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  streamLLM: vi.fn(),
}));

const emptyKnowledge = {
  allowedFacts: [],
  activeMemories: [],
  hypotheses: [],
  forbiddenTopics: [],
  blockedAssertions: [],
};

vi.mock("@/services/ragService", () => ({
  queryRAG: vi.fn().mockResolvedValue([]),
  rewriteRAGQuery: vi.fn().mockResolvedValue(null),
  formatRAGContext: vi.fn().mockReturnValue(""),
  buildKnowledgeContextFromRAG: vi.fn(() => ({ ...emptyKnowledge })),
}));

vi.mock("@/agents/gameMasterAgent", () => ({
  callGameMaster: vi.fn().mockResolvedValue({
    trust_delta: 0,
    trigger_video_id: null,
    game_over: false,
    game_over_reason: null,
    gate_reached: false,
    moderation_flag: false,
  }),
}));

vi.mock("@/services/debugLogger", () => ({
  debugLogger: { log: vi.fn(), logError: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({}) }),
    }),
  },
}));

import { callLLM } from "@/services/openRouterLLM";
import { callGameMaster } from "@/agents/gameMasterAgent";
import { queryRAG, rewriteRAGQuery } from "@/services/ragService";
import * as maxAgent from "@/agents/maxAgent";
import { processConversationTurn } from "@/services/conversationOrchestrator";

describe("conversationOrchestrator — anti-hallucination", () => {
  beforeEach(() => {
    vi.mocked(callLLM).mockReset();
    vi.mocked(queryRAG).mockResolvedValue([]);
    vi.mocked(rewriteRAGQuery).mockResolvedValue(null);
    vi.mocked(callGameMaster).mockResolvedValue({
      trust_delta: 0,
      trigger_video_id: null,
      game_over: false,
      game_over_reason: null,
      gate_reached: false,
      moderation_flag: false,
      notes: "",
    });
    localStorage.clear();
    // Active explicitement le validateur en mode enforce pour ces tests
    // (le défaut produit est "off" pour ne pas parasiter la conversation live).
    localStorage.setItem(
      "ava_anti_hallucination_validator_settings",
      JSON.stringify({ mode: "enforce", authorizedFacts: "", blockedAssertionRules: "" }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("retourne la réponse Max telle quelle si la validation passe", async () => {
    vi.spyOn(maxAgent, "simulateMaxResponse").mockResolvedValue({
      response: "Je ne sais pas grand chose, mais je l'écoute.",
      systemPrompt: "system",
    });
    vi.spyOn(maxAgent, "validateMaxResponseConstraints").mockResolvedValue({
      compliant: true,
      summary: "ok",
      violations: [],
      safe_points: ["aucun fait inventé"],
    });

    // GM pre-turn LLM response (planner) + GM post-turn (background)
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
      response_mode: "ferme_mefiant", openness_level: 1, emotional_state: "tendu",
      conversation_goal: "tester", reveal_budget: 0,
      allowed_knowledge: [], forbidden_topics: [], blocked_assertions: [],
      style_instructions: ["bref"], trigger_hint: null, notes: "",
      trust_delta: 0, trigger_video_id: null, game_over: false,
      game_over_reason: null, gate_reached: false, moderation_flag: false,
    }));

    const result = await processConversationTurn(
      "Bonjour Max", [], 0, [], 0, "", undefined, undefined,
    );

    expect(result.maxResponse).toContain("Je ne sais pas");
    expect(result.validation.finalStatus).toBe("passed");
    expect(result.validation.attempts).toBe(1);
    expect(result.validation.regenerated).toBe(false);
    await expect(result.gameMasterPromise).resolves.toMatchObject({ trigger: null });
  });

  it("régénère puis tombe en fallback si la validation échoue 2 fois", async () => {
    const sim = vi.spyOn(maxAgent, "simulateMaxResponse").mockResolvedValue({
      response: "Ava est partie en Italie le 12 mars.",
      systemPrompt: "system",
    });
    vi.spyOn(maxAgent, "validateMaxResponseConstraints").mockResolvedValue({
      compliant: false,
      summary: "fait inventé",
      violations: ["lieu/date non sourcés"],
      safe_points: [],
    });

    vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
      response_mode: "ferme_mefiant", openness_level: 0, emotional_state: "tendu",
      conversation_goal: "", reveal_budget: 0,
      allowed_knowledge: [], forbidden_topics: [], blocked_assertions: [],
      style_instructions: [], trigger_hint: null, notes: "",
    }));

    const result = await processConversationTurn(
      "Où est Ava ?", [], 0, [], 0, "", undefined, undefined,
    );

    expect(sim).toHaveBeenCalledTimes(2); // initial + 1 retry
    expect(result.validation.finalStatus).toBe("fallback");
    expect(result.validation.regenerated).toBe(true);
    expect(result.maxResponse).toMatch(/prudent|certitude|sais/i);
    // Trace persistée
    const trace = localStorage.getItem("ava_pipeline_last_trace");
    expect(trace).toBeTruthy();
    expect(JSON.parse(trace!).validation.finalStatus).toBe("fallback");
    await expect(result.gameMasterPromise).resolves.toMatchObject({ trigger: null });
  });
});
