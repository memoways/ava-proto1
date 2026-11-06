import type { ConversationMessage, RuntimeCharacter, PRD4PostTurnEvaluation } from '@/types';
import type { ResponseDeliveryReceipt } from './responseDelivery';
import { assessHandoffTurn, revokeHandoff, type HandoffState } from './characterHandoffState';
import { validateDirectorDecision } from './experienceDirector';
import { lastHandoffUserTurn, inferSpokenWith, otherCharacter, hasCharacterHandoffConsent } from './characterConversation';
import { cleanHandoffAssessment, handoffSpeechEvidence, validateCharacterHandoff,
  type CharacterHandoffAssessment, type CharacterHandoffValidationInput } from './characterHandoff';
import { withTimeout } from './asyncUtils';

export const HANDOFF_PREPARATION_TIMEOUT_MS = 16_000;
export const HANDOFF_DEPENDENCY_TIMEOUT_MS = 3_000;

/** This is a candidate projection, NEVER a delivery receipt to store or expose. */
export function candidateEvidence(text: string, turnId: string, turnIndex: number, character: RuntimeCharacter): ResponseDeliveryReceipt {
  return { turnId, turnIndex, character, generated: text, delivered: text, uncertain: '', privateContinuation: '',
    status: 'completed', intent: null, scheduledSamples: null, playedSamples: null, sampleRate: null };
}

