import type { ConversationMessage, RuntimeCharacter } from '@/types';
import type { CharacterHandoffOffer } from './characterConversation';
import { detectPlayerSwitchRequest, withdrawsHandoff } from './characterConversation';
import { cleanHandoffAssessment, validateCharacterHandoff, type CharacterHandoffValidationInput } from './characterHandoff';

export interface HandoffContext {
  sessionId: string;
  sourceCharacter: RuntimeCharacter;
  orchestrationVersionId: string;
  turnId: string;
  turnIndex: number;
}
export type OpenHandoffRequest = NonNullable<CharacterHandoffValidationInput['openRequest']>;
export interface HandoffState extends HandoffContext {
  schemaVersion: 2;
  requestId?: string;
  sourceCallId?: string;
  revision: string;
  state: 'none' | 'awaiting_character' | 'prepared' | 'available';
  openRequest: OpenHandoffRequest | null;
  offer: (CharacterHandoffOffer & { assessment: NonNullable<CharacterHandoffValidationInput['evaluation']['handoff_assessment']> }) | null;
}

export function parseHandoffState(raw: unknown): HandoffState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as HandoffState;
  if (s.schemaVersion !== 2 || !['none', 'awaiting_character', 'prepared', 'available'].includes(s.state)
    || typeof s.revision !== 'string' || !s.revision || typeof s.sessionId !== 'string'
    || !['max', 'emma'].includes(s.sourceCharacter) || typeof s.orchestrationVersionId !== 'string'
    || typeof s.turnId !== 'string' || !Number.isSafeInteger(s.turnIndex) || s.turnIndex < 1) return null;
  if ((s.requestId !== undefined && (typeof s.requestId !== 'string' || !s.requestId || s.requestId.length > 160))
    || (s.sourceCallId !== undefined && (typeof s.sourceCallId !== 'string' || !s.sourceCallId || s.sourceCallId.length > 200))) return null;
  if (s.state === 'available' || s.state === 'prepared') {
    const offer = s.offer;
    const proof = cleanHandoffAssessment(offer?.assessment);
    if (!offer || !proof || typeof offer.reason !== 'string' || typeof offer.proposalGuidance !== 'string'
      || offer.targetCharacter !== proof.targetCharacter || proof.sourceCharacter !== s.sourceCharacter
      || proof.turnId !== s.turnId || proof.turnIndex !== s.turnIndex || proof.orchestrationVersionId !== s.orchestrationVersionId
      || offer.gmApproval?.turnId !== s.turnId || offer.gmApproval.orchestrationVersionId !== s.orchestrationVersionId) return null;
  }
  const open = s.openRequest;
  if (open && (typeof open.userText !== 'string' || open.userText.length > 2000
    || typeof open.turnId !== 'string' || !Number.isSafeInteger(open.turnIndex)
    || !Number.isSafeInteger(open.expiresAfterTurnIndex) || (open.expiresAfterTurnIndex !== open.turnIndex + 2 && open.expiresAfterTurnIndex !== Number.MAX_SAFE_INTEGER)
    || open.sourceCharacter !== s.sourceCharacter || open.targetCharacter === s.sourceCharacter
    || !['max', 'emma'].includes(open.targetCharacter) || open.orchestrationVersionId !== s.orchestrationVersionId)) return null;
  return s;
}

export function advanceHandoffTurn(raw: unknown, context: HandoffContext, userText?: string): HandoffState {
  const previous = parseHandoffState(raw);
  const old = previous?.sessionId === context.sessionId && previous.sourceCharacter === context.sourceCharacter
    && previous.orchestrationVersionId === context.orchestrationVersionId ? previous : null;
  const target = userText === undefined ? null : detectPlayerSwitchRequest(userText, context.sourceCharacter, true);
  const withdrawn = target === context.sourceCharacter || (userText !== undefined && withdrawsHandoff(userText));
  if (old?.state === 'available' && userText !== undefined && !withdrawn
    && (!target || target === old.offer?.targetCharacter)) return { ...old, revision: crypto.randomUUID() };
  const open = !withdrawn && old?.state !== 'available' && old?.openRequest
    && old.openRequest.expiresAfterTurnIndex >= context.turnIndex ? old.openRequest : null;
  const typed = target && !withdrawn && userText ? { turnId: context.turnId, turnIndex: context.turnIndex,
    expiresAfterTurnIndex: Number.MAX_SAFE_INTEGER, userText: userText.slice(0, 2000),
    sourceCharacter: context.sourceCharacter, targetCharacter: target, orchestrationVersionId: context.orchestrationVersionId } : null;
  const keep = open && (!typed || typed.targetCharacter === open.targetCharacter);
  return { ...context, schemaVersion: 2, revision: crypto.randomUUID(),
    requestId: userText === undefined && !old?.requestId ? undefined : keep ? old?.requestId ?? crypto.randomUUID() : crypto.randomUUID(), sourceCallId: old?.sourceCallId,
    state: typed || open ? 'awaiting_character' : 'none', openRequest: typed ?? open, offer: null };
}

