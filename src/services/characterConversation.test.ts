import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "@/types";
import {
  buildSwitchRequestGuidance,
  detectPlayerSwitchRequest,
  hasSpokenWithCharacter,
  inferCharacterSwitchStance,
  hasCharacterHandoffConsent,
  parseGmApprovedHandoffOffer,
  parseHandoffOffer,
  lastHandoffUserTurn,
  sliceConversationForCharacter,
  tagSpokenWith,
} from "./characterConversation";

describe("character consent to a GM-authorized handoff", () => {
  it("restores only offers approved under the current orchestration version", () => {
    const recommendation = { reason: "Max accepte.", targetCharacter: "max" };
    expect(parseGmApprovedHandoffOffer(recommendation, "max", "v1")).toBeNull();
    const approved = { ...recommendation, gmApproval: { turnId: "turn-4", orchestrationVersionId: "v1" } };
    expect(parseGmApprovedHandoffOffer(approved, "max", "v2")).toBeNull();
    expect(parseGmApprovedHandoffOffer(approved, "max", "v1")?.gmApproval).toEqual(approved.gmApproval);
  });
  it.each([
    ["D'accord, je te la passe.", "emma", undefined, true],
    ["Tu peux appeler Max si tu veux.", "max", undefined, true],
    ["D'accord, raconte-moi ta journée.", "emma", undefined, false],
    ["Tu peux appeler Emma.", "max", undefined, false],
    ["Je ne vais pas te passer Max comme ça.", "max", "accept", false],
    ["D'accord, mais je ne te la passe pas.", "emma", "accept", false],
    ["Je te la passe.", "emma", "object", false],
    ["Je te la passe.", "emma", "defer", false],
    ["Oui.", "emma", "accept", true],
    ["Je ne sais pas ce qu'il dira, mais tu peux appeler Max.", "max", undefined, true],
    ["Je te le passerai plus tard.", "max", undefined, false],
    ["Tu peux peut-être appeler Max.", "max", undefined, false],
    ["Je te le passe pas.", "max", undefined, false],
    ["Appelle-le pas.", "max", undefined, false],
    ["Non, je préfère que tu restes avec moi.", "max", "accept", false],
    ["Je préfère que tu restes avec moi.", "max", "accept", false],
    ["Tu peux pas appeler Max.", "max", undefined, false],
    ["Je peux pas te passer Max.", "max", "accept", false],
    ["Je ne veux pas que tu appelles Max.", "max", "accept", false],
    ["Je peux te dire que c'est inutile d'appeler Max.", "max", "accept", false],
    ["Je te passe Max.", "max", "accept", true],
  ] as const)("requires transfer consent: %s", (reply, target, stance, expected) => {
    expect(hasCharacterHandoffConsent(reply, target, stance)).toBe(expected);
  });
  it("keeps the approval when a saved session first normalizes its pending offer", () => {
    const raw = { reason: "Max accepte.", targetCharacter: "max",
      gmApproval: { turnId: "turn-4", orchestrationVersionId: "v1" } };
    const normalized = parseHandoffOffer(raw);
    expect(parseGmApprovedHandoffOffer(normalized, "max", "v1")?.gmApproval).toEqual(raw.gmApproval);
  });
});

const log: ConversationMessage[] = [
  tagSpokenWith({ role: "max", content: "Allô ?", timestamp: 1 }, "max"),
  tagSpokenWith({ role: "user", content: "Salut Max", timestamp: 2 }, "max"),
  tagSpokenWith({ role: "max", content: "Je t'écoute.", timestamp: 3 }, "max"),
  tagSpokenWith({ role: "emma", content: "Oui ?", timestamp: 4 }, "emma"),
  tagSpokenWith({ role: "user", content: "Bonjour Emma", timestamp: 5 }, "emma"),
  tagSpokenWith({ role: "emma", content: "Je ne savais pas que tu appelais.", timestamp: 6 }, "emma"),
  tagSpokenWith({ role: "user", content: "On se souvient ?", timestamp: 7 }, "max"),
  tagSpokenWith({ role: "max", content: "Oui, tu m'avais dit salut.", timestamp: 8 }, "max"),
];

describe("characterConversation", () => {
  it.each([["emma", "max"], ["max", "emma"]] as const)(
    "propose de passer l'appel de %s vers %s sans venue physique", (source, target) => {
      const guidance = buildSwitchRequestGuidance(source, target);
      expect(guidance).toContain("passer l'appel");
      expect(guidance).toContain("ne lui propose pas de venir");
      expect(guidance).toContain("accepter, objecter ou hésiter");
      expect(guidance).toContain("N'exécute pas le transfert toi-même");
    },
  );
  it("isole l'historique de chaque personnage, y compris au retour vers Max", () => {
    expect(sliceConversationForCharacter(log, "max").map((message) => message.content)).toEqual([
      "Allô ?",
      "Salut Max",
      "Je t'écoute.",
      "On se souvient ?",
      "Oui, tu m'avais dit salut.",
    ]);
    expect(sliceConversationForCharacter(log, "emma").map((message) => message.content)).toEqual([
      "Oui ?",
      "Bonjour Emma",
      "Je ne savais pas que tu appelais.",
    ]);
    expect(hasSpokenWithCharacter(log, "emma")).toBe(true);
    expect(lastHandoffUserTurn(log)).toBe(3);
  });

  it("écarte d'une reprise une ancienne réponse qui inverse explicitement l'identité", () => {
    const contaminated = [
      ...log,
      tagSpokenWith({ role: "emma", content: "Non, je suis Max, ton compagnon.", timestamp: 9 }, "emma"),
      tagSpokenWith({ role: "emma", content: "Max m'a parlé de la montagne.", timestamp: 10 }, "emma"),
    ];

    expect(sliceConversationForCharacter(contaminated, "emma").map((message) => message.content)).toContain(
      "Max m'a parlé de la montagne.",
    );
    expect(sliceConversationForCharacter(contaminated, "emma").map((message) => message.content)).not.toContain(
      "Non, je suis Max, ton compagnon.",
    );
  });

  it("détecte une demande explicite et ignore une simple mention", () => {
    expect(detectPlayerSwitchRequest("Je voudrais parler à Emma", "max")).toBe("emma");
    expect(detectPlayerSwitchRequest("Passe-moi Max s'il te plaît", "emma")).toBe("max");
    expect(detectPlayerSwitchRequest("Comment va Emma en ce moment ?", "max")).toBeNull();
    expect(detectPlayerSwitchRequest("Je veux parler à Max", "max")).toBeNull();
  });

  it("classe l'acceptation ou l'objection du personnage", () => {
    expect(inferCharacterSwitchStance("D'accord, je te la passe.")).toBe("accept");
    expect(inferCharacterSwitchStance("Pas maintenant. Reste avec moi.")).toBe("object");
    expect(inferCharacterSwitchStance("Je ne sais pas trop.")).toBe("defer");
  });

  it("n'attribue pas silencieusement un ancien message sans identité", () => {
    const unattributed = [{ role: "assistant", content: "Allô ?", timestamp: 1 }] as unknown as ConversationMessage[];

    expect(sliceConversationForCharacter(unattributed, "max")).toEqual([]);
    expect(sliceConversationForCharacter(unattributed, "emma")).toEqual([]);
    expect(hasSpokenWithCharacter(unattributed, "max")).toBe(false);
    expect(hasSpokenWithCharacter(unattributed, "emma")).toBe(false);
  });
});
