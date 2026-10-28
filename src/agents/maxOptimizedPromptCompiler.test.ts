import { describe, expect, it } from "vitest";
import { makeNotionMaxPrompt } from "./__fixtures__/maxNotionFixture";
import { buildOptimizedPromptAssembly, OPTIMIZED_V3_LIMITS } from "./maxOptimizedPromptCompiler";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";
import { buildExperienceFrame } from "@/services/experienceFrame";
import { makeCanonicalPresentFixture } from './__fixtures__/canonicalPresentFixture';

describe("optimized_v3 prompt compiler", () => {
  const presentCases = (['max', 'emma'] as const).flatMap(character =>
    ['Comment va Max ce matin ?', 'Il est parti avec Anne ?', 'Non, vous êtes rentrés hier.'].flatMap(userMessage =>
      [0, 1_800].flatMap(historyChars => [false, true].map(oldMemory => ({ character, userMessage, historyChars, oldMemory })))));

  it.each(presentCases)('garde le présent entier de $character avec $historyChars caractères et souvenir ancien=$oldMemory : $userMessage', ({ character, userMessage, historyChars, oldMemory }) => {
    const sheet = makeCanonicalPresentFixture(character);
    const result = buildOptimizedPromptAssembly({
      character: sheet, characterName: sheet.name!, userMessage, historyChars,
      ragCandidates: oldMemory ? [{ id: 'hotel', rank: 1, content: "Il y a deux jours, le néon grésillait dans le hall de l'hôtel pendant que Max cherchait Anne." }] : [],
    });
    // The entire editorial scene, including its last paragraph, must reach the model.
    expect(result.finalSystemPrompt).toContain(sheet.situation_summary);
    expect(result.finalSystemPrompt).toContain(sheet.maniere_de_parler);
    expect(result.finalSystemPrompt).toContain(sheet.dynamique_conversation);
    if (oldMemory) expect(result.finalSystemPrompt).toContain("Il y a deux jours, le néon grésillait dans le hall de l'hôtel pendant que Max cherchait Anne.");
    expect(result.budget?.withinBudget).toBe(true);
    expect(result.budget?.staticChars).toBeLessThanOrEqual(result.budget!.staticLimitChars);
  });

  it('conserve les paragraphes du présent malgré une timeline lexicalement voisine', () => {
    const sheet = makeCanonicalPresentFixture('emma');
    sheet.timeline = sheet.situation_summary + '\n\nIl y a deux jours, le départ vers un hôtel.';
    sheet.situation_summary += '\n\nPrécision actuelle : le téléphone attend sur la table.  Emma reste là.';
    const result = buildOptimizedPromptAssembly({ character: sheet, characterName: sheet.name!, userMessage: 'Où êtes-vous ?', historyChars: 3_000 });
    expect(result.finalSystemPrompt).toContain(sheet.situation_summary);
    expect(result.budget?.withinBudget).toBe(true);
    const core = result.injectedSections.find(section => section.key === 'character_core')!;
    expect(core.content).toContain(sheet.situation_summary);
    expect(result.budget?.units?.filter(unit => unit.sourceKey === 'situation_summary')).toEqual([
      expect.objectContaining({ status: 'selected', chars: sheet.situation_summary.length, removedChars: 0 }),
    ]);
    const staticSections = result.budget!.sections.filter(section => ['character_core', 'character_canon'].includes(section.key));
    expect(staticSections.reduce((sum, section) => sum + section.chars, 0)).toBe(result.budget!.staticChars);
  });

  it.each(['présent', 'parole'] as const)('refuse un %s obligatoire trop grand plutôt que le tronquer', field => {
    const sheet = makeCanonicalPresentFixture('emma');
    if (field === 'présent') sheet.situation_summary = 'Un fait actuel. '.repeat(500);
    else sheet.maniere_de_parler = 'Un état de parole. '.repeat(500);
    expect(() => buildOptimizedPromptAssembly({ character: sheet, characterName: sheet.name!, userMessage: 'Bonjour', historyChars: 0 }))
      .toThrow(/canonique.*parole éditoriale.*génération interdite/i);
  });

  it('refuse de perdre le noyau lorsque l’historique épuise le budget global', () => {
    const sheet = makeCanonicalPresentFixture('emma');
    expect(() => buildOptimizedPromptAssembly({ character: sheet, characterName: sheet.name!, userMessage: 'Et ce matin ?', historyChars: 7_000 }))
      .toThrow(/hors budget de contexte.*génération interdite/i);
  });

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
