import { describe, expect, it } from "vitest";
import { sessionCharacterLabel, sessionCharacterMetadata, sessionCharacterOptions } from "./sessionCharacters";

describe("session character metadata from persisted messages", () => {
  it("does not turn a selection or opening alone into a conversation", () => {
    expect(sessionCharacterMetadata({ active_character: "emma", personnage_appele: "emma",
      conversation_log: [{ role: "emma", content: "Bonjour" }],
    }).character_keys).toEqual([]);
  });

  it("preserves the actual sequence, returns and unique participants despite the final selection", () => {
    const session = { active_character: "leo", conversation_log: [
      { role: "max" }, { role: "user", spokenWith: "max" }, { role: "max" },
      { role: "user", spokenWith: "emma" }, { role: "max", spokenWith: "emma" },
      { role: "user", spokenWith: "max" }, { role: "max" },
    ] };
    expect(sessionCharacterMetadata(session)).toEqual({
      character_keys: ["max", "emma"], character_sequence: ["max", "emma", "max"],
      character_switch_count: 2, source: "conversation_log",
    });
    expect(sessionCharacterLabel(session)).toBe("Max → Emma → Max (2 personnages, 2 changements)");
  });

  it("supports legacy roles and a future character without assuming Max", () => {
    const session = { conversation_log: [{ role: "user" }, { role: "sam" }] };
    expect(sessionCharacterMetadata(session).character_keys).toEqual(["sam"]);
    expect(sessionCharacterOptions([session])).toContainEqual({ key: "sam", label: "Sam" });
    expect(sessionCharacterMetadata({ conversation_log: [{ role: "user" }, { role: "assistant" }] }).character_keys).toEqual([]);
  });
});
