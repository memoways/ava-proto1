import { describe, expect, it } from "vitest";
import {
  compileDepth,
  compileRichCharacterSections,
  compileTimeline,
  renderRichSections,
  splitDepthLevels,
  splitIntoSubparts,
  RICH_V2_CONVERSATION_CONTRACT,
  RICH_V2_LIMITS,
  RICH_V2_RAG,
} from "./maxRichPromptCompiler";
import { maxRagFormatOptionsForVariant } from "@/services/maxRagVariant";
import { formatMaxRAGContext, type RAGMatch } from "@/services/ragService";
import { getSupportedSamplingParameters } from "@/services/llmModelCapabilities";
import type { CharacterPrompt } from "@/services/characterPromptService";

const TIMELINE = [
  "Il y a environ trois mois, la pandémie de Protogyne se déclare.",
  "Il y a un mois, les écoles ferment et les camps ouvrent.",
  "Il y a trois semaines, Mona se transforme.",
  "Il y a sept jours, quelqu'un frappe à la porte de l'appartement.",
  "Il y a cinq jours, nous partons pour le chalet du Jura avec un thermos chaud.",
  "Jour 2 au chalet : l'homme sous l'abri, la gentiane, l'aveu à Philippe.",
  "Jour 3 : l'hôtel, la poêle d'Anne, le faux Peter et la prise d'otage.",
  "Hier, le carnage : j'ai pointé le fusil sur Emma puis sur Ava, Léo m'a désarmé.",
  "Aujourd'hui, à Lausanne, la police ne rappelle pas et les chambres restent fermées.",
].join("\n");

const DEPTH = [
  "NIVEAU 1 — Surface",
  "Posture analytique, distance de journaliste. Tu expliques le monde plutôt que toi.",
  "Tu peux évoquer Camus sans le nommer.",
  "",
  "NIVEAU 2 — Fissure",
  "Tu appliques enfin ton analyse à tes propres actes. La honte affleure.",
  "",
  "NIVEAU 3 — Vérité",
  "Tu nommes le geste : le fusil, Emma, Ava. Plus de grille intellectuelle.",
  "",
  "NIVEAU BONUS — Responsabilité nue",
  "Tu ne cherches plus d'explication. Tu dis ce que tu as fait.",
].join("\n");

function makePrompt(overrides: Partial<CharacterPrompt> = {}): CharacterPrompt {
  return {
    character_id: "max",
    name: "Max Lorenzo",
    situation_summary: "Lausanne, aujourd'hui. Retour du Jura hier. Emma et Ava enfermées, Mona au camp, la police muette.",
    timeline: TIMELINE,
    identite_fondamentale: "Max Lorenzo, 55 ans, journaliste scientifique, père de Mona, Léo et Ava.\n\nContradiction centrale : il se croit protecteur alors qu'il contrôle.",
    qui_tu_es: "Voix grave et posée, plus brève sous stress.\n\nLe masque public tient encore.\n\nSon drive : comprendre pour ne pas s'effondrer.",
    ce_que_tu_ne_fais_jamais: "Il ne ment pas frontalement : il tait, minimise, reformule.\n\nIl ne récite jamais ses lectures.",
    ce_que_tu_sais_utilisateur: "Le rôle injecté pour la session est prioritaire.\n\nSi aucun rôle n'a été donné, un inconnu a entendu parler de la montagne.",
    dynamique_conversation: "Mettre de l'ordre en racontant.\n\nRevenir de l'abstrait vers les urgences concrètes.",
    sujets_sensibles: "Le fusil.\n\nEmma, Léo, Ava, Mona.\n\nLes morts, les corps, les tremblements.",
    profondeur_par_niveau: DEPTH,
    ...overrides,
  };
}

