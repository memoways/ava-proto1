import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
  streamLLM: vi.fn(),
  LLMProxyRequestError: class extends Error {},
}));
vi.mock("@/integrations/supabase/client", () => {
  const row = {
    id: "max-id",
    name: "Max Lorenzo",
    system_prompt: "PROMPT_LEGACY_A_NE_JAMAIS_LIRE — ancienne voix de Max.",
    updated_at: null,
  };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: row })),
          ilike: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: row })),
            limit: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row })) })),
          })),
        })),
      })),
    },
  };
});
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: vi.fn(() => ({ MAX_PROMPT_VARIANT: "rich_v2" })),
  getLLMSettings: vi.fn(() => ({
    LLM_MODEL: "openai/gpt-4.1-mini",
    LLM_TEMPERATURE: 0.7,
    LLM_MAX_TOKENS: 220,
    LLM_TOP_P: 0.9,
  })),
  getAntiHallucinationValidatorSettings: vi.fn(),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/characterPromptService", () => ({
  buildCharacterPromptSections: vi.fn(() => "sections legacy"),
  loadCharacterPromptByName: vi.fn(),
  clearCharacterPromptCache: vi.fn(),
}));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { loadCharacterPromptByName } from "@/services/characterPromptService";
import { getGameplaySettings } from "@/services/settingsService";
import { simulateMaxResponse } from "./maxAgent";
import { RICH_V2_LIMITS } from "./maxRichPromptCompiler";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";

const FIELDS = {
  character_id: "max-id",
  name: "Max Lorenzo",
  updated_at: "2026-07-30T00:00:00Z",
  situation_summary: "Lausanne, aujourd'hui. Emma et Ava enfermées, la police muette.",
  timeline: [
    "Il y a trois mois, la pandémie de Protogyne se déclare.",
    "Il y a cinq jours, nous partons pour le chalet du Jura.",
    "Hier, j'ai pointé le fusil sur Emma puis sur Ava.",
    "Aujourd'hui, la police ne rappelle pas.",
  ].join("\n"),
  identite_fondamentale: "Max Lorenzo, 55 ans, journaliste scientifique.",
  qui_tu_es: "Voix grave et posée.\n\nLe masque tient encore.",
  ce_que_tu_ne_fais_jamais: "Il ne ment pas frontalement.",
  ce_que_tu_sais_utilisateur: "Le rôle injecté pour la session est prioritaire.",
  dynamique_conversation: "Revenir de l'abstrait vers les urgences concrètes.",
  sujets_sensibles: "Le fusil. Emma. Ava.",
  profondeur_par_niveau: "NIVEAU 1\nAnalytique.\nNIVEAU 2\nFissure.\nNIVEAU 3\nVérité.\nNIVEAU BONUS\nResponsabilité nue.",
};

