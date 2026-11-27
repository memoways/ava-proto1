import { describe, expect, it } from "vitest";
import { normalizeCharacterProviderPreference } from "./settingsService";

/** Latency lot 3: only the routing the lot 2 bench measured can be stored. */
describe("réglage de routage du personnage", () => {
  it("garde sort: latency", () => {
    expect(normalizeCharacterProviderPreference({ sort: "latency" })).toEqual({ sort: "latency" });
  });

  it("retombe sur le routage par défaut pour toute autre valeur", () => {
    for (const value of [null, undefined, "latency", [], {}, { sort: "price" }, { only: ["cerebras"] }]) {
      expect(normalizeCharacterProviderPreference(value)).toBeNull();
    }
  });

  it("ne garde aucune autre clé", () => {
    expect(normalizeCharacterProviderPreference({ sort: "latency", allow_fallbacks: false })).toEqual({ sort: "latency" });
  });
});
