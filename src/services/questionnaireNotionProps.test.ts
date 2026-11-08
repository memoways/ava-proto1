import { describe, expect, it } from "vitest";
import {
  buildQuestionnaireProps,
  conversationalScore,
  CONVERSATIONAL_SCORE_COLUMNS,
} from "../../supabase/functions/_shared/questionnaireNotionProps";
import { buildSessionContext, CONVERSATIONAL_DIMENSIONS, emptyDimensionAnswer } from "./conversationalQuestionnaire";
import type { QuestionnaireConversationalData } from "@/types";

function conversational(scores: Record<string, unknown>): QuestionnaireConversationalData {
  const dimensions = Object.fromEntries(CONVERSATIONAL_DIMENSIONS.map((key) => [key, {
    ...emptyDimensionAnswer(`Q ${key}`),
    answer: `Réponse ${key}`,
    score: key in scores ? scores[key] : null,
    score_source: key in scores && scores[key] != null ? "touch" : null,
  }])) as QuestionnaireConversationalData["dimensions"];
  dimensions.immersion.follow_up = { question: "Qu'est-ce qui l'a cassée ?", answer: "Un silence" };
  dimensions.immersion.score_comment = "plutôt bien";
  return {
    version: "conversational-v1",
    submitted_at: "2026-11-08T10:00:00.000Z",
    dimensions,
    summary: { text: "Synthèse validée", edited_by_user: true, validated_at: "2026-11-08T10:00:00.000Z" },
    consent: { transcript_storage: true, contact_email: "a@b.ch", opt_in_updates: true, opt_in_feedback: false },
    session_context: buildSessionContext({
      sessionId: "abcdef1234", film: "rappel", teaserSeen: true, teaserSkipped: false, startingCharacter: "max",
      conversation: [
        { role: "max", content: "Salut", timestamp: 1 },
        { role: "user", content: "Emma ?", timestamp: 2 },
        { role: "emma", content: "Oui", timestamp: 3 },
      ],
      watchedVideos: [], durationSeconds: 420, turnLatenciesMs: [1200, 1800], micErrors: 1, handsFree: true,
      endReason: "timer", deviceClass: "smartphone", callMode: "tts", avatarFallback: false,
      roleProfile: null, posture: null,
    }),
  };
}

describe("sync-questionnaire — conversational-v1", () => {
  it("une note null ou 0 n'écrit rien : la cellule reste vide", () => {
    const props = buildQuestionnaireProps({ sessionId: "abcdef1234",
      questionnaire: conversational({ fluidity: 4, interest: 0, immersion: null }) as never });
    expect(props["Conv Fluidité"]).toEqual({ number: 4 });
    expect(props).not.toHaveProperty("Conv Intérêt");
    expect(props).not.toHaveProperty("Conv Immersion");
    expect(props).not.toHaveProperty("Conv Crédibilité");
    expect(props).not.toHaveProperty("Conv Engagement");
    expect(Object.values(CONVERSATIONAL_SCORE_COLUMNS).some((column) => (props[column] as { number?: number })?.number === 0)).toBe(false);
  });

  it("envoie le contexte de session vers les colonnes PRD4 techniques existantes", () => {
    const props = buildQuestionnaireProps({ sessionId: "abcdef1234", questionnaire: conversational({}) as never });
    expect(props).toMatchObject({
      "Nom": { title: [{ text: { content: "Conv abcdef12" } }] },
      "Session ID": { rich_text: [{ text: { content: "abcdef1234" } }] },
      "Date soumission": { date: { start: "2026-11-08T10:00:00.000Z" } },
      "PRD4 A vu le film": { select: { name: "Oui" } },
      "PRD4 Teaser vu": { checkbox: true },
      "PRD4 Personnage actif": { select: { name: "Max" } },
      "PRD4 Durée réelle secondes": { number: 420 },
      "PRD4 Nb tours": { number: 1 },
      "PRD4 Latence moyenne ms": { number: 1500 },
      "PRD4 Latence max ms": { number: 1800 },
      "PRD4 Erreurs PTT": { number: 1 },
      "PRD4 Raison fin": { rich_text: [{ text: { content: "timer" } }] },
      "PRD4 Email contact": { email: "a@b.ch" },
      "PRD4 Être tenu au courant": { checkbox: true },
      "PRD4 Contact feedback détaillé": { checkbox: false },
    });
  });

  it("écrit verbatims, synthèse, version, appareil, mode d'appel et personnages dans les colonnes Conv", () => {
    const props = buildQuestionnaireProps({ sessionId: "abcdef1234", questionnaire: conversational({}) as never });
    expect(props["Conv Immersion verbatim"]).toEqual({ rich_text: [{ text: {
      content: "Réponse immersion\n\nRelance — Qu'est-ce qui l'a cassée ?\nUn silence\n\nNote — plutôt bien" } }] });
    expect(props).toMatchObject({
      "Conv Synthèse": { rich_text: [{ text: { content: "Synthèse validée" } }] },
      "Conv Version": { select: { name: "conversational-v1" } },
      "Conv Appareil": { select: { name: "Smartphone" } },
      "Conv Mode appel": { select: { name: "Voix seule" } },
      "Conv Personnages appelés": { multi_select: [{ name: "Max" }, { name: "Emma" }] },
      "Conv Passages": { number: 1 },
    });
  });

  it("découpe un long verbatim en morceaux acceptés par Notion", () => {
    const data = conversational({});
    data.dimensions.fluidity.answer = "a".repeat(4000);
    const props = buildQuestionnaireProps({ sessionId: "s", questionnaire: data as never });
    const chunks = (props["Conv Fluidité verbatim"] as { rich_text: { text: { content: string } }[] }).rich_text;
    expect(chunks.map((chunk) => chunk.text.content.length)).toEqual([1900, 1900, 200]);
  });

  it("n'écrit aucune colonne de réponse PRD4 ni legacy", () => {
    const props = buildQuestionnaireProps({ sessionId: "s", questionnaire: conversational({ fluidity: 3 }) as never });
    for (const column of ["PRD4 Max crédible personnage", "PRD4 Durée ressentie", "PRD4 Personnage souhaité prochain",
      "PRD4 Rupture immersion", "Note experience", "NPS", "Immersion histoire"]) {
      expect(props).not.toHaveProperty(column);
    }
  });

  it("garde le score strict : seul un entier 1–5 passe", () => {
    expect([0, 1, 5, 6, 3.5, null, "4"].map(conversationalScore)).toEqual([null, 1, 5, null, null, null, null]);
  });
});

