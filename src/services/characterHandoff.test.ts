import { describe, expect, it } from "vitest";
import { detectPlayerSwitchRequest, hasCharacterHandoffConsent } from "./characterConversation";
import { HANDOFF_SESSION_EXCERPTS as excerpts, validAssessment, validInput } from "./characterHandoff.fixtures";
import { cleanHandoffAssessment, handoffSpeechEvidence, materializeHandoffAssessment, validateCharacterHandoff } from "./characterHandoff";
import type { CharacterHandoffAssessment, CharacterHandoffValidationInput } from "./characterHandoff";

function withReply(reply: string, evidence = reply): CharacterHandoffValidationInput {
  const input = validInput();
  input.delivery = { ...input.delivery!, generated: reply, delivered: reply };
  input.evaluation.handoff_assessment = { ...validAssessment(), consent: { stance: "accept", evidence, refusalEvidence: null } };
  return input;
}

describe('referenced GM evidence', () => {
  const decision = { schemaVersion: 2, requestSource: 'current_user', targetCharacter: 'max',
    stance: 'accept', refusal: false, consentRef: 'speech_0' };
  it.each([['emma', 'max'], ['max', 'emma']] as const)('materializes grounded confirmation %s → %s', (source, target) => {
    const input = withReply(`D’accord, je te passe ${target === 'max' ? 'Max' : 'Emma'} au téléphone.`);
    input.currentCharacter = source; input.evaluation.character_key = source; input.delivery!.character = source;
    input.userText = 'Oui, je veux bien.';
    input.evaluation.action = { type: 'handoff', targetCharacter: target, reason: 'accord', proposalGuidance: '' };
    input.evaluation.handoff_assessment = materializeHandoffAssessment({ ...decision, targetCharacter: target }, input);
    expect(validateCharacterHandoff(input).authorized).toBe(true);
    expect(input.evaluation.handoff_assessment!.origin.evidence).toBe(input.userText);
  });
  it('rejects an agreement selected from the generated but unheard continuation', () => {
    const input = withReply('Bonjour. Je te passe Max au téléphone.');
    input.delivery!.delivered = 'Bonjour.'; input.delivery!.status = 'interrupted';
    const evidence = handoffSpeechEvidence(input.delivery);
    expect(evidence[1]).toEqual({ ref: 'speech_1', text: 'Je te passe Max au téléphone.', delivered: false });
    input.evaluation.handoff_assessment = materializeHandoffAssessment({ ...decision, consentRef: 'speech_1' }, input);
    expect(validateCharacterHandoff(input)).toMatchObject({ authorized: false, reason: 'consent_not_delivered' });
  });
  it.each([
    { ...decision, consentRef: 'speech_99' }, { ...decision, requestSource: 'history' },
    { ...decision, turnId: 'invented' }, { ...decision, refusal: undefined },
    { ...decision, consentRef: undefined },
  ])('fails closed on invalid wire references %j', raw => {
    expect(materializeHandoffAssessment(raw, validInput())).toBeNull();
  });
  it('requires the actual runtime context and its matching receipt', () => {
    expect(materializeHandoffAssessment(decision, null)).toBeNull();
    const input = validInput(); input.delivery!.turnId = 'old';
    expect(materializeHandoffAssessment(decision, input)).toBeNull();
  });
  it('cannot invent a target from an unrelated old transcript', () => {
    const input = withReply('Oui, je te le passe.'); input.userText = 'Oui.';
    expect(materializeHandoffAssessment(decision, input)).toBeNull();
  });
  it('keeps closed and expired requests closed', () => {
    const input = validInput();
    expect(materializeHandoffAssessment({ ...decision, requestSource: 'open_request' }, input)).toBeNull();
    input.openRequest = { turnId: 'session:8', turnIndex: 8, expiresAfterTurnIndex: 10,
      userText: input.userText, sourceCharacter: 'emma', targetCharacter: 'max', orchestrationVersionId: 'v6' };
    input.evaluation.handoff_assessment = materializeHandoffAssessment({ ...decision, requestSource: 'open_request' }, input);
    expect(validateCharacterHandoff(input).reason).toBe('request_unresolved');
  });
  it('retains refusal priority and deferral with referenced speech', () => {
    const input = validInput();
    input.evaluation.handoff_assessment = materializeHandoffAssessment({ ...decision, refusal: true }, input);
    expect(validateCharacterHandoff(input).reason).toBe('character_refused');
    input.evaluation.handoff_assessment = materializeHandoffAssessment({ ...decision, stance: 'defer' }, input);
    expect(validateCharacterHandoff(input).reason).toBe('character_deferred');
  });
  it('does not repair an invalid historical proof into a referenced agreement', () => {
    const input = validInput(); const proof = validAssessment(); proof.origin.turnId = 'old';
    const before = structuredClone(proof);
    input.evaluation.handoff_assessment = materializeHandoffAssessment(proof, input);
    expect(input.evaluation.handoff_assessment).toEqual(before);
    expect(proof).toEqual(before);
    expect(validateCharacterHandoff(input).reason).toBe('request_unresolved');
  });
});

