import { describe, expect, it } from "vitest";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";
import { buildOptimizedPromptAssembly, OPTIMIZED_V3_LIMITS } from "./maxOptimizedPromptCompiler";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";
import { buildExperienceFrame } from "@/services/experienceFrame";

describe("optimized_v3 prompt compiler", () => {
  it.each(["---", "***", "…", "Max"])("un fragment court %s ne supprime pas le cadre du transfert ou les faits nouveaux", (fragment) => {
    const frame = buildExperienceFrame({ config: null, filmAnswer: "pas_vu",
      callTransfer: { from: "emma", returning: false } }).prompt;
    const result = buildOptimizedPromptAssembly({
      character: makeNotionMaxPrompt({ references_intellectuelles: fragment }),
      characterName: "Max",
      userMessage: "Vous êtes là ?",
      historyChars: 0,
      experienceFrame: frame,
      temporalContext: "Tour 8 : appel téléphonique transféré.",
      ragCandidates: [{ id: "nouveau", rank: 1,
        content: "Le carnet bleu est resté sous le siège arrière du Berlingo." }],
    });

    expect(result.finalSystemPrompt).toContain(frame);
    expect(result.budget?.sections.find(section => section.key === "experience_frame")).toMatchObject({ included: true, truncated: false });
    expect(result.finalSystemPrompt).toContain("Tour 8 : appel téléphonique transféré.");
    expect(result.finalSystemPrompt).toContain("Le carnet bleu est resté sous le siège arrière du Berlingo.");
  });

  it("conserve le cadre partagé même lorsqu'un fait figure déjà dans la fiche", () => {
    const frame = "Lausanne, aujourd'hui.\nCet appel t'a été passé par Emma.";
    const result = buildOptimizedPromptAssembly({
      character: makeNotionMaxPrompt(), characterName: "Max",
      userMessage: "Vous êtes là ?", historyChars: 0, experienceFrame: frame,
    });
    expect(result.finalSystemPrompt).toContain(frame);
  });

  it("respecte le budget global et conserve le message courant hors troncature", () => {
    const memory = mergeConversationMemory(null, {
      interlocutor: { name: "Alice", role: "médecin" },
      topics: ["Emma", "contrôle"],
      lastExchange: "Alice a confronté Max à son besoin de décider pour Emma.",
    }, 3, "max");
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
    expect(result.finalSystemPrompt).toMatch(/# NOYAU DE MAX LORENZO\n## /);
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

  it("refuse de générer sans fiche plutôt que d'utiliser la biographie de Max", () => {
    expect(() => buildOptimizedPromptAssembly({
      character: null,
      characterName: "Emma",
      userMessage: "Vous êtes là ?",
      historyChars: 0,
    })).toThrow(/fiche personnage/i);
  });

  it("compile Emma sans lui injecter l'identité de Max", () => {
    const character = {
      ...makeNotionMaxPrompt(),
      character_id: "22222222-2222-4222-8222-222222222222",
      name: "Emma Munz",
      situation_summary: "Emma est chez elle à Lausanne.",
      identite_fondamentale: "Tu es Emma Munz, cinéaste et mère d'Ava.",
      qui_tu_es: "Tu parles avec la voix d'Emma.",
      dynamique_conversation: "Emma veut comprendre ce qui s'est passé.",
      timeline: "Aujourd'hui, Emma répond à cet appel.",
      ce_que_tu_ne_fais_jamais: "Tu ne prétends jamais être une autre personne.",
    };
    const result = buildOptimizedPromptAssembly({
      character,
      characterName: "Emma Munz",
      userMessage: "Qui es-tu ?",
      historyChars: 0,
    });

    expect(result.finalSystemPrompt).toContain("Tu es Emma Munz");
    expect(result.finalSystemPrompt).not.toMatch(/Tu es Max(?:\s|[.,])/);
    expect(result.finalSystemPrompt).not.toContain("# NOYAU DE MAX");
  });
});
