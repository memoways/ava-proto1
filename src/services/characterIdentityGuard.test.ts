import { describe, expect, it } from "vitest";
import {
  buildCharacterIdentityInvariant,
  guardCharacterResponse,
  type CharacterExecutionContext,
} from "./characterIdentityGuard";

const emma: CharacterExecutionContext = {
  characterKey: "emma",
  displayName: "Emma Munz",
  characterId: "11111111-1111-4111-8111-111111111111",
  notionPageId: "881122c973c943409daed13b3113b00e",
  environmentId: "prod",
  promptUpdatedAt: "2026-08-21T00:00:00.000Z",
};

describe("character identity guard", () => {
  it.each([
    "Non, je suis Max, ton compagnon.",
    "Ah, salut Emma. C'est Max. Ça va ?",
    "Moi, c’est Max.",
    "Je m'appelle Max Lorenzo.",
    "Mon nom est Max.",
    "On m’appelle Max.",
    "En tant que Max, je refuse.",
    "Ici Max. Je vous écoute.",
    "Appelez-moi Max.",
  ])("bloque une auto-identification de Max quand Emma parle: %s", (response) => {
    const result = guardCharacterResponse(response, emma);
    expect(result.blocked).toBe(true);
    expect(result.response).toContain("Emma");
    expect(result.response).not.toContain("Max");
  });

  it.each([
    "Max m'a appelée hier.",
    "Ce n'est pas moi, c'est Max qui a pris cette décision.",
    "Je ne suis pas Max.",
    "Il m'a dit : « Je suis Max, ton compagnon. »",
  ])("conserve une mention, une négation ou une citation légitime: %s", (response) => {
    expect(guardCharacterResponse(response, emma)).toEqual({
      blocked: false,
      response,
      reason: null,
    });
  });

  it("place l'identité et la provenance dans un invariant non ambigu", () => {
    const invariant = buildCharacterIdentityInvariant(emma);
    expect(invariant).toContain("Tu es Emma Munz");
    expect(invariant).toContain(emma.characterId);
    expect(invariant).toContain(emma.notionPageId);
    expect(invariant).toContain("prod");
    expect(invariant).toContain(emma.promptUpdatedAt);
  });

  it("refuse des identifiants ou versions de fiche invalides", () => {
    expect(() => guardCharacterResponse("Bonjour.", { ...emma, notionPageId: "not-a-page" })).toThrow(/Notion page/i);
    expect(() => guardCharacterResponse("Bonjour.", { ...emma, promptUpdatedAt: "not-a-date" })).toThrow(/prompt version/i);
  });
});
