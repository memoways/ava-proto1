import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "@/types";
import {
  detectPlayerSwitchRequest,
  hasSpokenWithCharacter,
  inferCharacterSwitchStance,
  lastHandoffUserTurn,
  sliceConversationForCharacter,
  tagSpokenWith,
} from "./characterConversation";

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
