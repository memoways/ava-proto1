import { describe, expect, it } from "vitest";
import publishedV7Prompt from "@/agents/fixtures/gm-published-sandbox-v7.txt?raw";
import { DEFAULT_DIRECTOR_CONFIG, normalizeDirectorConfig } from "@/services/experienceOrchestration";
import {
  buildExperienceDirectorPrompt,
  compileGmSettingsBlock,
  GM_SETTINGS_BLOCK_HEADER,
  stripCompiledSettingsBlock,
} from "@/services/gameMasterPromptBuilder";
import { GM_SETTINGS_REGISTRY, getGmSetting, settingFragments } from "@/services/gmSettingsRegistry";
import type { ExperienceDirectorConfig } from "@/types";

const withEditor = (patch: Partial<ExperienceDirectorConfig["editor"]>, rest: Partial<ExperienceDirectorConfig> = {}) =>
  normalizeDirectorConfig({ ...DEFAULT_DIRECTOR_CONFIG, ...rest, editor: { ...DEFAULT_DIRECTOR_CONFIG.editor, ...patch } });

const countOf = (text: string, needle: string) => text.split(needle).length - 1;

describe("gmSettingsRegistry", () => {
  it("describes every setting of the GM panel once, with a label and a destination", () => {
    const ids = GM_SETTINGS_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      "tone", "guidanceLength", "priorities", "allowHandoffs", "allowCinematics", "speechGuidance",
      "frameEnabled", "frameText", "frameExposure", "framePosture", "forbidSpontaneousHandoff", "activeCharacters",
      "minimumHandoffTurn", "maximumHandoffsPerSession", "minimumTurnsBetweenHandoffs", "directorTimeoutMs",
      "handoffRules", "projectContext", "openQuestions", "opennessPace", "derailTolerance", "falseStatusGuidance",
      "customInstructions", "characterTimeCues",
    ]));
    for (const entry of GM_SETTINGS_REGISTRY) {
      expect(entry.label.trim()).not.toBe("");
      const fragments = settingFragments(entry.id, DEFAULT_DIRECTOR_CONFIG);
      expect(fragments.length).toBeGreaterThan(0);
      for (const fragment of fragments) {
        expect(["gm_prompt", "character_prompt", "code"]).toContain(fragment.destination);
        expect(entry.destinations).toContain(fragment.destination);
        expect(fragment.text.trim()).not.toBe("");
      }
    }
  });

  it("renders the exact GM text for the current value", () => {
    const directive = withEditor({ tone: "directive" });
    expect(settingFragments("tone", directive)).toEqual([{ destination: "gm_prompt",
      text: "Posture du directeur : Directif : formule des guidances plus explicites pour faire avancer l'expérience." }]);
    const gm = (id: Parameters<typeof settingFragments>[0], config: ExperienceDirectorConfig) =>
      settingFragments(id, config).filter((fragment) => fragment.destination === "gm_prompt").map((fragment) => fragment.text).join("\n");
    // Every GM-prompt fragment is literally present in the compiled block.
    const block = compileGmSettingsBlock(directive);
    // The shared frame reaches the GM in its turn message (CADRE DE L'APPEL), not in this block.
    const frameIds = ["frameEnabled", "frameText", "frameExposure", "framePosture", "forbidSpontaneousHandoff"];
    for (const entry of GM_SETTINGS_REGISTRY.filter((candidate) => !frameIds.includes(candidate.id))) {
      const text = gm(entry.id, directive);
      if (text) for (const line of text.split("\n")) expect(block).toContain(line);
    }
    expect(gm("allowCinematics", withEditor({ allowCinematics: false })))
      .toContain("Cinématiques : désactivées");
    expect(gm("customInstructions", withEditor({ customInstructions: "Rester bref." })))
      .toBe("Instructions complémentaires :\nRester bref.");
  });

  it("states code effects in plain words and reacts to the value", () => {
    expect(settingFragments("directorTimeoutMs", DEFAULT_DIRECTOR_CONFIG)[0]).toMatchObject({ destination: "code" });
    expect(settingFragments("directorTimeoutMs", DEFAULT_DIRECTOR_CONFIG)[0].text).toContain("12000 ms");
    const off = settingFragments("speechGuidance", withEditor({ speechGuidance: false }));
    expect(off).toEqual([expect.objectContaining({ destination: "code" })]);
    expect(off[0].text).not.toBe(settingFragments("speechGuidance", DEFAULT_DIRECTOR_CONFIG)[0].text);
    expect(settingFragments("characterTimeCues", withEditor({ characterTimeCues: false }))[0].text).toMatch(/aucun repère/i);
    expect(settingFragments("characterTimeCues", DEFAULT_DIRECTOR_CONFIG)[0]).toMatchObject({ destination: "character_prompt" });
    expect(settingFragments("characterTimeCues", DEFAULT_DIRECTOR_CONFIG)[0].text).toContain("fin proche");
  });

  it("shows the frame texts as sent to the character and the GM, or that nothing is sent when off", () => {
    const on = normalizeDirectorConfig({ ...DEFAULT_DIRECTOR_CONFIG, frame: { ...DEFAULT_DIRECTOR_CONFIG.frame!, enabled: true } as never });
    const text = settingFragments("framePosture", on).map((fragment) => fragment.text).join("\n");
    expect(text).toMatch(/pudique|réserv|aide/i);
    expect(settingFragments("framePosture", on).map((fragment) => fragment.destination)).toEqual(["character_prompt", "gm_prompt"]);
    const off = settingFragments("frameText", DEFAULT_DIRECTOR_CONFIG);
    expect(off.every((fragment) => /désactivé/i.test(fragment.text))).toBe(true);
  });

  it("finds an entry by id", () => {
    expect(getGmSetting("tone").label).toBe("Posture du directeur");
  });
});