describe("sync-questionnaire — branches existantes inchangées", () => {
  it("PRD4 garde ses colonnes et son titre", () => {
    const props = buildQuestionnaireProps({
      sessionId: "prd4session",
      questionnaire: {
        version: "prd4",
        answers: { q1_film_seen: "non", q7_max_credible: 3, q9_duration_feeling: "juste", q8b_next_character_wanted: "max",
          q10_open_feedback: "Rien", opt_in_updates: false, opt_in_feedback: true },
        technical: { submitted_at: "2026-11-01T00:00:00.000Z", active_character: "max", duration_seconds: 300, turn_count: 6,
          teaser_seen: true },
      },
    });
    expect(props).toEqual({
      "Nom": { title: [{ text: { content: "PRD4 prd4sess" } }] },
      "Session ID": { rich_text: [{ text: { content: "prd4session" } }] },
      "Date soumission": { date: { start: "2026-11-01T00:00:00.000Z" } },
      "PRD4 A vu le film": { select: { name: "Non" } },
      "PRD4 Teaser vu": { checkbox: true },
      "PRD4 Teaser skippé": { checkbox: false },
      "PRD4 Max crédible personnage": { number: 3 },
      "PRD4 Personnage souhaité prochain": { select: { name: "Max encore" } },
      "PRD4 Durée ressentie": { select: { name: "Juste" } },
      "PRD4 Rupture immersion": { rich_text: [{ text: { content: "Rien" } }] },
      "PRD4 Être tenu au courant": { checkbox: false },
      "PRD4 Contact feedback détaillé": { checkbox: true },
      "PRD4 Personnage actif": { select: { name: "Max" } },
      "PRD4 Durée réelle secondes": { number: 300 },
      "PRD4 Nb tours": { number: 6 },
      "PRD4 Transcript disponible": { checkbox: false },
    });
  });

  it("legacy (sans version) garde ses colonnes historiques", () => {
    const props = buildQuestionnaireProps({
      sessionId: "legacy1234",
      trustLevel: 40,
      durationSeconds: 200,
      variant: "A",
      questionnaire: { experience_rating: 8, nps: 9, latency_perceived: "fluide", open_feedback: "Bien", opt_in_updates: true },
    });
    expect(props).toMatchObject({
      "Nom": { title: [{ text: { content: "Session legacy12" } }] },
      "Variante onboarding": { select: { name: "A" } },
      "Trust final": { number: 40 },
      "Duree secondes": { number: 200 },
      "Note experience": { number: 8 },
      "NPS": { number: 9 },
      "Latence percue": { select: { name: "Fluide" } },
      "Feedback ouvert": { rich_text: [{ text: { content: "Bien" } }] },
      "Opt-in updates": { checkbox: true },
    });
    expect(Object.keys(props).some((key) => key.startsWith("Conv ") || key.startsWith("PRD4 "))).toBe(false);
  });
});
