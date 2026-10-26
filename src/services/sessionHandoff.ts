import { sourceCallId } from './callCycle';
import { completedCallExchanges, HANDOFF_DEPENDENCY_TIMEOUT_MS } from './handoffCoordinator';
import { withTimeout } from './asyncUtils';
import { supabase } from '@/integrations/supabase/client';
import { ensureGameAuth } from './gameAuth';
import type { ConversationMessage, RuntimeCharacter } from '@/types';
import type { Json } from '@/integrations/supabase/types';
import type { HandoffState } from './characterHandoffState';

export interface HandoffSnapshot {
  id: string;
  resume_expires_at?: string;
  active_character: RuntimeCharacter;
  orchestration_version_id: string | null;
  handoff_count: number;
  pending_handoff: Json | null;
  conversation_log: ConversationMessage[];
}
export class HandoffConflictError extends Error {
  constructor() { super('Cette offre a changé dans une autre fenêtre ou la session est terminée. Recharge l’appel.'); }
}
export async function readHandoffSnapshot(sessionId: string): Promise<HandoffSnapshot> {
  await ensureGameAuth();
  const { data, error } = await supabase.from('sessions')
    .select('id,active_character,orchestration_version_id,handoff_count,pending_handoff,conversation_log,resume_expires_at')
    .eq('id', sessionId).is('ended_at', null).abortSignal(AbortSignal.timeout(HANDOFF_DEPENDENCY_TIMEOUT_MS)).single();
  if (error) throw error;
  if (data?.resume_expires_at && Date.parse(data.resume_expires_at) <= Date.now()) throw new Error('Le délai technique de reprise est expiré.');
  if (!data || (data.active_character !== 'max' && data.active_character !== 'emma')) throw new HandoffConflictError();
  return { ...data, active_character: data.active_character, handoff_count: data.handoff_count ?? 0,
    conversation_log: Array.isArray(data.conversation_log) ? data.conversation_log as unknown as ConversationMessage[] : [] };
}

function orderedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, orderedJson(entry)]));
  return value;
}

/** An ambiguous HTTP failure is recoverable ONLY by recognizing this exact emitted CAS. */
export function matchesHandoffWrite(actual: HandoffSnapshot, expected: HandoffSnapshot, next: HandoffState, target?: RuntimeCharacter): boolean {
  return actual.id === expected.id && actual.orchestration_version_id === expected.orchestration_version_id
    && actual.active_character === (target ?? expected.active_character)
    && actual.handoff_count === expected.handoff_count + (target ? 1 : 0)
    && JSON.stringify(orderedJson(actual.pending_handoff)) === JSON.stringify(orderedJson(next));
}

/** One conditional UPDATE. No read-then-write emulation; a zero-row success is a conflict. */
export async function writeHandoffSnapshot(expected: HandoffSnapshot, next: HandoffState,
  target?: RuntimeCharacter, conversation?: ConversationMessage[], signal?: AbortSignal, gridTarget?: RuntimeCharacter): Promise<HandoffSnapshot> {
  await ensureGameAuth();
  let query = supabase.from('sessions').update({ pending_handoff: next as unknown as Json,
    ...(gridTarget ? { active_character: gridTarget, personnage_appele: gridTarget } : {}),
    ...(conversation ? { conversation_log: JSON.parse(JSON.stringify(conversation)) as Json } : {}),
    ...(target ? { active_character: target, personnage_appele: target, handoff_count: expected.handoff_count + 1 } : {}) })
    .eq('id', expected.id).is('ended_at', null).eq('active_character', expected.active_character)
    .eq('handoff_count', expected.handoff_count);
  if (expected.resume_expires_at) query = query.gt('resume_expires_at', new Date().toISOString());
  query = expected.orchestration_version_id === null ? query.is('orchestration_version_id', null)
    : query.eq('orchestration_version_id', expected.orchestration_version_id);
  query = expected.pending_handoff === null ? query.is('pending_handoff', null)
    : query.eq('pending_handoff', JSON.stringify(expected.pending_handoff));
  const { data, error } = await query.select('id').abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(HANDOFF_DEPENDENCY_TIMEOUT_MS)]) : AbortSignal.timeout(HANDOFF_DEPENDENCY_TIMEOUT_MS)).maybeSingle();
  if (error) {
    if (!signal?.aborted) {
      const acknowledged = await readHandoffSnapshot(expected.id).catch(() => null);
      if (acknowledged && matchesHandoffWrite(acknowledged, { ...expected, active_character: gridTarget ?? expected.active_character }, next, target)
        && (!conversation || JSON.stringify(orderedJson(acknowledged.conversation_log)) === JSON.stringify(orderedJson(conversation)))) return acknowledged;
    }
    throw error;
  }
  if (!data) throw new HandoffConflictError();
  return { ...expected, pending_handoff: next as unknown as Json,
    ...(gridTarget ? { active_character: gridTarget } : {}),
    ...(conversation ? { conversation_log: conversation } : {}),
    ...(target ? { active_character: target, handoff_count: expected.handoff_count + 1 } : {}) };
}