export function revokeHandoff(state: HandoffState): HandoffState {
  return { ...state, revision: crypto.randomUUID(), state: 'none', openRequest: null, offer: null };
}

export function assessHandoffTurn(state: HandoffState, input: CharacterHandoffValidationInput) {
  if (withdrawsHandoff(input.userText)) return { state: revokeHandoff(state),
    validation: { authorized: false, reason: 'request_unresolved', targetCharacter: null } as const };
  const validation = validateCharacterHandoff({ ...input, openRequest: state.openRequest });
  if (state.turnId !== input.turnId || state.turnIndex !== input.turnIndex
    || state.sourceCharacter !== input.currentCharacter || state.orchestrationVersionId !== input.orchestrationVersionId) {
    return { state, validation: { authorized: false, reason: 'gm_late', targetCharacter: null } as const };
  }
  const assessment = cleanHandoffAssessment(input.evaluation.handoff_assessment);
  // An unrelated turn cannot erase a previously validated, still-owned offer.
  if (state.state === 'available') return { state, validation };
  const next = revokeHandoff(state);
  if (validation.authorized && assessment && input.evaluation.action?.type === 'handoff') {
    next.state = 'available';
    next.openRequest = state.openRequest;
    next.offer = { ...input.evaluation.action,
      gmApproval: { turnId: state.turnId, orchestrationVersionId: state.orchestrationVersionId }, assessment };
  } else if (assessment?.origin.type === 'player_request'
    && validation.reason === 'character_deferred'
    && assessment.sourceCharacter === state.sourceCharacter && assessment.targetCharacter !== state.sourceCharacter
    && assessment.turnId === state.turnId && assessment.orchestrationVersionId === state.orchestrationVersionId
    && input.userText.includes(assessment.origin.evidence)
    && assessment.origin.turnId === state.turnId && assessment.origin.turnIndex === state.turnIndex
    && assessment.consent.stance !== 'object') {
    next.openRequest = state.requestId && state.openRequest ? state.openRequest
      : { turnId: state.turnId, turnIndex: state.turnIndex, expiresAfterTurnIndex: state.turnIndex + 2,
      userText: assessment.origin.evidence, sourceCharacter: state.sourceCharacter,
      targetCharacter: assessment.targetCharacter, orchestrationVersionId: state.orchestrationVersionId };
    next.state = 'awaiting_character';
  } else if (state.openRequest && validation.reason === 'character_deferred') {
    next.openRequest = state.openRequest;
    next.state = 'awaiting_character';
  }
  if (state.requestId && state.openRequest && !['character_refused'].includes(validation.reason) && !next.openRequest) {
    next.openRequest = state.openRequest; next.state = 'awaiting_character';
  }
  return { state: next, validation };
}

/** Persist only evidence excerpts + references; recover full reply from its existing receipt. */
export function restoreHandoffOffer(raw: unknown, context: HandoffContext, history: ConversationMessage[]): CharacterHandoffOffer | null {
  const state = parseHandoffState(raw);
  if (!state || state.state !== 'available' || !state.offer || state.sessionId !== context.sessionId
    || state.sourceCharacter !== context.sourceCharacter || state.orchestrationVersionId !== context.orchestrationVersionId
    || (state.requestId ? context.turnIndex < state.turnIndex : state.turnIndex !== context.turnIndex || state.turnId !== context.turnId)) return null;
  const { offer } = state;
  if (offer.gmApproval?.turnId !== state.turnId || offer.gmApproval.orchestrationVersionId !== state.orchestrationVersionId
    || offer.targetCharacter !== offer.assessment.targetCharacter) return null;
  const reply = history.find(m => m.delivery?.turnId === state.turnId && m.delivery.character === state.sourceCharacter);
  if (state.requestId && (reply?.delivery?.status !== 'completed' || reply.delivery.generated !== reply.delivery.delivered)) return null;
  const users = history.filter(m => m.role === 'user');
  const user = users[state.turnIndex - 1];
  if (!user || user.spokenWith !== state.sourceCharacter) return null;
  const validation = validateCharacterHandoff({ currentCharacter: state.sourceCharacter, turnId: state.turnId,
    turnIndex: state.turnIndex, orchestrationVersionId: state.orchestrationVersionId, userText: user.content,
    delivery: reply?.delivery ?? null, openRequest: state.openRequest,
    evaluation: { execution_status: 'executed', character_key: state.sourceCharacter, turn_index: state.turnIndex,
      orchestration_version_id: state.orchestrationVersionId, handoff_assessment: offer.assessment,
      action: { type: 'handoff', targetCharacter: offer.targetCharacter, reason: offer.reason, proposalGuidance: offer.proposalGuidance } } });
  return validation.authorized ? offer : null;
}