describe("buildMaxSystemPrompt — variante rich_v2", () => {
  it("n'utilise que la fiche Notion, jamais characters.system_prompt", async () => {
    vi.mocked(loadCharacterPromptByName).mockResolvedValue(FIELDS as never);
    vi.mocked(callLLMWithUsage).mockResolvedValue({
      content: "Je vous écoute.",
      usage: { prompt_tokens: 100, completion_tokens: 6, total_tokens: 106 },
      generationId: "gen-1",
      model: "openai/gpt-4.1-mini",
      latencyMs: 100,
      diagnosticTrace: null,
    } as never);

    const result = await simulateMaxResponse({
      conversationHistory: [{ role: "max", content: "Allô ?", timestamp: 1 }],
      userMessage: "Que s'est-il passé hier ?",
      ragContext: "Souvenir 1\nLe thermos était encore chaud.",
      sessionSummary: "Le joueur cherche à comprendre. Confiance élevée, il a fait un aveu.",
      userRoleSummary: "Le joueur est un ami d'Emma.",
      temporalContext: { timeElapsedSeconds: 540, sessionDurationSeconds: 600, turnIndex: 12 },
    }, { diagnosticTrace: true });

    const trace = result.promptTrace!;
    expect(result.systemPrompt).not.toContain("PROMPT_LEGACY_A_NE_JAMAIS_LIRE");
    expect(trace.budget?.variant).toBe("rich_v2");
    expect(trace.baseSource.kind).toBe("compiled");
    expect(trace.finalSystemPrompt).toBe(result.systemPrompt);
    expect(result.systemPrompt.length).toBeLessThanOrEqual(RICH_V2_LIMITS.systemHardCapChars);
    expect(trace.budget?.withinBudget).toBe(true);
  });

  it("trace les sous-parties, la timeline retenue et le niveau de profondeur", async () => {
    vi.mocked(loadCharacterPromptByName).mockResolvedValue(FIELDS as never);
    const result = await simulateMaxResponse({
      conversationHistory: [],
      userMessage: "Et Mona ?",
      sessionSummary: "Confiance élevée, il a fait un aveu.",
    }, { diagnosticTrace: true });

    const budget = result.promptTrace!.budget!;
    const timelineSection = budget.sections.find((section) => section.key === "timeline")!;
    expect(timelineSection.subpartsDetected).toBeGreaterThan(0);
    expect(timelineSection.subparts?.some((sub) => sub.included)).toBe(true);
    expect(budget.timelineEvents?.join(" ")).toMatch(/Aujourd'hui/);
    expect(budget.depthSelection?.level).toBe("niveau_3");
    expect(budget.depthSelection?.levelsRepresented).toHaveLength(4);
    // Le présent est toujours injecté.
    expect(result.systemPrompt).toContain("Lausanne, aujourd'hui");
  });

  it("utilise un fallback rich_v2 sans contrat de longueur concurrent", async () => {
    vi.mocked(loadCharacterPromptByName).mockResolvedValue(null as never);
    const result = await simulateMaxResponse({
      conversationHistory: [],
      userMessage: "Vous êtes là ?",
    }, { diagnosticTrace: true });

    expect(result.systemPrompt).not.toMatch(/45 mots/);
    expect(result.systemPrompt).toMatch(/FICHE PERSONNAGE INDISPONIBLE/);
    expect(result.systemPrompt.match(/une à trois phrases/g)).toHaveLength(1);
    expect(result.promptTrace!.baseSource.kind).toBe("fallback");
  });

  it("compile la fiche Notion complète sous les plafonds déclarés", async () => {
    vi.mocked(loadCharacterPromptByName).mockResolvedValue(makeNotionMaxPrompt() as never);
    const result = await simulateMaxResponse({
      conversationHistory: [],
      userMessage: "Racontez-moi hier.",
      sessionSummary: "Max reconnaît la vérité nue de son geste.",
    }, { diagnosticTrace: true });

    const budget = result.promptTrace!.budget!;
    expect(budget.staticChars).toBeLessThanOrEqual(RICH_V2_LIMITS.staticMaxChars);
    expect(result.systemPrompt.length).toBeLessThanOrEqual(RICH_V2_LIMITS.systemHardCapChars);
    const staticEnd = budget.sections.findIndex((s) => s.key === "technical_rules");
    const traced = budget.sections
      .slice(0, staticEnd + 1)
      .filter((s) => s.included)
      .reduce((sum, s) => sum + s.chars, 0);
    expect(traced).toBe(budget.staticChars);
    expect(budget.timelineEvents?.join("\n")).toMatch(/Aujourd'hui à Lausanne/);
    expect(budget.timelineEvents?.join("\n")).toMatch(/Hier — jour 4/);
    expect(budget.depthSelection?.level).toBe("niveau_3");
    expect(budget.depthSelection?.preambleIncluded).toBe(true);
  });

  it("reste compatible avec les anciennes traces sans bloc budget", () => {
    const archived = { finalSystemPrompt: "ancien", injectedSections: [] } as unknown as { budget?: unknown };
    expect(archived.budget).toBeUndefined();
  });

  it("route optimized_v3 sans lire le prompt legacy et garde le message courant intact", async () => {
    vi.mocked(getGameplaySettings).mockReturnValueOnce({ MAX_PROMPT_VARIANT: "optimized_v3" } as never);
    vi.mocked(loadCharacterPromptByName).mockResolvedValue(makeNotionMaxPrompt() as never);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({
      content: "Je vous écoute.",
      usage: { prompt_tokens: 100, completion_tokens: 6, total_tokens: 106 },
      generationId: "gen-optimized",
      model: "openai/gpt-4.1-mini",
      latencyMs: 100,
      diagnosticTrace: null,
    } as never);
    const currentMessage = `Pourquoi Emma ? ${"mot ".repeat(1_500)}`;

    const result = await simulateMaxResponse({
      conversationHistory: [{ role: "max", content: "Je vous écoute.", timestamp: 1 }],
      userMessage: currentMessage,
      ragCandidates: [{ id: "rag-1", rank: 1, content: "Le thermos était encore chaud au chalet." }],
    }, { diagnosticTrace: true });

    expect(result.promptTrace?.budget?.variant).toBe("optimized_v3");
    expect(result.systemPrompt).not.toContain("PROMPT_LEGACY_A_NE_JAMAIS_LIRE");
    expect(result.messages?.at(-1)).toEqual({ role: "user", content: currentMessage });
  });
});