export async function revalidateHandoffCall(expected: HandoffSnapshot) {
  const { parseHandoffState, restoreHandoffOffer } = await import('./characterHandoffState');
  const { fetchPinnedDirectorRuntime, getCharacterRuntimeReadiness } = await import('./experienceOrchestration');
  const { validateDirectorDecision } = await import('./experienceDirector');
  const { lastHandoffUserTurn } = await import('./characterConversation');
  const state = parseHandoffState(expected.pending_handoff);
  if (!state?.offer || state.state !== 'available') throw new HandoffConflictError();
  const [current, runtime, profile] = await withTimeout('handoff_revalidation', Promise.all([readHandoffSnapshot(expected.id),
    fetchPinnedDirectorRuntime(expected.id), getCharacterRuntimeReadiness(state.offer.targetCharacter)]), HANDOFF_DEPENDENCY_TIMEOUT_MS);
  const actual = parseHandoffState(current.pending_handoff);
  if ((state.sourceCallId && state.sourceCallId !== sourceCallId(current))
    || actual?.revision !== state.revision || current.active_character !== state.sourceCharacter
    || current.handoff_count !== expected.handoff_count || current.orchestration_version_id !== state.orchestrationVersionId
    || runtime.versionId !== state.orchestrationVersionId) throw new HandoffConflictError();
  const turnIndex = current.conversation_log.filter(m => m.role === 'user').length;
  const offer = restoreHandoffOffer(current.pending_handoff, { ...state, turnIndex }, current.conversation_log);
  if (!offer) throw new HandoffConflictError();
  const config = runtime.config;
  const guard = validateDirectorDecision({ labels: { themes: [], topics: [], intentions: [] }, nextTurnGuidance: null,
    memoryDelta: null, action: { type: 'handoff', targetCharacter: offer.targetCharacter,
      reason: offer.reason, proposalGuidance: offer.proposalGuidance } }, {
    configPublished: Boolean(runtime.versionId && config), currentCharacter: current.active_character, userTurn: turnIndex,
    completedExchanges: completedCallExchanges(current.conversation_log, current.active_character),
    handoffCount: current.handoff_count, handoffPending: false, lastHandoffTurn: lastHandoffUserTurn(current.conversation_log),
    handoffsEnabled: config?.editor.allowHandoffs ?? false, minimumHandoffTurn: config?.minimumHandoffTurn ?? 4,
    maximumHandoffsPerSession: config?.maximumHandoffsPerSession ?? 1,
    minimumTurnsBetweenHandoffs: config?.minimumTurnsBetweenHandoffs ?? 2,
    targetReady: profile?.enabled === true && profile.ready === true && Boolean(config?.activeCharacters.includes(offer.targetCharacter)), resultIsCurrent: true,
    playedVideoIds: [], availableVideoIds: [], lastVideoTurn: null, minimumVideoTurn: 0,
    minimumTurnsBetweenVideos: 0, maximumVideosPerSession: 0, cinematicsEnabled: false,
  });
  return { snapshot: current, state: actual, offer, profile, blockedReason: guard.blockedReason };
}
