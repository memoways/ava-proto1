import { describe, expect, it } from "vitest";
import { buildExperienceFrame, experiencePathFromFilmAnswer, normalizeExperienceFrameConfig } from "@/services/experienceFrame";
import { normalizeDirectorConfig } from "@/services/experienceOrchestration";
import { restrictHandoffToActiveCharacters } from "@/agents/gameMasterPRD4";

const enabled = normalizeExperienceFrameConfig({ enabled: true });

describe("experienceFrame", () => {
  it("is off by default so existing behaviour is unchanged", () => {
    expect(buildExperienceFrame({ config: undefined, filmAnswer: "vu" }).prompt).toBe("");
  });

  it("maps film answers to paths", () => {
    expect(experiencePathFromFilmAnswer("vu")).toBe("seen");
    expect(experiencePathFromFilmAnswer("rappel")).toBe("seen");
    expect(experiencePathFromFilmAnswer("pas_vu")).toBe("unseen");
    expect(experiencePathFromFilmAnswer(null)).toBeNull();
  });

  it("uses the seen exposure rule only for the seen path", () => {
    const seen = buildExperienceFrame({ config: { ...enabled, exposureSeen: "SEEN", exposureUnseen: "UNSEEN" }, filmAnswer: "vu" });
    expect(seen.prompt).toContain("SEEN");
    expect(seen.prompt).not.toContain("UNSEEN");
    const unseen = buildExperienceFrame({ config: { ...enabled, exposureSeen: "SEEN", exposureUnseen: "UNSEEN" }, filmAnswer: "pas_vu" });
    expect(unseen.prompt).toContain("UNSEEN");
  });

  it("switches posture text from the setting", () => {
    expect(buildExperienceFrame({ config: { ...enabled, posture: "open" }, filmAnswer: "vu" }).prompt).toContain("plutôt ouvert");
    expect(buildExperienceFrame({ config: enabled, filmAnswer: "vu" }).prompt).toContain("pudique");
  });

  it("lists known player facts so they are not asked again", () => {
    const frame = buildExperienceFrame({ config: enabled, filmAnswer: "vu", knownAboutPlayer: ["prénom : Lina", ""] });
    expect(frame.prompt).toContain("prénom : Lina");
  });

  it("forbids spontaneous handoffs unless disabled", () => {
    expect(buildExperienceFrame({ config: enabled, filmAnswer: "vu" }).prompt).toContain("Ne renvoie jamais");
    expect(buildExperienceFrame({ config: { ...enabled, forbidSpontaneousHandoff: false }, filmAnswer: "vu" }).prompt).not.toContain("Ne renvoie jamais");
  });
});

describe("active characters", () => {
  it("defaults to every active character of the registry and ignores unavailable ones", () => {
    expect(normalizeDirectorConfig({}).activeCharacters).toEqual(["max", "emma"]);
    expect(normalizeDirectorConfig({ activeCharacters: ["emma", "ava"] }).activeCharacters).toEqual(["emma"]);
  });

  it("drops a GM handoff toward an inactive character or the current one", () => {
    const handoff = { type: "handoff", targetCharacter: "emma", reason: "r", proposalGuidance: "g" } as const;
    expect(restrictHandoffToActiveCharacters(handoff, ["max"], "max").type).toBe("none");
    expect(restrictHandoffToActiveCharacters(handoff, ["max", "emma"], "emma").type).toBe("none");
    expect(restrictHandoffToActiveCharacters(handoff, ["max", "emma"], "max").type).toBe("handoff");
  });
});