describe("runtime compilation of the settings block", () => {
  it("is stable: stripping then recompiling a compiled prompt gives the same text, without a double block", () => {
    for (const config of [DEFAULT_DIRECTOR_CONFIG, withEditor({ tone: "discreet", openQuestions: [], projectContext: "" })]) {
      const compiled = buildExperienceDirectorPrompt("BASE", config);
      expect(stripCompiledSettingsBlock(compiled)).toBe("BASE");
      expect(buildExperienceDirectorPrompt(stripCompiledSettingsBlock(compiled), config)).toBe(compiled);
      expect(countOf(buildExperienceDirectorPrompt(compiled, config), GM_SETTINGS_BLOCK_HEADER)).toBe(1);
    }
  });

  it("leaves a prompt without a compiled block untouched", () => {
    expect(stripCompiledSettingsBlock("  BASE\n\nAutre section.  ")).toBe("BASE\n\nAutre section.");
  });

  it("removes repeated frozen blocks and keeps text written after the block", () => {
    const twice = `${buildExperienceDirectorPrompt("BASE", DEFAULT_DIRECTOR_CONFIG)}\n\nNote finale.\n${buildExperienceDirectorPrompt("", DEFAULT_DIRECTOR_CONFIG)}`;
    const stripped = stripCompiledSettingsBlock(twice);
    expect(stripped).not.toContain(GM_SETTINGS_BLOCK_HEADER);
    expect(stripped).toContain("Note finale.");
    expect(stripped.startsWith("BASE")).toBe(true);
  });

  it("non-regression on the published sandbox v7 prompt at default settings", () => {
    const base = stripCompiledSettingsBlock(publishedV7Prompt);
    expect(publishedV7Prompt.startsWith(base)).toBe(true);
    expect(base).not.toContain("## CONTEXTE DU PROJET");
    expect(base.endsWith("Pas de markdown, pas de ```. Uniquement l'objet JSON.")).toBe(true);
    const recompiled = buildExperienceDirectorPrompt(base, DEFAULT_DIRECTOR_CONFIG);
    expect(countOf(recompiled, GM_SETTINGS_BLOCK_HEADER)).toBe(1);
    // Every frozen line comes back, except the wording updated since v7 for cinematics
    // and the off-world rule added since: equivalent text, current wording.
    const frozenLines = publishedV7Prompt.slice(base.length).split("\n").filter((line) => line.trim());
    const changed = frozenLines.filter((line) => !recompiled.includes(line));
    expect(changed).toEqual(["- Cinématiques : autorisées lorsqu'un thème correspond et que les garde-fous valident l'action."]);
    expect(recompiled).toContain("Hors-monde :");
  });
});
