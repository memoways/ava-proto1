import { z } from "zod";
import type { DirectorAction, PRD4PostTurnEvaluation, RuntimeCharacter } from "@/types";
import type { ResponseDeliveryReceipt } from "./responseDelivery";
import type { CharacterHandoffAssessment } from "@/types/characterHandoff";
import { safeSentenceEnd } from './responseIntentStream';
export type { CharacterHandoffAssessment } from "@/types/characterHandoff";

const character = z.enum(["max", "emma"]);
const id = z.string().trim().min(1).max(160);
// Never trim, normalize or truncate quotations into different evidence.
const quote = z.string().min(1).max(2000).refine(value => value.trim().length > 0);
const turnIndex = z.number().int().min(1);
const assessmentSchema = z.object({
  schemaVersion: z.literal(1), sourceCharacter: character, targetCharacter: character,
  turnId: id, turnIndex, orchestrationVersionId: id,
  origin: z.object({ type: z.enum(["player_request", "gm_proposal"]), turnId: id, turnIndex, evidence: quote }),
  targetEvidence: z.object({ speaker: z.enum(["user", "character"]), quote }),
  consent: z.object({ stance: z.enum(["accept", "object", "defer"]), evidence: quote, refusalEvidence: quote.nullable() }),
});

/** Invalid optional data never invalidates a historical GM response. */
export function cleanHandoffAssessment(raw: unknown): CharacterHandoffAssessment | null {
  const parsed = assessmentSchema.safeParse(raw);
  return parsed.success ? parsed.data as CharacterHandoffAssessment : null;
}

/** Wire v2 references first-party text; the persisted proof stays v1. */
const referenceAssessmentSchema = z.object({
  schemaVersion: z.literal(2),
  requestSource: z.enum(['current_user', 'open_request', 'spoken_proposal']),
  targetCharacter: character,
  stance: z.enum(['accept', 'object', 'defer']),
  refusal: z.boolean(),
  consentRef: z.string().regex(/^speech_\d+$/),
}).strict();

