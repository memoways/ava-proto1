import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
  streamLLM: vi.fn(),
  LLMProxyRequestError: class extends Error {},
}));
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: vi.fn(),
  getLLMSettings: vi.fn(),
  getAntiHallucinationValidatorSettings: vi.fn(),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/characterPromptService", () => ({
  buildCharacterPromptSections: vi.fn((prompt) => [
    `## IDENTITÉ FONDAMENTALE\n${prompt.identite_fondamentale}`,
    `## QUI TU ES\n${prompt.qui_tu_es}`,
    `## CE QUE TU NE FAIS JAMAIS\n${prompt.ce_que_tu_ne_fais_jamais}`,
    `## DYNAMIQUE\n${prompt.dynamique_conversation}`,
  ].join("\n\n")),
  loadCharacterPrompt: vi.fn(),
  loadCharacterPromptByName: vi.fn(),
  clearCharacterPromptCache: vi.fn(),
}));

import { loadCharacterPrompt } from "@/services/characterPromptService";
import { getGameplaySettings } from "@/services/settingsService";
import type { CharacterExecutionContext } from "@/services/characterIdentityGuard";
import { buildMaxSystemPrompt } from "./maxAgent";

const variants = ["legacy", "compact_v1", "rich_v2", "optimized_v3"] as const;

const contexts: Record<"max" | "emma", CharacterExecutionContext> = {
  max: {
    characterKey: "max",
    displayName: "Max Lorenzo",
    characterId: "11111111-1111-4111-8111-111111111111",
    notionPageId: "30362322e5958011ad7bffb1ed6772bc",
    environmentId: "prod",
    promptUpdatedAt: "2026-09-11T08:00:00.000Z",
  },
  emma: {
    characterKey: "emma",
    displayName: "Emma Munz",
    characterId: "22222222-2222-4222-8222-222222222222",
    notionPageId: "881122c973c943409daed13b3113b00e",
    environmentId: "prod",
    promptUpdatedAt: "2026-09-11T08:00:00.000Z",
  },
};

function sheet(character: "max" | "emma", volume = 1) {
  const context = contexts[character];
  const name = context.displayName;
  const expand = (sentence: string) => Array.from({ length: volume }, () => sentence).join(" ");
  return {
    character_id: context.characterId,
    name,
    updated_at: context.promptUpdatedAt,
    situation_summary: expand(`${name} est à Lausanne aujourd'hui.`),
    timeline: expand("Hier, la famille est rentrée de la montagne."),
    identite_fondamentale: expand(`${name} garde sa propre identité.`),
    qui_tu_es: expand("Une présence lucide et retenue."),
    ce_que_tu_ne_fais_jamais: expand("INTERDIT_IDENTITAIRE_TEMOIN : ne jamais prendre l'identité d'un autre personnage."),
    ce_que_tu_sais_utilisateur: expand("L'interlocuteur vient de se présenter."),
    dynamique_conversation: expand("Répondre précisément à ce qui vient d'être dit."),
    sujets_sensibles: expand("Ava, Mona et le retour du chalet."),
    profondeur_par_niveau: expand("NIVEAU 1 : rester factuel. NIVEAU 2 : laisser une fissure."),
  };
}

const input = { conversationHistory: [], userMessage: "Qui êtes-vous ?" };

describe("identity lock across prompt variants", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(variants)("compile Emma from her exact attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("emma") as never);

    const trace = await buildMaxSystemPrompt(input, "Emma Munz", contexts.emma);

    expect(loadCharacterPrompt).toHaveBeenCalledWith(contexts.emma.characterId);
    expect(trace.finalSystemPrompt.startsWith("# IDENTITÉ ACTIVE")).toBe(true);
    expect(trace.finalSystemPrompt).toContain("Tu es Emma Munz");
    expect(trace.finalSystemPrompt).not.toMatch(/Tu es Max\b/);
    expect(trace.baseSource.characterId).toBe(contexts.emma.characterId);
  });

  it.each(variants)("compile Max from his exact attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("max") as never);

    const trace = await buildMaxSystemPrompt(input, "Max Lorenzo", contexts.max);

    expect(trace.finalSystemPrompt).toContain("Tu es Max Lorenzo");
    expect(trace.finalSystemPrompt).not.toMatch(/Tu es Emma\b/);
    expect(trace.baseSource.characterId).toBe(contexts.max.characterId);
  });

  it.each(variants)("refuses generation without the attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(null as never);

    await expect(buildMaxSystemPrompt(input, "Emma Munz", contexts.emma)).rejects.toThrow(/fiche personnage absente/i);
  });

  it.each(variants)("refuses an incoherent Max sheet attributed to Emma in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("max") as never);

    await expect(buildMaxSystemPrompt(input, "Emma Munz", contexts.emma)).rejects.toThrow(/fiche personnage incohérente/i);
  });

  it.each(variants)("keeps identity and Notion prohibitions ahead of oversized optional content in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("emma", 350) as never);

    const trace = await buildMaxSystemPrompt(input, "Emma Munz", contexts.emma);

    expect(trace.finalSystemPrompt.startsWith("# IDENTITÉ ACTIVE")).toBe(true);
    expect(trace.finalSystemPrompt).toContain("Tu es Emma Munz");
    expect(trace.finalSystemPrompt).toContain("INTERDIT_IDENTITAIRE_TEMOIN");
  });
});
