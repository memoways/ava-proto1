import { describe, expect, it } from "vitest";
import { isGmSpeechGuidanceEnabled, joinGuidanceParts, resolveCharacterGuidance, resolveGmMode } from "./gmSpeechGuidance";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "./experienceOrchestration";

describe("GM mode (off / light / full)", () => {
  it("is full by default and for versions published before the switch", () => {
    expect(DEFAULT_DIRECTOR_CONFIG.editor.gmMode).toBe("full");
    expect(normalizeDirectorConfig({ editor: { tone: "balanced" } } as never).editor.gmMode).toBe("full");
    expect(normalizeDirectorConfig(null).editor.gmMode).toBe("full");
    expect(resolveGmMode(null)).toBe("full");
    expect(resolveGmMode({ editor: {} } as never)).toBe("full");
    expect(isGmSpeechGuidanceEnabled(null)).toBe(true);
  });

  it("maps the legacy speechGuidance boolean: false -> light, anything else -> full", () => {
    expect(normalizeDirectorConfig({ editor: { speechGuidance: false } } as never).editor.gmMode).toBe("light");
    expect(normalizeDirectorConfig({ editor: { speechGuidance: true } } as never).editor.gmMode).toBe("full");
    expect(normalizeDirectorConfig({ editor: { speechGuidance: "false" } } as never).editor.gmMode).toBe("full");
    expect(resolveGmMode({ editor: { speechGuidance: false } } as never)).toBe("light");
    expect(isGmSpeechGuidanceEnabled({ editor: { speechGuidance: false } } as never)).toBe(false);
  });

  it("keeps an explicit gmMode over the legacy boolean and survives a save/reload round trip", () => {
    for (const mode of ["off", "light", "full"] as const) {
      const saved = JSON.parse(JSON.stringify(normalizeDirectorConfig({ editor: { gmMode: mode, speechGuidance: true } } as never)));
      expect(normalizeDirectorConfig(saved).editor.gmMode).toBe(mode);
      expect(resolveGmMode(saved)).toBe(mode);
      expect("speechGuidance" in saved.editor).toBe(false);
    }
    expect(normalizeDirectorConfig({ editor: { gmMode: "bogus" } } as never).editor.gmMode).toBe("full");
    expect(isGmSpeechGuidanceEnabled({ editor: { gmMode: "off" } } as never)).toBe(false);
  });

  it("off also drops a GM handoff proposal but keeps the player's explicit switch rule", () => {
    const resolved = resolveCharacterGuidance({ enabled: false, gmMode: "off", topicsCovered: ["a"], speechState: "Bloqué", parts: [
      { kind: "gm_advice", text: "Conseil." }, { kind: "handoff_proposal", text: "Propose Emma." }, { kind: "switch_request", text: "Règle." },
    ] });
    expect(resolved.guidance).toBe("Règle.");
    expect(resolved.injected).toEqual({ text: "Règle.", speechState: null, topicsCovered: [] });
  });

  it("exposes the exact text injected into the character", () => {
    const full = resolveCharacterGuidance({ enabled: true, legacyGuidance: "Conseil.", topicsCovered: ["a"], speechState: "Bloqué" });
    expect(full.injected).toEqual({ text: "Conseil.", speechState: "Bloqué", topicsCovered: ["a"] });
    expect(resolveCharacterGuidance({ enabled: false, legacyGuidance: "Conseil." }).injected)
      .toEqual({ text: "", speechState: null, topicsCovered: [] });
  });

  it("joins parts exactly like the historical guidance string", () => {
    expect(joinGuidanceParts([{ kind: "gm_advice", text: "A." }, { kind: "switch_request", text: "B." }])).toBe("A. B.");
    expect(joinGuidanceParts([{ kind: "gm_advice", text: "  " }])).toBeNull();
  });

  it("passes everything through unchanged when on", () => {
    const resolved = resolveCharacterGuidance({ enabled: true, legacyGuidance: "Conseil.", topicsCovered: ["a"], speechState: "Bloqué" });
    expect(resolved).toMatchObject({ mode: "on", guidance: "Conseil.", topicsCovered: ["a"], speechState: "Bloqué",
      withheld: { advice: null, speechState: null, topicsCovered: 0 } });
  });

  it("withholds only the GM advice, the proposed speech state and the topics when off", () => {
    const resolved = resolveCharacterGuidance({ enabled: false, topicsCovered: ["a", "b"], speechState: "Bloqué", parts: [
      { kind: "gm_advice", text: "Conseil." }, { kind: "handoff_proposal", text: "Propose Emma." }, { kind: "switch_request", text: "Règle." },
    ] });
    expect(resolved).toMatchObject({ mode: "off", guidance: "Propose Emma. Règle.", topicsCovered: [], speechState: null,
      withheld: { advice: "Conseil.", speechState: "Bloqué", topicsCovered: 2 } });
    expect(resolveCharacterGuidance({ enabled: false, legacyGuidance: "Conseil." }).guidance).toBeNull();
  });
});
