import { describe, expect, it } from "vitest";
import { detectPlayerSwitchRequest, hasCharacterHandoffConsent } from "./characterConversation";
import { HANDOFF_SESSION_EXCERPTS as excerpts, validAssessment, validInput } from "./characterHandoff.fixtures";
import { cleanHandoffAssessment, validateCharacterHandoff } from "./characterHandoff";
import type { CharacterHandoffAssessment, CharacterHandoffValidationInput } from "./characterHandoff";

function withReply(reply: string, evidence = reply): CharacterHandoffValidationInput {
  const input = validInput();
  input.delivery = { ...input.delivery!, generated: reply, delivered: reply };
  input.evaluation.handoff_assessment = { ...validAssessment(), consent: { stance: "accept", evidence, refusalEvidence: null } };
  return input;
}

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
  it.each([excerpts.t6.reply, excerpts.t9.reply])("keeps T6/T9 deferred: %s", reply => {
    const input = withReply(reply);
    input.evaluation.handoff_assessment!.consent.stance = "defer";
    expect(validateCharacterHandoff(input).authorized).toBe(false);
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