/** Exact, turn-local references. Segmentation never rewrites the spoken text. */
export function handoffSpeechEvidence(delivery: ResponseDeliveryReceipt | null) {
  if (!delivery) return [];
  const evidence: Array<{ ref: string; text: string; delivered: boolean }> = [];
  let offset = 0;
  for (const match of delivery.generated.matchAll(/[.!?…]+[»”"]*(?=\s|$)/gu)) {
    const end = match.index + match[0].length;
    if (safeSentenceEnd(delivery.generated.slice(offset, end), true) !== end - offset) continue;
    const text = delivery.generated.slice(offset, end).trim();
    if (text) evidence.push({ ref: `speech_${evidence.length}`, text, delivered: delivery.delivered.includes(text) });
    offset = end;
  }
  return evidence;
}

export function materializeHandoffAssessment(
  raw: unknown,
  context: Pick<CharacterHandoffValidationInput, 'currentCharacter' | 'turnId' | 'turnIndex'
    | 'orchestrationVersionId' | 'userText' | 'delivery' | 'openRequest'> | null,
  onRejected?: (reason: CharacterHandoffAuditReason, missingFields: string[]) => void,
): CharacterHandoffAssessment | null {
  const reject = (reason: CharacterHandoffAuditReason, missingFields: string[] = []) => {
    onRejected?.(reason, missingFields);
    return null;
  };
  const missingFields = (schema: typeof assessmentSchema | typeof referenceAssessmentSchema) =>
    Object.keys(schema.shape).filter(field => !raw || typeof raw !== 'object'
      || !Object.prototype.hasOwnProperty.call(raw, field));
  // Historical proofs are validated verbatim, never repaired into new evidence.
  if (!raw || typeof raw !== 'object' || (raw as { schemaVersion?: unknown }).schemaVersion !== 2) {
    const assessment = cleanHandoffAssessment(raw);
    if (raw != null && !assessment) return reject('assessment_invalid', missingFields(assessmentSchema));
    return assessment;
  }
  const parsed = referenceAssessmentSchema.safeParse(raw);
  if (!parsed.success) return reject(parsed.error.issues.some(issue => issue.path[0] === 'consentRef'
    && raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'consentRef'))
    ? 'consent_reference_invalid' : 'assessment_invalid', missingFields(referenceAssessmentSchema));
  if (!context?.orchestrationVersionId) return reject('version_mismatch');
  if (!context.delivery) return reject('consent_not_delivered');
  const decision = parsed.data;
  const { delivery, openRequest } = context;
  if (delivery.turnId !== context.turnId || delivery.turnIndex !== context.turnIndex
    || delivery.character !== context.currentCharacter || !delivery.delivered.trim()
    || delivery.status === 'unknown' || !delivery.generated.startsWith(delivery.delivered)) return reject('consent_not_delivered');
  if (decision.requestSource === 'open_request' && !openRequest) return reject('request_unresolved');
  const consent = handoffSpeechEvidence(delivery).find(item => item.ref === decision.consentRef);
  if (!consent) return reject('consent_evidence_missing');
  const proposal = decision.requestSource === 'spoken_proposal';
  const open = decision.requestSource === 'open_request' ? openRequest : null;
  const originText = proposal ? delivery.delivered : open?.userText ?? context.userText;
  const name = new RegExp(`\\b${decision.targetCharacter}\\b`, 'i');
  const userTarget = !proposal && originText.match(name);
  const spokenTarget = delivery.delivered.match(name);
  const targetMatch = userTarget || spokenTarget;
  if (!targetMatch) return reject('request_unresolved');
  const assessment = cleanHandoffAssessment({
    schemaVersion: 1, sourceCharacter: context.currentCharacter, targetCharacter: decision.targetCharacter,
    turnId: context.turnId, turnIndex: context.turnIndex, orchestrationVersionId: context.orchestrationVersionId,
    origin: { type: proposal ? 'gm_proposal' : 'player_request', turnId: open?.turnId ?? context.turnId,
      turnIndex: open?.turnIndex ?? context.turnIndex, evidence: originText },
    targetEvidence: { speaker: userTarget ? 'user' : 'character', quote: targetMatch[0] },
    consent: { stance: decision.stance, evidence: consent.text,
      refusalEvidence: decision.refusal ? delivery.generated : null },
  });
  return assessment ?? reject('assessment_invalid');
}

export interface CharacterHandoffValidationInput {
  currentCharacter: RuntimeCharacter;
  turnId: string;
  turnIndex: number;
  orchestrationVersionId: string | null;
  userText: string;
  delivery: ResponseDeliveryReceipt | null;
  evaluation: Pick<PRD4PostTurnEvaluation, "execution_status" | "character_key" | "turn_index" | "orchestration_version_id" | "action" | "handoff_assessment">;
  /** Caller must supply only the still-open request from this session; no history inference. */
  openRequest?: {
    turnId: string; turnIndex: number; expiresAfterTurnIndex: number; userText: string;
    sourceCharacter: RuntimeCharacter; targetCharacter: RuntimeCharacter; orchestrationVersionId: string;
  } | null;
}

export type CharacterHandoffAuditReason =
  | "gm_not_executed" | "assessment_missing" | "assessment_invalid" | "gm_late"
  | "version_mismatch" | "character_mismatch" | "target_mismatch" | "action_mismatch"
  | "request_unresolved" | "consent_reference_invalid" | "consent_evidence_missing" | "consent_not_delivered"
  | "character_refused" | "character_deferred" | "consent_validated";

export type CharacterHandoffValidationResult =
  | { authorized: true; reason: "consent_validated"; targetCharacter: RuntimeCharacter }
  | { authorized: false; reason: Exclude<CharacterHandoffAuditReason, "consent_validated">; targetCharacter: null };

function normalized(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/’/g, "'");
}

/** Narrow safety vetoes on transfer itself; emotional uncertainty is not a refusal.
 * Semantic interpretation of the full reply belongs to the GM, not these patterns.
 */
