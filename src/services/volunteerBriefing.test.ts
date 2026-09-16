import { beforeEach, describe, expect, it } from "vitest";
import {
  VOLUNTEER_BRIEFING_CARDS,
  VOLUNTEER_FRAME_FOR_CHARACTER,
  buildVolunteerRoleProfile,
  clearVolunteerBriefingProgress,
  getVolunteerBriefingProgress,
  saveVolunteerBriefingProgress,
} from "./volunteerBriefing";

describe("onboarding du bénévole", () => {
  beforeEach(() => {
    clearVolunteerBriefingProgress();
  });

  it("reste court : trois cartes maximum", () => {
    expect(VOLUNTEER_BRIEFING_CARDS.length).toBeLessThanOrEqual(3);
    expect(VOLUNTEER_BRIEFING_CARDS.length).toBeGreaterThan(0);
  });

  it("ne nomme aucun dispositif fictif ni personnage", () => {
    const text = VOLUNTEER_BRIEFING_CARDS.flatMap((c) => [c.title, ...c.paragraphs]).join(" ");
    expect(text).not.toMatch(/Max|Emma|Ava|Léo/);
    expect(text).toMatch(/dispositif de soutien/i);
  });

  it("interdit toute relation préalable dans le cadre transmis au personnage", () => {
    expect(VOLUNTEER_FRAME_FOR_CHARACTER).toMatch(/n'invente aucune rencontre antérieure/);
    expect(VOLUNTEER_FRAME_FOR_CHARACTER).toMatch(/confiance se construit progressivement/);
    expect(VOLUNTEER_FRAME_FOR_CHARACTER).toMatch(/ni psychologue ni professionnelle de santé/);
  });

  it("produit un profil joueur sans donnée personnelle", () => {
    const profile = buildVolunteerRoleProfile();
    expect(profile.created_by_system).toBe(true);
    expect(profile.raw_input).toBe("");
    expect(profile.age).toBe("");
    expect(profile.gender).toBe("");
    expect(profile.summary_for_max).toBe(VOLUNTEER_FRAME_FOR_CHARACTER);
  });

  it("mémorise la carte en cours puis la complétion", () => {
    saveVolunteerBriefingProgress({ lastCardIndex: 1 });
    expect(getVolunteerBriefingProgress()).toMatchObject({ completed: false, lastCardIndex: 1 });
    saveVolunteerBriefingProgress({ completed: true, lastCardIndex: 0 });
    expect(getVolunteerBriefingProgress().completed).toBe(true);
  });

  it("ignore une progression enregistrée dans une version antérieure", () => {
    localStorage.setItem(
      "ava_volunteer_briefing",
      JSON.stringify({ version: "2000-01-01", completed: true, lastCardIndex: 2, replays: 3 }),
    );
    expect(getVolunteerBriefingProgress()).toMatchObject({ completed: false, lastCardIndex: 0 });
  });
});
