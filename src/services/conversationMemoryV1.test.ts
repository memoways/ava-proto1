import { describe, expect, it } from "vitest";
import {
  createEmptyConversationMemory,
  filterConversationMemoryForCharacter,
  formatConversationMemory,
  mergeConversationMemory,
  normalizeConversationMemory,
} from "./conversationMemoryV1";
import { selectOptimizedConversation } from "./conversationMemory";

describe("ConversationMemoryV1", () => {
  it("fusionne et déduplique un delta par tour", () => {
    const first = mergeConversationMemory(createEmptyConversationMemory(), {
      interlocutor: { name: "Alice", role: "médecin", traits: ["Elle conteste Max"] },
      userFacts: ["Elle a une sœur", "Elle a une sœur"],
      openThreads: ["Réparer avec Emma"],
      relationship: { depth: "fissure", trust: "ouverte", emotionalState: "tendue" },
      lastExchange: "Alice confronte Max à son contrôle.",
    }, 1);
    const duplicate = mergeConversationMemory(first, { userFacts: ["Elle a une sœur"] }, 1);

    expect(first.userFacts).toHaveLength(1);
    expect(first.interlocutor.name).toBe("Alice");
    expect(first.relationship.depth).toBe("fissure");
    expect(duplicate).toEqual(first);
  });

  it("ignore un delta retardé et ne fait jamais régresser la profondeur", () => {
    const deep = mergeConversationMemory(createEmptyConversationMemory(), {
      relationship: { depth: "verite", trust: "ouverte" },
      maxDisclosures: ["Max reconnaît avoir levé le fusil sur Emma"],
    }, 5);
    const banal = mergeConversationMemory(deep, {
      relationship: { depth: "surface", emotionalState: "plus calme" },
      topics: ["météo"],
    }, 6);
    const delayed = mergeConversationMemory(banal, {
      userFacts: ["Ce delta du tour quatre arrive en retard"],
    }, 4);

    expect(banal.relationship.depth).toBe("verite");
    expect(delayed).toEqual(banal);
  });

  it("ignore les états invalides et borne le rendu", () => {
    const normalized = normalizeConversationMemory({ version: 99, lastTurn: -1, relationship: { depth: "wrong" } });
    const rendered = formatConversationMemory(normalized, 80);

    expect(normalized.version).toBe(2);
    expect(normalized.lastTurn).toBe(0);
    expect(rendered.length).toBeLessThanOrEqual(80);
  });

  it("borne la mémoire aux frontières d'éléments sans perdre l'état relationnel", () => {
    const facts = Array.from({ length: 20 }, (_, index) => `fait personnel explicite numéro ${index + 1} avec suffisamment de détails`);
    const memory = mergeConversationMemory(createEmptyConversationMemory(), {
      interlocutor: { name: "Alice", role: "médecin" },
      userFacts: facts,
      relationship: { depth: "verite", trust: "ouverte" },
      lastExchange: "Alice demande à Max d'assumer ce qu'il a fait.",
    }, 7);
    const rendered = formatConversationMemory(memory, 420);

    expect(rendered.length).toBeLessThanOrEqual(420);
    expect(rendered).toContain("profondeur verite");
    expect(rendered).toContain("Dernier échange");
    expect(rendered).not.toContain("…");
  });

  it("garde deux échanges et les tours non encore mémorisés", () => {
    const conversation = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? "max" as const : "user" as const,
      content: `m${index}`,
      timestamp: index,
    }));
    const selected = selectOptimizedConversation(conversation, 4);
    expect(selected.map((message) => message.content)).toEqual(["m6", "m7", "m8", "m9"]);
    expect(selectOptimizedConversation(conversation, 2)).toHaveLength(6);
  });

  it("omet un ancien échange surdimensionné sans jamais le couper", () => {
    const conversation = [
      { role: "user" as const, content: "u".repeat(700), timestamp: 1 },
      { role: "max" as const, content: "m".repeat(700), timestamp: 2 },
    ];
    expect(selectOptimizedConversation(conversation, 0)).toEqual([]);
  });

  it("ne transmet pas à Emma une confidence privée faite à Max", () => {
    const memory = mergeConversationMemory(createEmptyConversationMemory(), {
      userFacts: ["Alice confie à Max qu'elle a falsifié le dossier."],
      lastExchange: "Alice demande à Max de garder le secret.",
    }, 4, "max");

    const emmaMemory = filterConversationMemoryForCharacter(memory, "emma");
    const rendered = formatConversationMemory(emmaMemory);

    expect(emmaMemory.userFacts).toEqual([]);
    expect(emmaMemory.lastExchange).toBeNull();
    expect(rendered).not.toContain("falsifié");
    expect(rendered).not.toContain("garder le secret");
  });

  it("ignore une promotion partagée : une confidence de conversation reste privée", () => {
    const memory = mergeConversationMemory(createEmptyConversationMemory(), {
      characterItems: [{
        text: "Alice a menti à Max sur le dossier.",
        sourceCharacter: "max",
        visibility: "shared",
        visibleTo: ["max", "emma"],
        provenance: "gm",
      }],
    }, 5, "max");

    const emmaMemory = filterConversationMemoryForCharacter(memory, "emma");

    expect(emmaMemory.characterItems).toEqual([]);
    expect(formatConversationMemory(emmaMemory)).not.toContain("menti");
  });

  it("rend à Max sa propre mémoire après un passage par Emma", () => {
    const afterMax = mergeConversationMemory(createEmptyConversationMemory(), {
      interlocutor: { name: "Alice", role: "médecin" },
      userFacts: ["Alice cherche Ava avec Max"],
      lastExchange: "Alice promet de revenir vers Max.",
    }, 2, "max");
    const afterEmma = mergeConversationMemory(afterMax, {
      userFacts: ["Alice dit à Emma qu'elle a vu Léo"],
      lastExchange: "Emma refuse d'en dire plus.",
    }, 6, "emma");

    const maxMemory = filterConversationMemoryForCharacter(afterEmma, "max");
    const emmaMemory = filterConversationMemoryForCharacter(afterEmma, "emma");

    expect(maxMemory.interlocutor).toMatchObject({ name: "Alice", role: "médecin" });
    expect(maxMemory.userFacts.map((item) => item.text)).toEqual(["Alice cherche Ava avec Max"]);
    expect(maxMemory.lastExchange).toContain("revenir vers Max");
    expect(emmaMemory.interlocutor).toMatchObject({ name: "Alice", role: "médecin" });
    expect(emmaMemory.userFacts.map((item) => item.text)).toEqual(["Alice dit à Emma qu'elle a vu Léo"]);
    expect(emmaMemory.lastExchange).toContain("refuse d'en dire plus");
    expect(formatConversationMemory(maxMemory)).not.toContain("Léo");
    expect(formatConversationMemory(emmaMemory)).not.toContain("Ava avec Max");
  });
});