function explicitTransferVeto(reply: string, consentEvidence: string): "character_refused" | "character_deferred" | null {
  // This anchored past-status preamble is not a refusal of the current transfer.
  // Exclude it only before the exact, separately delivered GM proof. Every
  // subsequent word remains subject to vetoes; this does not grant permission.
  const retrospective = /^non\s*(?:…|\.{2,}|,)\s*pas encore\s*[.!?…]\s*/i.exec(reply);
  const evidenceStart = reply.indexOf(consentEvidence);
  const text = normalized(retrospective && evidenceStart >= retrospective[0].length
    ? reply.slice(retrospective[0].length) : reply);
  const verb = "(?:pass\\w*|appel\\w*|contact\\w*|joind\\w*|cherch\\w*)";
  const pronouns = "(?:(?:te|le|la|lui|vous|me)\\s+|l['’]){0,3}";
  const object = "(?:max|emma|telephone|ligne)\\b";
  const pronounObject = "(?:(?:te|vous|me)\\s+)?(?:(?:le|la|lui)\\s+|l')";
  const namedObject = `(?:(?:a|avec|le|la)\\s+){0,2}${object}`;
  const transfer = `(?:${pronounObject}${verb}|${pronouns}${verb}\\s+${namedObject})`;
  const refusal = "(?:pas|jamais|plus)\\b";
  const refused = new RegExp(`\\b${refusal}\\s+${transfer}\\b`, "i").test(text)
    || new RegExp(`(?:\\bne\\s+|\\bn')${pronounObject}${verb}\\s+${refusal}`, "i").test(text)
    || new RegExp(`(?:${pronounObject}${verb}|${verb}[- ](?:le|la|moi|nous))\\s+${refusal}`, "i").test(text)
    || new RegExp(`\\b${verb}\\s+${refusal}\\s+${namedObject}`, "i").test(text)
    || new RegExp(`\\b(?:je refuse de|pas question de)\\s+${transfer}\\b`, "i").test(text)
    || /\b(?:enfin non|finalement non|mais non|reste[z]? avec moi)\b/.test(text)
    || /\bje (?:prefere|voudrais|veux|souhaite) que (?:tu restes|vous restiez) avec moi\b/.test(text)
    || /(?:^|[.!?…]\s*)(?:non|je refuse|pas question)\s*(?:[.!?…]|$)/.test(text);
  if (refused) return "character_refused";
  // The player's optional click ("si tu veux") does not defer the speaker's
  // consent. Only an exact terminal choice adjunct is excluded, never another
  // condition such as "si tu m'expliques" or the target's future acceptance.
  const conditionalText = text.replace(/…|\.{2,}/g, ' ')
    .replace(/\b(?:si|quand)\s+(?:tu\s+(?:le\s+)?veux|vous\s+(?:le\s+)?voulez)(?=\s*[.!?]|$)/g, '');
  if (new RegExp(`${transfer}[^.!?…]{0,60}\\b(?:si|a condition|quand|des que)\\b`, 'i').test(conditionalText)
    || /(?:^|[.!?…]\s*)(?:plus tard|pas maintenant|pas encore|on verra)\s*(?:[.!?…]|$)/.test(text)
    || new RegExp(`${transfer}[^.!?…]{0,50}\\b(?:plus tard|pas maintenant|pas encore|on verra)\\b`, "i").test(text)
    || /\bdemander\s+(?:s'il|si elle)\s+(?:accepte|veut|est d'accord)\b/.test(text)) return "character_deferred";
  return null;
}

function matchingAction(action: DirectorAction | undefined, target: RuntimeCharacter): boolean {
  return action?.type === "handoff" && action.targetCharacter === target;
}