describe("historical filters — characterization, deliberately unchanged", () => {
  it("does not globally alias Matt or resolve lui", () => {
    expect(detectPlayerSwitchRequest(excerpts.t6.user, "emma")).toBeNull();
    expect(detectPlayerSwitchRequest(excerpts.t10.user, "emma")).toBeNull();
    expect(detectPlayerSwitchRequest(excerpts.t11.user, "emma")).toBe("max");
  });
  it.fails.each([excerpts.t10.reply, excerpts.t11.reply])("reproduces the old false negative: %s", reply => {
    expect(hasCharacterHandoffConsent(reply, "max", "accept")).toBe(true);
  });
});

describe("structured consent — pure validator", () => {
  it('keeps the real T11 acceptance blocked when GM invents an old request origin', () => {
    const reply = 'Oui, il est d’accord. Je te le passe au téléphone maintenant ; je ne resterai pas à côté et je n’écouterai pas votre conversation.';
    const input = withReply(reply);
    input.userText = "Qu'est-ce qu'il dit Max Il est ok";
    input.openRequest = null;
    const proof = input.evaluation.handoff_assessment!;
    proof.origin = { type: 'player_request', turnId: 'session:8', turnIndex: 8,
      evidence: 'tu penses que ce serait possible que je parle avec Max' };
    proof.targetEvidence = { speaker: 'user', quote: 'Max' };
    expect(validateCharacterHandoff(input)).toMatchObject({ authorized: false, reason: 'request_unresolved' });
    // The same acceptance needs genuinely current evidence classified by the GM;
    // the runtime must never rewrite the invalid old origin into this one.
    proof.origin = { type: 'player_request', turnId: input.turnId, turnIndex: input.turnIndex, evidence: input.userText };
    expect(validateCharacterHandoff(input)).toMatchObject({ authorized: true, reason: 'consent_validated' });
    proof.origin.evidence = 'tu penses que ce serait possible que je parle avec Max';
    expect(validateCharacterHandoff(input)).toMatchObject({ authorized: false, reason: 'request_unresolved' });
  });
  it("accepts T11 only with grounded current evidence", () => {
    expect(validateCharacterHandoff(validInput())).toEqual({ authorized: true, reason: "consent_validated", targetCharacter: "max" });
  });
  it("accepts T10 with Max resolved in the delivered correction", () => {
    const input = withReply(excerpts.t10.reply, excerpts.t10.consent);
    input.userText = excerpts.t10.user;
    input.evaluation.handoff_assessment = {
      ...input.evaluation.handoff_assessment!,
      origin: { ...validAssessment().origin, evidence: excerpts.t10.user },
      targetEvidence: { speaker: "character", quote: "C’est Max, pas Matt." },
    };
    expect(validateCharacterHandoff(input).authorized).toBe(true);
  });
  it.each([
    [excerpts.t6.reply, "character_refused"],
    [excerpts.t9.reply, "character_deferred"],
    ["Je peux peut-être lui proposer de venir, à condition qu’il accepte de parler vraiment.", "character_deferred"],
  ])("keeps a semantically deferred reply blocked: %s", (reply, reason) => {
    const input = withReply(reply);
    input.evaluation.handoff_assessment!.consent.stance = "defer";
    expect(validateCharacterHandoff(input)).toMatchObject({ authorized: false, reason });
  });
  it.each([
    "Je ne vais pas te le passer.", "Je vais pas te le passer.", "Je te le passe pas.",
    "Tu peux pas appeler Max.", "Je peux pas te passer Max.", "N’appelle pas Max.",
    "Je ne vais pas l’appeler.", "Je vais pas l’appeler.", "Je vais l’appeler. Finalement non.", "Je vais l’appeler. Non.",
    "Je vais l’appeler plus tard.", "Plus tard.", "Je vais lui demander s’il accepte.",
    "Je vais l’appeler… enfin non.", "Je vais l’appeler ? Non, je refuse de vous le passer.",
    "Je vais l’appeler. Mais je ne vais pas te le passer.",
  ])("vetoes explicit refusal/defer even if GM says accept: %s", reply => {
    expect(validateCharacterHandoff(withReply(reply, reply.includes("Je vais l’appeler") ? "Je vais l’appeler" : reply)).authorized).toBe(false);
  });
  it("does not veto general concern about Max", () => {
    expect(validateCharacterHandoff(withReply("Je vais l’appeler. Je ne sais pas s’il a digéré quoi que ce soit.", "Je vais l’appeler.")).authorized).toBe(true);
  });
  it("does not turn a refusal to believe Max's feelings into a transfer veto", () => {
    expect(validateCharacterHandoff(withReply("Je vais l’appeler. Je refuse de croire qu’il me déteste.", "Je vais l’appeler.")).authorized).toBe(true);
  });
  it.each([
    "Je ne suis pas passionnée par sa réaction.",
    "Je n’ai pas passé un bon moment avec Max.",
    "Je ne cherche pas à le brusquer.",
  ])("limits transfer vetoes to actual transfer objects: %s", concern => {
    expect(validateCharacterHandoff(withReply(`Je vais l’appeler. ${concern}`, "Je vais l’appeler.")).authorized).toBe(true);
  });
  it("rejects an affirmative excerpt inside a refusal", () => {
    expect(validateCharacterHandoff(withReply("Je ne vais pas dire « Je vais l’appeler » : je refuse de le passer.", "Je vais l’appeler")).reason).toBe("character_refused");
  });
  it.each(["lui", "Matt", "Emma"])("requires explicit coherent target grounding: %s", quote => {
    const input = validInput();
    input.userText = `Je voudrais parler à ${quote}`;
    input.evaluation.handoff_assessment!.origin.evidence = input.userText;
    input.evaluation.handoff_assessment!.targetEvidence = { speaker: "user", quote };
    expect(validateCharacterHandoff(input).reason).toBe("request_unresolved");
  });
  it("does not turn an unrelated yes into permission", () => {
    const input = withReply("Oui.");
    input.userText = "Tu as vu Max hier ?";
    input.evaluation.handoff_assessment!.origin.evidence = input.userText;
    input.evaluation.handoff_assessment!.targetEvidence.quote = "Max";
    expect(validateCharacterHandoff(input).reason).toBe("request_unresolved");
  });
  it("accepts a short yes to a grounded direct switch request", () => {
    expect(validateCharacterHandoff(withReply("Oui.")).authorized).toBe(true);
  });
  it("does not reapply the old request regex to a contextual short yes", () => {
    const input = withReply("Oui. C’est Max, pas Matt.", "Oui.");
    input.userText = excerpts.t10.user;
    input.evaluation.handoff_assessment!.origin.evidence = input.userText;
    input.evaluation.handoff_assessment!.targetEvidence = { speaker: "character", quote: "C’est Max, pas Matt." };
    expect(validateCharacterHandoff(input).authorized).toBe(true);
  });
  it("does not mistake an unrelated later event for transfer deferral", () => {
    expect(validateCharacterHandoff(withReply("Je vais l’appeler. Ava rentre plus tard.", "Je vais l’appeler.")).authorized).toBe(true);
  });
  it.each([null, undefined, {}, { schemaVersion: 2 }, { ...validAssessment(), consent: { stance: "accept" } }])("fails closed on missing/invalid contract %j", raw => {
    expect(cleanHandoffAssessment(raw)).toBeNull();
    const input = validInput();
    input.evaluation.handoff_assessment = raw as CharacterHandoffAssessment;
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it.each(["", "Je vais", "Avant de répondre. "])("requires delivered consent, not generated text: %s", delivered => {
    const input = validInput();
    input.delivery!.delivered = delivered;
    input.delivery!.status = "interrupted";
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it("rejects a consent marked uncertain rather than delivered", () => {
    const input = validInput();
    input.delivery!.delivered = "";
    input.delivery!.uncertain = input.delivery!.generated;
    expect(validateCharacterHandoff(input).reason).toBe("consent_not_delivered");
  });
  it("requires a delivery receipt", () => {
    const input = validInput(); input.delivery = null;
    expect(validateCharacterHandoff(input).reason).toBe("consent_not_delivered");
  });
  it("requires consent evidence to exist verbatim", () => {
    expect(validateCharacterHandoff(withReply(excerpts.t11.reply, "Tu peux appeler Max.")).reason).toBe("consent_evidence_missing");
  });
  it("rejects invented contradictory evidence", () => {
    const input = validInput(); input.evaluation.handoff_assessment!.consent.refusalEvidence = "Je refuse.";
    expect(validateCharacterHandoff(input).reason).toBe("consent_evidence_missing");
  });
  it("requires the request evidence itself to exist", () => {
    const input = validInput(); input.evaluation.handoff_assessment!.origin.evidence = "Appelle Max.";
    expect(validateCharacterHandoff(input).reason).toBe("request_unresolved");
  });
  it("requires target evidence to exist, not just name Max", () => {
    const input = validInput(); input.evaluation.handoff_assessment!.targetEvidence.quote = "Max accepte";
    expect(validateCharacterHandoff(input).reason).toBe("request_unresolved");
  });
  it("supports Max to Emma with a new independent assessment", () => {
    const input = withReply("Tu peux appeler Emma.");
    input.currentCharacter = "max"; input.userText = "Je voudrais parler avec Emma.";
    input.delivery!.character = "max"; input.evaluation.character_key = "max";
    input.evaluation.action = { type: "handoff", targetCharacter: "emma", reason: "accord", proposalGuidance: "Appeler Emma" };
    const assessment = input.evaluation.handoff_assessment!;
    assessment.sourceCharacter = "max"; assessment.targetCharacter = "emma";
    assessment.origin.evidence = input.userText; assessment.targetEvidence.quote = "parler avec Emma";
    expect(validateCharacterHandoff(input)).toEqual({ authorized: true, reason: "consent_validated", targetCharacter: "emma" });
  });
  it.each(["turnId", "turnIndex", "orchestrationVersionId", "sourceCharacter", "targetCharacter"] as const)("rejects inconsistent assessment %s", field => {
    const input = validInput();
    const assessment = input.evaluation.handoff_assessment!;
    Object.assign(assessment, { [field]: field === "turnIndex" ? 10 : field === "sourceCharacter" ? "max" : field === "targetCharacter" ? "emma" : "old" });
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it.each(["failed", "invalid", undefined] as const)("rejects GM status %s", execution_status => {
    const input = validInput(); input.evaluation.execution_status = execution_status;
    expect(validateCharacterHandoff(input).reason).toBe("gm_not_executed");
  });
  it("requires a matching handoff action", () => {
    const input = validInput(); input.evaluation.action = { type: "none" };
    expect(validateCharacterHandoff(input).reason).toBe("action_mismatch");
  });
  it.each(["turnId", "turnIndex", "character"])("rejects a receipt from another %s", field => {
    const input = validInput(); Object.assign(input.delivery!, { [field]: field === "turnIndex" ? 10 : field === "character" ? "max" : "old" });
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it.each(["turn_index", "character_key", "orchestration_version_id"])("rejects stale GM metadata %s", field => {
    const input = validInput(); Object.assign(input.evaluation, { [field]: field === "turn_index" ? 10 : field === "character_key" ? "max" : "old" });
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it("lets an already heard acceptance survive an interruption after it", () => {
    const input = validInput(); input.delivery!.generated += " Une suite privée."; input.delivery!.status = "interrupted";
    expect(validateCharacterHandoff(input).authorized).toBe(true);
  });
  it("validates a GM proposal only when actually spoken and targeted", () => {
    const input = withReply("Tu peux appeler Max.");
    input.evaluation.handoff_assessment!.origin = { type: "gm_proposal", turnId: input.turnId, turnIndex: input.turnIndex, evidence: "Tu peux appeler Max." };
    input.evaluation.handoff_assessment!.targetEvidence = { speaker: "character", quote: "appeler Max" };
    expect(validateCharacterHandoff(input).authorized).toBe(true);
    input.delivery!.delivered = "";
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it("requires a still-open bounded request for an earlier origin", () => {
    const input = validInput();
    input.evaluation.handoff_assessment!.origin = { ...validAssessment().origin, turnId: "session:10", turnIndex: 10 };
    expect(validateCharacterHandoff(input).reason).toBe("request_unresolved");
    input.openRequest = { turnId: "session:10", turnIndex: 10, expiresAfterTurnIndex: 11, userText: excerpts.t11.user,
      sourceCharacter: "emma", targetCharacter: "max", orchestrationVersionId: "v6" };
    expect(validateCharacterHandoff(input).authorized).toBe(true);
    input.openRequest.expiresAfterTurnIndex = 10;
    expect(validateCharacterHandoff(input).authorized).toBe(false);
  });
  it("rejects a verified contradictory refusal and never mutates its input", () => {
    const input = withReply("Je vais l’appeler. Je refuse de vous le passer.", "Je vais l’appeler.");
    input.evaluation.handoff_assessment!.consent.refusalEvidence = "Je refuse de vous le passer.";
    const before = structuredClone(input);
    expect(validateCharacterHandoff(input).reason).toBe("character_refused");
    expect(input).toEqual(before);
  });
});

describe('lot 1 finalization: staying with the current character', () => {
  it.each(['Non, je préfère que tu restes avec moi.', 'Je préfère que vous restiez avec moi.', 'Je préfère que tu restes avec moi.'])(
    'a request to stay vetoes GM accept: %s', reply => {
      const input = validInput();
      input.delivery = { ...input.delivery!, generated: reply, delivered: reply };
      input.evaluation.handoff_assessment!.consent.evidence = reply;
      expect(validateCharacterHandoff(input).reason).toBe('character_refused');
    });
});

describe('lot 1: no invented refusal from a negated request to stay', () => {
  it.each(['Je ne te demande pas de rester avec moi.', 'Je ne veux pas que tu restes avec moi.', 'Je ne demande pas que vous restiez avec moi.'])(
    'keeps a clear transfer accepted after %s', prefix => {
      const input = validInput();
      const reply = `${prefix} Tu peux appeler Max.`;
      input.delivery = { ...input.delivery!, generated: reply, delivered: reply };
      input.evaluation.handoff_assessment!.consent.evidence = 'Tu peux appeler Max.';
      expect(validateCharacterHandoff(input).authorized).toBe(true);
    });
});
