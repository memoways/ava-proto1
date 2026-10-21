import { supabase } from '@/integrations/supabase/client';
import { ensureGameAuth } from './gameAuth';
import type { ConversationMessage, RuntimeCharacter } from '@/types';
import type { Json } from '@/integrations/supabase/types';
import type { HandoffState } from './characterHandoffState';

export interface HandoffSnapshot {
  id: string;
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
    .select('id,active_character,orchestration_version_id,handoff_count,pending_handoff,conversation_log')
    .eq('id', sessionId).is('ended_at', null).single();
  if (error) throw error;
  if (!data || (data.active_character !== 'max' && data.active_character !== 'emma')) throw new HandoffConflictError();
  return { ...data, active_character: data.active_character, handoff_count: data.handoff_count ?? 0,
    conversation_log: Array.isArray(data.conversation_log) ? data.conversation_log as unknown as ConversationMessage[] : [] };
}

/** One conditional UPDATE. No read-then-write emulation; a zero-row success is a conflict. */
export async function writeHandoffSnapshot(expected: HandoffSnapshot, next: HandoffState,
  target?: RuntimeCharacter, conversation?: ConversationMessage[]): Promise<HandoffSnapshot> {
  await ensureGameAuth();
  let query = supabase.from('sessions').update({ pending_handoff: next as unknown as Json,
    ...(conversation ? { conversation_log: JSON.parse(JSON.stringify(conversation)) as Json } : {}),
    ...(target ? { active_character: target, personnage_appele: target, handoff_count: expected.handoff_count + 1 } : {}) })
    .eq('id', expected.id).is('ended_at', null).eq('active_character', expected.active_character)
    .eq('handoff_count', expected.handoff_count);
  query = expected.orchestration_version_id === null ? query.is('orchestration_version_id', null)
    : query.eq('orchestration_version_id', expected.orchestration_version_id);
  query = expected.pending_handoff === null ? query.is('pending_handoff', null)
    : query.eq('pending_handoff', JSON.stringify(expected.pending_handoff));
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new HandoffConflictError();
  return { ...expected, pending_handoff: next as unknown as Json,
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
  const [current, runtime, profile] = await Promise.all([readHandoffSnapshot(expected.id),
    fetchPinnedDirectorRuntime(expected.id), getCharacterRuntimeReadiness(state.offer.targetCharacter)]);
  const actual = parseHandoffState(current.pending_handoff);
  if (actual?.revision !== state.revision || current.active_character !== state.sourceCharacter
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
    handoffCount: current.handoff_count, handoffPending: false, lastHandoffTurn: lastHandoffUserTurn(current.conversation_log),
    handoffsEnabled: config?.editor.allowHandoffs ?? false, minimumHandoffTurn: config?.minimumHandoffTurn ?? 4,
    maximumHandoffsPerSession: config?.maximumHandoffsPerSession ?? 1,
    minimumTurnsBetweenHandoffs: config?.minimumTurnsBetweenHandoffs ?? 2,
    targetReady: profile?.enabled === true && profile.ready === true, resultIsCurrent: true,
    playedVideoIds: [], availableVideoIds: [], lastVideoTurn: null, minimumVideoTurn: 0,
    minimumTurnsBetweenVideos: 0, maximumVideosPerSession: 0, cinematicsEnabled: false,
  });
  return { snapshot: current, state: actual, offer, profile, blockedReason: guard.blockedReason };
}
