import { describe, expect, it } from "vitest";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";
import { buildOptimizedPromptAssembly, OPTIMIZED_V3_LIMITS } from "./maxOptimizedPromptCompiler";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";

describe("optimized_v3 prompt compiler", () => {
  it("respecte le budget global et conserve le message courant hors troncature", () => {
    const memory = mergeConversationMemory(null, {
      interlocutor: { name: "Alice", role: "médecin" },
      topics: ["Emma", "contrôle"],
      lastExchange: "Alice a confronté Max à son besoin de décider pour Emma.",
    }, 3);
    const result = buildOptimizedPromptAssembly({
      character: makeNotionMaxPrompt(),
      characterName: "Max",
      userMessage: "Pourquoi as-tu saisi le bras d'Emma ?",
      historyChars: 900,
      conversationMemory: memory,
      userRole: "Alice, médecin",
      temporalContext: "Tour 4, milieu de l'appel.",
      ragCandidates: [
        { id: "duplicate", rank: 1, content: "Lausanne, aujourd'hui. Retour du Jura hier soir. Emma et Ava enfermées dans leurs chambres, Mona toujours au camp, la police qui ne rappelle pas." },
        { id: "detail", rank: 2, content: "Dans le couloir, j'ai saisi le bras d'Emma pour décider à sa place où elle devait rester." },
        { id: "partial", rank: 3, content: "Lausanne, aujourd'hui. Dans sa poche, Max conserve le ticket froissé de la station-service." },
        { id: "backfill", rank: 4, content: "Partie 2/4 — À l'hôtel, le néon du couloir bourdonnait pendant que Max cherchait une sortie." },
        { id: "lower", rank: 5, content: "Philippe a posé deux verres sur la table sans rien demander." },
      ],
    });

    expect(result.budget?.variant).toBe("optimized_v3");
    expect(result.budget?.staticChars).toBeLessThanOrEqual(OPTIMIZED_V3_LIMITS.staticChars);
    expect((result.budget?.totalSystemChars ?? 0) + 900).toBeLessThanOrEqual(OPTIMIZED_V3_LIMITS.generatedContextChars);
    expect(result.finalSystemPrompt).toContain("# CONTRAT DE CONVERSATION");
    expect(result.finalSystemPrompt).toMatch(/# NOYAU DE MAX\n## /);
    expect(result.finalSystemPrompt).toContain("HISTORIQUE DE LA CONVERSATION");
    expect(result.finalSystemPrompt).toContain("Dans le couloir");
    expect(result.budget?.ragSelection?.find((item) => item.id === "duplicate")?.status).toBe("duplicate_static");
    expect(result.finalSystemPrompt).toContain("ticket froissé");
    expect(result.budget?.ragSelection?.find((item) => item.id === "partial")).toMatchObject({
      status: "selected",
      reason: "merged_new_sentences",
    });
    expect(result.budget?.ragSelection?.filter((item) => item.status === "selected")).toHaveLength(3);
    expect(result.budget?.ragSelection?.find((item) => item.id === "backfill")?.status).toBe("selected");
    expect(result.budget?.ragSelection?.find((item) => item.id === "lower")?.status).toBe("lower_rank");
    expect(result.finalSystemPrompt).not.toMatch(/Partie\s+\d+\/\d+/i);
  });

  it("ne lit jamais le prompt legacy et signale un message courant surdimensionné", () => {
    const result = buildOptimizedPromptAssembly({
      character: makeNotionMaxPrompt(),
      characterName: "Max",
      userMessage: "x".repeat(8_000),
      historyChars: 1_000,
    });
    expect(result.baseSource.kind).toBe("compiled");
    expect(result.budget?.oversizedCurrentUser).toBe(true);
  });

  it("conserve le présent, la contradiction et le moteur même sans fiche disponible", () => {
    const result = buildOptimizedPromptAssembly({
      character: null,
      characterName: "Max",
      userMessage: "Vous êtes là ?",
      historyChars: 0,
    });

    expect(result.baseSource.kind).toBe("fallback");
    expect(result.finalSystemPrompt).toMatch(/Lausanne aujourd'hui/);
    expect(result.finalSystemPrompt).toMatch(/protecteur.*contrôler/s);
    expect(result.finalSystemPrompt).toMatch(/mettre de l'ordre/);
  });
});