describe("maxRichPromptCompiler — rich_v2", () => {
  it("découpe en sous-parties sans couper à l'intérieur d'un paragraphe", () => {
    const subparts = splitIntoSubparts("Un premier bloc.\n\nUn second bloc.");
    expect(subparts).toHaveLength(2);
    expect(subparts[1].content).toBe("Un second bloc.");
  });

  it("reconnaît les libellés NOYAU / NUANCES / REPÈRES DE VOIX quand ils existent", () => {
    const subparts = splitIntoSubparts("NOYAU — toujours utile\nA\n\nNUANCES — à préserver\nB\n\nREPÈRES DE VOIX\nC");
    expect(subparts.map((s) => s.priority)).toEqual([0, 1, 2]);
  });

  it("injecte d'abord aujourd'hui et hier, jamais seulement le début chronologique", () => {
    const compiled = compileTimeline(TIMELINE, 300);
    expect(compiled.events.join(" ")).toMatch(/Aujourd'hui/);
    expect(compiled.events.join(" ")).toMatch(/Hier/);
    expect(compiled.events.join(" ")).not.toMatch(/pandémie de Protogyne/);
  });

  it("conserve les quatre niveaux de profondeur et justifie l'ancrage", () => {
    expect(splitDepthLevels(DEPTH).map((b) => b.key)).toEqual(["niveau_1", "niveau_2", "niveau_3", "bonus"]);
    const compiled = compileDepth(DEPTH, 2_000, { sessionSummary: "Confiance élevée, il a fait un aveu." });
    expect(compiled.selection?.level).toBe("niveau_3");
    expect(compiled.selection?.levelsRepresented).toHaveLength(4);
    expect(compiled.selection?.reason).toBeTruthy();
    for (const level of ["NIVEAU 1", "NIVEAU 2", "NIVEAU 3", "NIVEAU BONUS"]) {
      expect(compiled.content).toContain(level);
    }
  });

  it("ne déclenche pas le niveau bonus parce que l'appel touche à sa fin", () => {
    const compiled = compileDepth(DEPTH, 2_000, { sessionSummary: "Échange encore en surface.", turnIndex: 42 });
    expect(compiled.selection?.level).toBe("niveau_1");
  });

  it("ne supprime pas les références intellectuelles", () => {
    const compiled = compileDepth(DEPTH, 2_000, {});
    expect(compiled.content).toContain("Camus");
  });

  it("garde l'ordre déterministe des sous-parties et reste sous le noyau statique", () => {
    const result = compileRichCharacterSections(makePrompt());
    expect(result.sections.map((s) => s.key)).toEqual([
      "situation_summary",
      "identite_fondamentale",
      "qui_tu_es",
      "ce_que_tu_ne_fais_jamais",
      "ce_que_tu_sais_utilisateur",
      "dynamique_conversation",
      "sujets_sensibles",
      "timeline",
      "profondeur_par_niveau",
    ]);
    expect(result.staticChars).toBeLessThanOrEqual(RICH_V2_LIMITS.staticMaxChars);
    expect(result.timelineEvents.join(" ")).toMatch(/Aujourd'hui/);
  });

  it("omet les champs vides et n'invente aucune source", () => {
    const result = compileRichCharacterSections(makePrompt({ sujets_sensibles: "" }));
    expect(result.sections.some((s) => s.key === "sujets_sensibles")).toBe(false);
  });

  it("préserve les champs volumineux sans découpe aveugle du début", () => {
    const longField = Array.from({ length: 30 }, (_, index) => `Paragraphe ${index} sur la posture de Max. Il tient encore le masque.`).join("\n\n");
    const result = compileRichCharacterSections(makePrompt({ qui_tu_es: longField }));
    const section = result.sections.find((s) => s.key === "qui_tu_es");
    expect(section).toBeTruthy();
    expect(section!.subparts.length).toBeGreaterThan(1);
    expect(section!.subparts.some((sub) => !sub.included && sub.omissionReason === "budget_champ")).toBe(true);
    // Aucune sous-partie retenue n'est coupée en plein milieu de phrase.
    for (const line of section!.content.split("\n\n")) {
      expect(line.endsWith(".")).toBe(true);
    }
  });

  it("reste sous le plafond absolu de 18 000 caractères une fois le contrat ajouté", () => {
    const result = compileRichCharacterSections(makePrompt());
    const prompt = `${renderRichSections(result.sections)}\n\n${RICH_V2_CONVERSATION_CONTRACT}`;
    expect(prompt.length).toBeLessThanOrEqual(RICH_V2_LIMITS.systemHardCapChars);
  });

  it("expose un contrat conversationnel unique et non contradictoire", () => {
    expect(RICH_V2_CONVERSATION_CONTRACT).toContain("une à trois phrases");
    expect(RICH_V2_CONVERSATION_CONTRACT).toContain("quatre phrases courtes");
    expect(RICH_V2_CONVERSATION_CONTRACT).not.toMatch(/45 mots/);
    expect(RICH_V2_CONVERSATION_CONTRACT).toMatch(/jamais deux tours de suite/);
  });
});

describe("rich_v2 — politique RAG", () => {
  const matches: RAGMatch[] = Array.from({ length: 5 }, (_, index) => ({
    id: `m${index}`,
    source_table: "characters",
    source_id: `s${index}`,
    content: `[chunk] Partie ${index + 1}/5 : ${`Souvenir numéro ${index} sur le chalet. `.repeat(60)}`,
    similarity: 0.9 - index / 100,
  })) as RAGMatch[];

  it("n'applique les souvenirs de 900 caractères qu'à rich_v2", () => {
    expect(maxRagFormatOptionsForVariant("rich_v2")).toEqual({
      maxItems: RICH_V2_RAG.maxItems,
      itemChars: RICH_V2_RAG.maxItemChars,
      totalChars: RICH_V2_RAG.maxTotalChars,
    });
    expect(maxRagFormatOptionsForVariant("compact_v1")).toEqual({});
    expect(maxRagFormatOptionsForVariant("legacy")).toEqual({});
  });

  it("injecte au plus trois souvenirs et aucune métadonnée technique", () => {
    const context = formatMaxRAGContext(matches, maxRagFormatOptionsForVariant("rich_v2"));
    expect(context.match(/Souvenir \d/g)?.length).toBeLessThanOrEqual(3);
    expect(context).not.toMatch(/Partie \d+\s*\/\s*\d+/);
    expect(context).not.toMatch(/score/i);
    expect(context).not.toMatch(/characters/);
    expect(context.length).toBeLessThanOrEqual(RICH_V2_RAG.maxTotalChars);
  });
});

describe("rich_v2 — garanties transverses", () => {
  it("ne transmet à GPT-5 mini que des paramètres réellement supportés", () => {
    expect(getSupportedSamplingParameters("openai/gpt-5-mini", 0.8, 0.95)).toEqual({});
  });
});
