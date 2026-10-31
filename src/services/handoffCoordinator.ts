import type { ConversationMessage, RuntimeCharacter, PRD4PostTurnEvaluation } from '@/types';
import type { ResponseDeliveryReceipt } from './responseDelivery';
import { assessHandoffTurn, revokeHandoff, type HandoffState } from './characterHandoffState';
import { validateDirectorDecision } from './experienceDirector';
import { lastHandoffUserTurn, inferSpokenWith } from './characterConversation';
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