/** Pure narrative eligibility. Does not create/persist an offer or bypass director guards. */
export function validateCharacterHandoff(input: CharacterHandoffValidationInput): CharacterHandoffValidationResult {
  const reject = (reason: Exclude<CharacterHandoffAuditReason, "consent_validated">): CharacterHandoffValidationResult =>
    ({ authorized: false, reason, targetCharacter: null });
  const { evaluation, delivery } = input;
  if (evaluation.execution_status !== "executed") return reject("gm_not_executed");
  if (evaluation.handoff_assessment == null) return reject("assessment_missing");
  const assessment = cleanHandoffAssessment(evaluation.handoff_assessment);
  if (!assessment) return reject("assessment_invalid");
  if (assessment.turnId !== input.turnId || assessment.turnIndex !== input.turnIndex
    || evaluation.turn_index !== input.turnIndex) return reject("gm_late");
  if (!input.orchestrationVersionId || assessment.orchestrationVersionId !== input.orchestrationVersionId
    || evaluation.orchestration_version_id !== input.orchestrationVersionId) return reject("version_mismatch");
  if (assessment.sourceCharacter !== input.currentCharacter || evaluation.character_key !== input.currentCharacter)
    return reject("character_mismatch");
  if (assessment.targetCharacter === input.currentCharacter) return reject("target_mismatch");
  if (!delivery || delivery.turnId !== input.turnId || delivery.turnIndex !== input.turnIndex
    || delivery.character !== input.currentCharacter || !delivery.generated.startsWith(delivery.delivered)
    || !delivery.delivered.trim() || delivery.status === "unknown") return reject("consent_not_delivered");

  const { origin, targetEvidence, consent } = assessment;
  const currentOrigin = origin.turnId === input.turnId && origin.turnIndex === input.turnIndex;
  let originUserText = input.userText;
  if (!currentOrigin) {
    const open = input.openRequest;
    if (origin.type !== "player_request" || !open || open.turnId !== origin.turnId || open.turnIndex !== origin.turnIndex
      || open.turnIndex >= input.turnIndex || !Number.isSafeInteger(open.expiresAfterTurnIndex)
      || open.expiresAfterTurnIndex < input.turnIndex
      || open.sourceCharacter !== input.currentCharacter || open.targetCharacter !== assessment.targetCharacter
      || open.orchestrationVersionId !== input.orchestrationVersionId) return reject("request_unresolved");
    originUserText = open.userText;
  }
  const originText = origin.type === "player_request" ? originUserText : delivery.delivered;
  if (!originText.includes(origin.evidence)) return reject("request_unresolved");
  // A bare yes has no transfer content of its own: its request quote must at
  // least concern contact. Target resolution remains the GM's responsibility;
  // never re-run the legacy request regex on a resolved pronoun or correction.
  if (/^(?:oui|d'accord|ok(?:ay)?|bien sur)[ .!]*$/.test(normalized(consent.evidence).trim())
    && (origin.type !== "player_request"
      || !/\b(?:parler|discuter|appeler|joindre|passer|contacter)\b/.test(normalized(origin.evidence))))
    return reject("request_unresolved");
  const targetText = targetEvidence.speaker === "user" ? originUserText : delivery.delivered;
  if ((origin.type === "gm_proposal" && targetEvidence.speaker !== "character")
    || !targetText.includes(targetEvidence.quote)
    || !new RegExp(`\\b${assessment.targetCharacter}\\b`, "i").test(targetEvidence.quote)) return reject("request_unresolved");
  if (!delivery.generated.includes(consent.evidence)) return reject("consent_evidence_missing");
  if (!delivery.delivered.includes(consent.evidence)) return reject("consent_not_delivered");
  // Inspect the complete generated reply too: a selected affirmative quote cannot
  // hide a contradiction in its continuation, even if playback was interrupted.
  const veto = explicitTransferVeto(delivery.generated, consent.evidence);
  if (veto) return reject(veto);
  if (consent.refusalEvidence !== null) {
    if (!delivery.generated.includes(consent.refusalEvidence)) return reject("consent_evidence_missing");
    return reject("character_refused");
  }
  if (consent.stance === "object") return reject("character_refused");
  if (consent.stance === "defer") return reject("character_deferred");
  if (!matchingAction(evaluation.action, assessment.targetCharacter)) return reject("action_mismatch");
  return { authorized: true, reason: "consent_validated", targetCharacter: assessment.targetCharacter };
}
