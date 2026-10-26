import type { ConversationMessage, RuntimeCharacter } from '@/types';
import { parseHandoffState, type HandoffState } from './characterHandoffState';
import type { HandoffSnapshot } from './sessionHandoff';

/** Metadata on the scripted greeting; never a user turn or a private-memory delta. */
export interface CallStart {
  id: string;
  startedAt: number;
  durationSeconds: number;
  remainingSeconds: number;
  deadlineAt: number;
}
export interface CallClose { at: number; remainingSeconds: number; reason: string }
export const TECHNICAL_RESUME_SECONDS = 4 * 60 * 60;

export function currentCall(history: ConversationMessage[]) {
  return [...history].reverse().find(m => m.callStart);
}
export function callTime(history: ConversationMessage[], now = Date.now()) {
  const message = currentCall(history);
  const start = message?.callStart;
  if (!start || !Number.isFinite(start.deadlineAt) || !Number.isFinite(start.durationSeconds)
    || start.durationSeconds <= 0 || !Number.isFinite(start.remainingSeconds) || start.remainingSeconds < 0) return null;
  const remainingSeconds = Math.max(0, Math.min(start.remainingSeconds,
    message.callClose?.remainingSeconds ?? Math.ceil((start.deadlineAt - now) / 1000)));
  return { configuredDurationSeconds: start.durationSeconds,
    elapsedSeconds: start.durationSeconds - remainingSeconds, remainingSeconds, paused: Boolean(message.callClose) };
}
export function newCall(durationSeconds: number, remainingSeconds = durationSeconds, now = Date.now()): CallStart {
  return { id: crypto.randomUUID(), startedAt: now, durationSeconds, remainingSeconds, deadlineAt: now + remainingSeconds * 1000 };
}
export function sourceCallId(snapshot: HandoffSnapshot) {
  return currentCall(snapshot.conversation_log)?.callStart?.id ?? `${snapshot.id}:${snapshot.handoff_count}`;
}
export function freshCallState(snapshot: HandoffSnapshot, character: RuntimeCharacter, callId: string): HandoffState {
  if (!snapshot.orchestration_version_id) throw new Error('Version de l’expérience indisponible. Recharge la page.');
  return { schemaVersion: 2, sessionId: snapshot.id, sourceCharacter: character,
    orchestrationVersionId: snapshot.orchestration_version_id, turnId: `${callId}:opening`,
    turnIndex: Math.max(1, snapshot.conversation_log.filter(m => m.role === 'user').length),
    requestId: crypto.randomUUID(), sourceCallId: callId, revision: crypto.randomUUID(), state: 'none', openRequest: null, offer: null };
}
export function closedCallHistory(history: ConversationMessage[], close: CallClose) {
  const last = currentCall(history);
  if (!last) throw new Error('Identité d’appel absente. Recharge la page.');
  return history.map(m => m === last ? { ...m, callClose: close } : m);
}

// A tab-local close intent survives reload/offline. Contains IDs and timing only.
export interface PendingCallClose extends CallClose { callId: string; revision: string | null }
const closeKey = (id: string) => `ava:pending-call-close:${id}`;
export function savePendingCallClose(id: string, value: PendingCallClose) {
  sessionStorage.setItem(closeKey(id), JSON.stringify(value));
}
export function readPendingCallClose(id: string): PendingCallClose | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(closeKey(id)) ?? 'null');
    return raw && typeof raw.callId === 'string' && Number.isFinite(raw.at) && Number.isFinite(raw.remainingSeconds)
      && raw.remainingSeconds >= 0 && (raw.revision === null || typeof raw.revision === 'string') ? raw : null;
  } catch { return null; }
}
export function clearPendingCallClose(id: string) { sessionStorage.removeItem(closeKey(id)); }
export function canApplyPendingClose(snapshot: HandoffSnapshot, close: PendingCallClose) {
  return sourceCallId(snapshot) === close.callId && (parseHandoffState(snapshot.pending_handoff)?.revision ?? null) === close.revision;
}

/** Upgrade only the existing current-call greeting; keep its exchanges and offer identity. */
export function withLegacyCallMarker(snapshot: HandoffSnapshot, duration: number, remaining: number, now = Date.now()) {
  if (currentCall(snapshot.conversation_log) || !snapshot.conversation_log.length) return snapshot.conversation_log;
  const transfers = snapshot.conversation_log.map((message, index) => message.callTransfer ? index : -1).filter(index => index >= 0);
  const index = transfers.at(-1) ?? 0;
  const history = [...snapshot.conversation_log];
  history[index] = { ...history[index], callStart: { ...newCall(duration, remaining, now),
    id: sourceCallId(snapshot), startedAt: history[index].timestamp } };
  return history;
}
