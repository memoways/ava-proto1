import { describe, expect, it } from "vitest";
import { isGmSpeechGuidanceEnabled, joinGuidanceParts, resolveCharacterGuidance } from "./gmSpeechGuidance";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "./experienceOrchestration";

describe("GM speech guidance switch", () => {
  it("is on by default and for versions published before the switch", () => {
    expect(DEFAULT_DIRECTOR_CONFIG.editor.speechGuidance).toBe(true);
    expect(normalizeDirectorConfig({ editor: { tone: "balanced" } } as never).editor.speechGuidance).toBe(true);
    expect(normalizeDirectorConfig(null).editor.speechGuidance).toBe(true);
    expect(isGmSpeechGuidanceEnabled(null)).toBe(true);
    expect(isGmSpeechGuidanceEnabled({ editor: {} } as never)).toBe(true);
  });

  it("is off only for an explicit false, which survives a save/reload round trip", () => {
    const saved = JSON.parse(JSON.stringify(normalizeDirectorConfig({ editor: { speechGuidance: false } } as never)));
    expect(normalizeDirectorConfig(saved).editor.speechGuidance).toBe(false);
    expect(isGmSpeechGuidanceEnabled(saved)).toBe(false);
    expect(normalizeDirectorConfig({ editor: { speechGuidance: "false" } } as never).editor.speechGuidance).toBe(true);
  });

  it("joins parts exactly like the historical guidance string", () => {
    expect(joinGuidanceParts([{ kind: "gm_advice", text: "A." }, { kind: "switch_request", text: "B." }])).toBe("A. B.");
    expect(joinGuidanceParts([{ kind: "gm_advice", text: "  " }])).toBeNull();
  });

  it("passes everything through unchanged when on", () => {
    const resolved = resolveCharacterGuidance({ enabled: true, legacyGuidance: "Conseil.", topicsCovered: ["a"], speechState: "Bloqué" });
    expect(resolved).toEqual({ mode: "on", guidance: "Conseil.", topicsCovered: ["a"], speechState: "Bloqué",
      withheld: { advice: null, speechState: null, topicsCovered: 0 } });
  });

  it("withholds only the GM advice, the proposed speech state and the topics when off", () => {
    const resolved = resolveCharacterGuidance({ enabled: false, topicsCovered: ["a", "b"], speechState: "Bloqué", parts: [
      { kind: "gm_advice", text: "Conseil." }, { kind: "handoff_proposal", text: "Propose Emma." }, { kind: "switch_request", text: "Règle." },
    ] });
    expect(resolved).toEqual({ mode: "off", guidance: "Propose Emma. Règle.", topicsCovered: [], speechState: null,
      withheld: { advice: "Conseil.", speechState: "Bloqué", topicsCovered: 2 } });
    expect(resolveCharacterGuidance({ enabled: false, legacyGuidance: "Conseil." }).guidance).toBeNull();
  });
});
