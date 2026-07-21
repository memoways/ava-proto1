import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
  streamLLM: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null })),
        ilike: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null })),
          limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })),
        })),
      })),
    })),
  },
}));
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getLLMSettings: vi.fn(() => ({
    LLM_MODEL: "openai/gpt-4.1-mini",
    LLM_TEMPERATURE: 0.7,
    LLM_MAX_TOKENS: 120,
    LLM_TOP_P: 0.9,
  })),
  getAntiHallucinationValidatorSettings: vi.fn(),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/characterPromptService", () => ({
  buildCharacterPromptSections: vi.fn(),
  loadCharacterPromptByName: vi.fn(),
  clearCharacterPromptCache: vi.fn(),
}));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { buildCharacterPromptSections, loadCharacterPromptByName } from "@/services/characterPromptService";
import { buildGmGuidanceBlock, buildTemporalContextBlock, simulateMaxResponse } from "./maxAgent";

describe("buildTemporalContextBlock — repères temporels de Max", () => {
  it("décrit le début d'appel sous 25% de la durée", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 45,
      sessionDurationSeconds: 600,
      turnIndex: 1,
    });
    expect(block).toContain("moins d'une minute");
    expect(block).toContain("1e tour de parole");
    expect(block).toContain("Début de l'appel");
    expect(block).toContain("ne jamais citer ces chiffres");
  });

  it("décrit le milieu d'appel entre 25% et 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 300,
      sessionDurationSeconds: 600,
      turnIndex: 7,
    });
    expect(block).toContain("environ 5 minutes");
    expect(block).toContain("Milieu de l'appel");
  });

  it("annonce la fin d'appel au-delà de 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 550,
      sessionDurationSeconds: 600,
      turnIndex: 14,
    });
    expect(block).toContain("approche de sa fin");
  });

  it("reste borné avec des entrées dégénérées", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: -10,
      sessionDurationSeconds: 0,
      turnIndex: 1,
    });
    expect(block).toContain("moins d'une minute");
    expect(block).toContain("Début de l'appel");
  });
});

describe("buildGmGuidanceBlock — boucle GM→Max", () => {
  it("injecte la guidance comme note interne avec rappel de priorité de la fiche", () => {
    const block = buildGmGuidanceBlock({ guidance: "Laisse un silence, puis évoque Emma." });
    expect(block).toContain("CONSEIL DE MISE EN SCÈNE");
    expect(block).toContain("Laisse un silence, puis évoque Emma.");
    expect(block).toContain("fiche personnage reste prioritaire");
  });

  it("liste les sujets déjà couverts, plafonnés à 12", () => {
    const topics = Array.from({ length: 15 }, (_, i) => `sujet-${i + 1}`);
    const block = buildGmGuidanceBlock({ guidance: "Continue.", topicsCovered: topics });
    expect(block).toContain("sujet-1");
    expect(block).toContain("sujet-12");
    expect(block).not.toContain("sujet-13");
  });

  it("ignore les sujets vides et n'ajoute pas la ligne quand il n'y en a aucun", () => {
    const block = buildGmGuidanceBlock({ guidance: "Continue.", topicsCovered: ["", "  "] });
    expect(block).not.toContain("Sujets déjà abordés");
  });
});

describe("assemblage traçable du prompt de Max", () => {
  it("expose exactement le même system prompt que celui envoyé dans le payload", async () => {
    vi.mocked(loadCharacterPromptByName).mockResolvedValue({
      character_id: "max-id",
      name: "Max",
      updated_at: "2026-07-21T00:00:00Z",
    } as never);
    vi.mocked(buildCharacterPromptSections).mockReturnValue("TON: réservé\nOBJECTIF: parler d'Ava");
    vi.mocked(callLLMWithUsage).mockResolvedValue({
      content: "Je préfère rester prudent.",
      usage: { prompt_tokens: 42, completion_tokens: 6, total_tokens: 48 },
      generationId: "generation-1",
      model: "openai/gpt-4.1-mini",
      latencyMs: 120,
      diagnosticTrace: null,
    });

    const result = await simulateMaxResponse({
      conversationHistory: [{ role: "max", content: "Je vous écoute.", timestamp: 1 }],
      userMessage: "Parlez-moi d'Ava.",
      ragContext: "[1] Ava vivait à Lausanne.",
      sessionSummary: "Le joueur cherche Ava.",
      userRoleSummary: "Le joueur est journaliste.",
      temporalContext: { timeElapsedSeconds: 60, sessionDurationSeconds: 600, turnIndex: 2 },
      gmGuidance: { guidance: "Reste prudent.", topicsCovered: ["Ava"] },
    }, { diagnosticTrace: true });

    expect(result.promptTrace?.finalSystemPrompt).toBe(result.systemPrompt);
    expect(result.messages?.[0]).toEqual({ role: "system", content: result.promptTrace?.finalSystemPrompt });
    expect(result.promptTrace?.injectedSections.map((section) => section.key)).toEqual([
      "character_fields",
      "user_role",
      "temporal_context",
      "session_summary",
      "gm_guidance",
      "rag_context",
    ]);
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][0]).toEqual(result.messages);
  });
});
