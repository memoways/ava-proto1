import type { CharacterHandoffAssessment, CharacterHandoffValidationInput } from "./characterHandoff";

/** Minimal excerpts documented in docs/plan_changement_interlocuteur_manuel.md §2.
 * Ellipses/private continuations are deliberately not reconstructed as quotes.
 */
export const HANDOFF_SESSION_EXCERPTS = {
  t6: {
    user: "est-ce que je pourrais parler avec lui",
    reply: "Je peux lui demander, mais je ne vais pas lui passer le téléphone sans lui expliquer. Quelle est votre question ?",
  },
  t9: { reply: "Je vais lui demander de vous parler. Mais je ne sais pas s’il a digéré quoi que ce soit" },
  t10: {
    user: "Ok, Matt, j’aimerais bien pouvoir lui parler.",
    reply: "Je vais l’appeler. C’est Max, pas Matt.",
    consent: "Je vais l’appeler.",
  },
  t11: {
    user: "Alors j’aimerais bien parler avec Max. Comment je peux faire ?",
    reply: "Je vais aller le chercher dans le salon et lui dire que vous voulez lui parler directement.",
  },
} as const;

export function validAssessment(): CharacterHandoffAssessment {
  return {
    schemaVersion: 1, turnId: "session:11", turnIndex: 11, orchestrationVersionId: "v6",
    sourceCharacter: "emma", targetCharacter: "max",
    origin: { type: "player_request", turnId: "session:11", turnIndex: 11, evidence: HANDOFF_SESSION_EXCERPTS.t11.user },
    targetEvidence: { speaker: "user", quote: "parler avec Max" },
    consent: { stance: "accept", evidence: HANDOFF_SESSION_EXCERPTS.t11.reply, refusalEvidence: null },
  };
}

export function validInput(): CharacterHandoffValidationInput {
  return {
    currentCharacter: "emma", turnId: "session:11", turnIndex: 11, orchestrationVersionId: "v6",
    userText: HANDOFF_SESSION_EXCERPTS.t11.user,
    delivery: {
      turnId: "session:11", turnIndex: 11, character: "emma", generated: HANDOFF_SESSION_EXCERPTS.t11.reply,
      delivered: HANDOFF_SESSION_EXCERPTS.t11.reply, uncertain: "", privateContinuation: "", status: "completed",
      intent: null, scheduledSamples: null, playedSamples: null, sampleRate: null,
    },
    evaluation: {
      execution_status: "executed", character_key: "emma", turn_index: 11, orchestration_version_id: "v6",
      action: { type: "handoff", targetCharacter: "max", reason: "accord", proposalGuidance: "Appeler Max" },
      handoff_assessment: validAssessment(),
    },
  };
}
