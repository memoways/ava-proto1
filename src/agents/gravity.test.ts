import { describe, expect, it } from "vitest";
import { enforceGravity, GRAVITY_INVARIANT, isGravityBreach } from "./gravity";
import { RESPONSE_HOOK_RULE } from "./responseHook";

describe("gravity invariant (G1)", () => {
  it("forbids lightness and domestic trivia and steers the hook to the drama", () => {
    expect(GRAVITY_INVARIANT).toContain("NON TRONQUABLE");
    expect(GRAVITY_INVARIANT).toMatch(/humour, de blague/);
    expect(GRAVITY_INVARIANT).toMatch(/café/);
    expect(RESPONSE_HOOK_RULE).not.toMatch(/détail concret non expliqué|je pense à ça/);
    expect(RESPONSE_HOOK_RULE).toMatch(/fil de ton drame/);
  });

  it("drops the coffee digressions observed in the 31 Oct recette, never the answer", () => {
    const reply = "À ce moment-là, dans la montagne. J’ai tiré, pas sur elle. Et pendant qu’elle est enfermée… même l’odeur du café me paraît déplacée.";
    expect(enforceGravity(reply)).toEqual({ text: "À ce moment-là, dans la montagne. J’ai tiré, pas sur elle.", removed: 1 });
    expect(enforceGravity("Je ne sais pas. Ava reste Ava… même si j’ai peur.").removed).toBe(0);
    expect(enforceGravity("Le café refroidit sûrement dans sa tasse.")).toEqual({ text: "Le café refroidit sûrement dans sa tasse.", removed: 0 });
    expect(enforceGravity("Je ne sais pas. Dans la cuisine, la cafetière vient de s’arrêter.").text).toBe("Je ne sais pas.");
  });

  it("flags levity, keeps grave sentences", () => {
    expect(isGravityBreach("Haha, tu me fais rire.")).toBe(true);
    expect(isGravityBreach("C'est une blague, non ?")).toBe(true);
    expect(isGravityBreach("Ava reste Ava, Emma reste Emma.")).toBe(false);
    expect(isGravityBreach("Elle est dans la cuisine et je n'ose pas entrer.")).toBe(false);
    expect(isGravityBreach("Je l'ai mise à l'abri.")).toBe(false);
  });

  it("can drop a leading breach when earlier text was already spoken", () => {
    expect(enforceGravity("Le café est froid.", false)).toEqual({ text: "", removed: 1 });
  });
});

describe("batch salvage (G1)", () => {
  it("keeps the speech of a complete answer whose private header is unusable", async () => {
    const { salvageBatchSpeech } = await import("./maxAgent");
    expect(salvageBatchSpeech('{"goal":"x" <speech>\nNon. Pas maintenant.')).toBe("Non. Pas maintenant.");
    expect(salvageBatchSpeech("Non. Pas maintenant.\n</speech>")).toBe("Non. Pas maintenant.");
    expect(salvageBatchSpeech('{"goal":"x","points":[]}')).toBeNull();
  });
});

describe("character retry reason (G1)", () => {
  it("maps parser errors to bounded span names", async () => {
    const { characterRetrySpanName } = await import("@/services/prd4Orchestrator");
    expect(characterRetrySpanName(new Error("Missing response intent"))).toBe("character_retry_intent");
    expect(characterRetrySpanName(new Error("Invalid response intent JSON"))).toBe("character_retry_intent");
    expect(characterRetrySpanName(new Error("Incomplete response sentence or quote"))).toBe("character_retry_sentence");
    expect(characterRetrySpanName(new Error("Empty response speech"))).toBe("character_retry_empty");
    expect(characterRetrySpanName(new Error("boom"))).toBe("character_retry_other");
  });
});
