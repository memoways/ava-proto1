import { describe, expect, it } from "vitest";
import { describeGmToCharacter, entryGmMode, findGmEntryForReply, sessionGmModeLabel } from "./gmInjectedView";

describe("GM -> character view", () => {
  it("shows the exact injected text with speech state and topics", () => {
    expect(describeGmToCharacter({ gm_mode: "full", injected: { text: "Laisse-le parler.", speechState: "Bloqué", topicsCovered: ["sœur"] } }))
      .toBe("Laisse-le parler. [état de parole proposé : Bloqué] [sujets déjà abordés : sœur]");
  });
  it("says why nothing was sent", () => {
    expect(describeGmToCharacter({ gm_mode: "off", injected: { text: "", speechState: null, topicsCovered: [] } })).toBe("rien : mode off");
    expect(describeGmToCharacter({ gm_mode: "light", injected: { text: "", speechState: null, topicsCovered: [] } })).toBe("rien : mode léger");
    expect(describeGmToCharacter({ gm_mode: "full", injected: { text: "", speechState: null, topicsCovered: [] } })).toMatch(/rien/);
    expect(describeGmToCharacter({ speech_guidance: "off" })).toBe("rien : mode léger");
    expect(describeGmToCharacter({})).toMatch(/antérieure/);
    expect(describeGmToCharacter(null)).toMatch(/non enregistré/);
  });
  it("reads the mode of entries logged before lot C", () => {
    expect(entryGmMode({ speech_guidance: "off" })).toBe("light");
    expect(entryGmMode({})).toBe("full");
    expect(entryGmMode({ gm_mode: "off" })).toBe("off");
    expect(sessionGmModeLabel([{ gm_mode: "off" }])).toBe("off");
    expect(sessionGmModeLabel([])).toBeNull();
  });
  it("matches a reply to the entry of its turn and character", () => {
    const entries = [{ turn_index: 1, character_key: "max" }, { turn_index: 2, character_key: "emma" }];
    expect(findGmEntryForReply(entries, 2, "emma")).toBe(entries[1]);
    expect(findGmEntryForReply(entries, 2, "max")).toBeNull();
    expect(findGmEntryForReply(entries, 0, "max")).toBeNull();
  });
});
