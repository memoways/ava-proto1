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
  getGameplaySettings: vi.fn(() => ({ MAX_PROMPT_VARIANT: "compact_v1" })),
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
    expect(block).toContain("tour 1");
    expect(block).toContain("début");
    expect(block).toContain("ne cite jamais ces repères");
    expect(block.length).toBeLessThanOrEqual(260);
  });

  it("décrit le milieu d'appel entre 25% et 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 300,
      sessionDurationSeconds: 600,
      turnIndex: 7,
    });
    expect(block).toContain("environ 5 minutes");
    expect(block).toContain("milieu");
  });

  it("annonce la fin d'appel au-delà de 75%", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: 550,
      sessionDurationSeconds: 600,
      turnIndex: 14,
    });
    expect(block).toContain("fin proche");
  });

  it("reste borné avec des entrées dégénérées", () => {
    const block = buildTemporalContextBlock({
      timeElapsedSeconds: -10,
      sessionDurationSeconds: 0,
      turnIndex: 1,
    });
    expect(block).toContain("moins d'une minute");
    expect(block).toContain("début");
  });
});

describe("buildGmGuidanceBlock — boucle GM→Max", () => {
  it("conserve la guidance sans répéter les règles déjà présentes dans le noyau", () => {
    const block = buildGmGuidanceBlock({ guidance: "Laisse un silence, puis évoque Emma." });
    expect(block).toBe("Laisse un silence, puis évoque Emma.");
  });

  it("liste les sujets déjà couverts, plafonnés à 6", () => {
    const topics = Array.from({ length: 15 }, (_, i) => `sujet-${i + 1}`);
    const block = buildGmGuidanceBlock({ guidance: "Continue.", topicsCovered: topics });
    expect(block).toContain("sujet-1");
    expect(block).toContain("sujet-6");
    expect(block).not.toContain("sujet-7");
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
      situation_summary: "Max attend à Lausanne.",
      timeline: "Hier, la famille est rentrée.",
      identite_fondamentale: "Père et journaliste.",
      qui_tu_es: "Posé mais sous tension.",
      ce_que_tu_ne_fais_jamais: "Ne pas inventer.",
      ce_que_tu_sais_utilisateur: "Un inconnu appelle.",
      dynamique_conversation: "Répondre directement.",
      sujets_sensibles: "Emma et Mona.",
      profondeur_par_niveau: "NIVEAU 1\nAnalytique.\nNIVEAU 2\nPremières fissures.",
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
      "temporal_context",
      "user_role",
      "session_summary",
      "gm_guidance",
      "rag_context",
    ]);
    expect(result.promptTrace?.baseSource.kind).toBe("compiled");
    expect(result.promptTrace?.budget?.variant).toBe("compact_v1");
    expect(result.promptTrace?.budget?.withinBudget).toBe(true);
    expect(result.systemPrompt.length).toBeLessThanOrEqual(12_000);
    expect(result.promptTrace?.budget?.sections.reduce((sum, section) => sum + section.chars, 0)).toBe(result.systemPrompt.length);
    expect(vi.mocked(callLLMWithUsage).mock.calls[0][0]).toEqual(result.messages);
  });
});