/** A conservative OUTPUT HOLD, never a grant of consent. GM still decides semantics. */
export function needsHandoffPreparation(text: string): boolean {
  const s = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").toLowerCase();
  // Hold an actual offer by the current speaker, never a name, a past event,
  // or an unrelated verb in another sentence. GM still validates consent.
  return s.split(/[.!?;\n]+/).some(clause =>
    /\bje\s+(?:(?:vais|peux|pourrais|pourrai)\s+(?:aller\s+)?)?(?:(?:le|la|les)\s+|l')(?:appel(?:le|er)|cherche(?:r)?|joins|joindre|contacte(?:r)?|passe(?:r)?|transfere(?:r)?)\b/.test(clause)
    || /\bje\s+(?:(?:vais|peux|pourrais|pourrai)\s+)?(?:te|vous)\s+(?:(?:le|la|les)\s+)?(?:passe|passer|transfere|transferer|connecte|connecter)\b/.test(clause)
    || /\bje\s+(?:vais|peux|pourrais|pourrai)\s+(?:(?:le|la|les)\s+)?(?:appeler|joindre|contacter|chercher)\s*(?:max|emma|pour\s+(?:toi|vous))?\s*$/.test(clause.trim())
    || /\bje\s+(?:vais|peux|pourrais|pourrai)\s+(?:appeler|joindre|contacter|chercher)\s+(?:max|emma)\b/.test(clause)
    || /\bje\s+(?:(?:vais|peux|pourrais)\s+)?(?:te|vous)\s+(?:mets|mettre)\s+(?:en\s+relation|en\s+ligne)\b/.test(clause)
    || /\b(?:tu\s+peux|vous\s+pouvez)\s+(?:appeler|joindre|contacter)\s+(?:max|emma)\b/.test(clause)
    // Session e6918bd8 (G1.3): « Je passe Emma » and « je peux lui transmettre l'appel »
    // were spoken unheld, so the GM-validated consent was dropped as unprepared.
    || /\bje\s+(?:(?:vais|peux|pourrais|pourrai)\s+)?(?:(?:te|vous)\s+)?(?:re)?pass(?:e|er)\s+(?:max|emma)\b/.test(clause)
    || /\bje\s+(?:(?:vais|peux|pourrais|pourrai)\s+)?(?:(?:te|vous|lui)\s+)?(?:transmets|transmettre|(?:re)?pass(?:e|er)|transfere(?:r)?)\s+(?:l'appel|la\s+ligne|le\s+telephone|le\s+combine)\b/.test(clause));
}

type RecoveryContext = Pick<CharacterHandoffValidationInput, 'currentCharacter' | 'turnId' | 'turnIndex'
  | 'orchestrationVersionId' | 'userText' | 'delivery' | 'openRequest'>;

/**
 * Recette Max → Emma (sessions du 1er au 4 novembre 2026) : le personnage accepte
 * (« Je te la passe »), le GM le note, mais sa preuve référencée est rejetée
 * (cible absente d'un fragment STT, consentRef mal formé, preuve omise). La
 * réplique était alors remplacée par une question figée et le joueur tournait en
 * boucle. Cette preuve déterministe n'existe que si le joueur a lui-même demandé
 * la cible (tour courant ou demande ouverte) ET si une phrase délivrée du
 * personnage est une annonce explicite de transfert. Le GM garde son veto
 * (object/defer/refusal), la validation complète repasse avec ses vetos sur la
 * réplique entière, puis les gardes du directeur et le clic du joueur.
 */
export function recoverHandoffAssessment(context: RecoveryContext,
  gm: { stance?: unknown; refusal?: unknown } | null): CharacterHandoffAssessment | null {
  if (gm?.stance === 'object' || gm?.stance === 'defer' || gm?.refusal === true) return null;
  const { delivery, orchestrationVersionId: version } = context;
  if (!version || !delivery || delivery.turnId !== context.turnId || delivery.turnIndex !== context.turnIndex
    || delivery.character !== context.currentCharacter || !delivery.delivered.trim()
    || delivery.status === 'unknown' || !delivery.generated.startsWith(delivery.delivered)) return null;
  const target = otherCharacter(context.currentCharacter);
  const name = new RegExp(`\\b${target}\\b`, 'i');
  const open = context.openRequest?.targetCharacter === target && context.openRequest.sourceCharacter === context.currentCharacter
    && context.openRequest.orchestrationVersionId === version && context.openRequest.turnIndex < context.turnIndex
    && context.openRequest.expiresAfterTurnIndex >= context.turnIndex ? context.openRequest : null;
  const current = context.userText.match(name);
  const requested = current ?? open?.userText.match(name);
  if (!requested) return null;
  const consent = handoffSpeechEvidence(delivery).find(item => item.delivered
    && (needsHandoffPreparation(item.text) || hasCharacterHandoffConsent(item.text, target)));
  if (!consent) return null;
  const assessment = cleanHandoffAssessment({
    schemaVersion: 1, sourceCharacter: context.currentCharacter, targetCharacter: target,
    turnId: context.turnId, turnIndex: context.turnIndex, orchestrationVersionId: version,
    origin: { type: 'player_request', turnId: current ? context.turnId : open!.turnId,
      turnIndex: current ? context.turnIndex : open!.turnIndex, evidence: current ? context.userText : open!.userText },
    targetEvidence: { speaker: 'user', quote: requested[0] },
    consent: { stance: 'accept', evidence: consent.text, refusalEvidence: null },
  });
  if (!assessment) return null;
  const verdict = validateCharacterHandoff({ ...context, evaluation: {
    execution_status: 'executed', character_key: context.currentCharacter, turn_index: context.turnIndex,
    orchestration_version_id: version, handoff_assessment: assessment,
    action: { type: 'handoff', targetCharacter: target, reason: RECOVERED_HANDOFF_REASON, proposalGuidance: RECOVERED_HANDOFF_GUIDANCE } } });
  return verdict.authorized ? assessment : null;
}

export const RECOVERED_HANDOFF_REASON = 'Accord de transfert délivré par le personnage.';
export const RECOVERED_HANDOFF_GUIDANCE = 'Passe l’appel sans redemander la raison.';

/** A withheld candidate loses only its transfer-offer sentences; the rest stays the character's words. */
export function withoutTransferOffer(text: string): string {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+[»”"]*|$)\s*/gu) ?? [];
  return sentences.filter(sentence => !needsHandoffPreparation(sentence)).join('').trim();
}
export { withdrawsHandoff } from './characterConversation';

/** Current call only. A receipt + preceding user turn is one exchange, irrespective of STT fragments. */
export function completedCallExchanges(history: ConversationMessage[], character: RuntimeCharacter): number {
  let count = 0;
  let pendingUser = false;
  const seen = new Set<string>();
  history.forEach((message, index) => {
    if (message.callStart || message.callTransfer || inferSpokenWith(history, index) !== character) {
      count = 0; pendingUser = false; seen.clear();
    }
    if (inferSpokenWith(history, index) !== character) return;
    if (message.role === 'user') { pendingUser = true; return; }
    const r = message.delivery;
    if (!pendingUser || message.callStart || message.callTransfer || !r || seen.has(r.turnId)) return;
    pendingUser = false;
    seen.add(r.turnId);
    if (r.character === character && r.status === 'completed' && r.generated.trim()
      && r.delivered === r.generated && !r.uncertain && !r.privateContinuation) count++;
  });
  return count;
}

/** A lease belongs to a request in a call, not a voice turn. Generic over the registry. */
export class HandoffCoordinator<Character extends string = RuntimeCharacter> {
  private generation = 0;
  private owner: string | null = null;
  private lifetime = new AbortController();
  bind(session: string, call: string, source: Character, version: string, request: string) {
    const owner = JSON.stringify([session, call, source, version, request]);
    if (this.owner !== owner) { this.invalidate(); this.owner = owner; }
    const generation = this.generation;
    return { current: () => this.generation === generation && this.owner === owner && !this.lifetime.signal.aborted,
      signal: this.lifetime.signal };
  }
  invalidate() { this.lifetime.abort('handoff-invalidated'); this.lifetime = new AbortController(); this.generation++; this.owner = null; }

}


interface PreparationInput {
  state: HandoffState;
  evaluation: PRD4PostTurnEvaluation;
  text: string;
  userText: string;
  history: ConversationMessage[];
  handoffCount: number;
  signal: AbortSignal;
  current: () => boolean;
  readiness: (target: RuntimeCharacter) => Promise<{ enabled: boolean; ready: boolean; portraitUrl: string | null } | null>;
  persist: (state: HandoffState) => Promise<void>;
}

/** Only this coordinator turns a semantic candidate into a prepared operation. */
export async function prepareCharacterHandoff(input: PreparationInput) {
  const { state, evaluation: ev } = input;
  const assessed = assessHandoffTurn(state, { currentCharacter: state.sourceCharacter, turnId: state.turnId,
    turnIndex: state.turnIndex, orchestrationVersionId: ev.orchestration_version_id ?? null, userText: input.userText,
    evaluation: ev, delivery: candidateEvidence(input.text, state.turnId, state.turnIndex, state.sourceCharacter) });
  if (!assessed.validation.authorized || !assessed.state.offer) throw new Error(assessed.validation.reason);
  const target = assessed.state.offer.targetCharacter;
  const profile = await withTimeout('handoff_target', input.readiness(target), HANDOFF_DEPENDENCY_TIMEOUT_MS);
  const config = ev.orchestration_config;
  const guard = validateDirectorDecision({ labels: { themes: [], topics: [], intentions: [] },
    nextTurnGuidance: null, memoryDelta: null, action: ev.action! }, {
    configPublished: Boolean(ev.orchestration_version_id && config), currentCharacter: state.sourceCharacter,
    userTurn: state.turnIndex, completedExchanges: completedCallExchanges(input.history, state.sourceCharacter) + 1,
    handoffCount: input.handoffCount, handoffPending: false, lastHandoffTurn: lastHandoffUserTurn(input.history),
    handoffsEnabled: config?.editor.allowHandoffs ?? false, minimumHandoffTurn: config?.minimumHandoffTurn ?? 4,
    maximumHandoffsPerSession: config?.maximumHandoffsPerSession ?? 1, minimumTurnsBetweenHandoffs: config?.minimumTurnsBetweenHandoffs ?? 2,
    targetReady: profile?.enabled === true && profile.ready === true && Boolean(config?.activeCharacters.includes(target)),
    playedVideoIds: [], availableVideoIds: [], lastVideoTurn: null, minimumVideoTurn: 0,
    minimumTurnsBetweenVideos: 0, maximumVideosPerSession: 0, cinematicsEnabled: false, resultIsCurrent: input.current(),
  });
  if (guard.action.type !== 'handoff') throw new Error(guard.blockedReason ?? 'passage_non_valide');
  input.signal.throwIfAborted();
  if (!input.current()) throw new Error('request_superseded');
  const prepared: HandoffState = { ...assessed.state, state: 'prepared' };
  await input.persist(prepared);
  input.signal.throwIfAborted();
  if (!input.current()) throw new Error('request_superseded');
  return { state: prepared, portraitUrl: profile?.portraitUrl ?? null, target };
}

export function finalizeCharacterHandoff(state: HandoffState, evaluation: PRD4PostTurnEvaluation,
  userText: string, receipt: ResponseDeliveryReceipt | undefined, prepared: boolean) {
  const assessed = assessHandoffTurn(state, { currentCharacter: state.sourceCharacter, turnId: state.turnId,
    turnIndex: state.turnIndex, orchestrationVersionId: evaluation.orchestration_version_id ?? null,
    userText, delivery: receipt ?? null, evaluation });
  const incomplete = prepared && (receipt?.status !== 'completed' || receipt.delivered !== receipt.generated);
  return { ...assessed, ...(incomplete ? { validation: { authorized: false, reason: 'consent_not_delivered', targetCharacter: null } as const } : {}),
    state: prepared && assessed.validation.authorized && receipt?.status === 'completed'
    && receipt.delivered === receipt.generated ? assessed.state
    : assessed.state.state === 'available' ? revokeHandoff(assessed.state) : assessed.state };
}
