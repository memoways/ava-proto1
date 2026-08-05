import { MAX_RECENT_CONVERSATION_MESSAGES } from "@/config/experienceRuntime";
import type { ConversationMessage } from "@/types";

export function selectRecentConversation(
  conversation: ConversationMessage[],
  maxMessages = MAX_RECENT_CONVERSATION_MESSAGES,
): ConversationMessage[] {
  if (maxMessages <= 0) return [];
  return conversation.slice(-maxMessages);
}

/**
 * Keeps only exchanges not already represented by the persisted summary.
 * The caller can append the current user/Max pair before invoking this helper.
 */
export function selectUnsummarizedConversation(
  conversation: ConversationMessage[],
  lastSummarizedTurn: number,
  maxMessages = 24,
): ConversationMessage[] {
  let userTurn = 0;
  const unsummarized: ConversationMessage[] = [];

  for (const message of conversation) {
    if (message.role === "user") userTurn += 1;
    if (userTurn > lastSummarizedTurn) unsummarized.push(message);
  }

  return unsummarized.slice(-maxMessages);
}

/**
 * optimized_v3 : garde deux échanges complets et étend temporairement la
 * fenêtre aux tours que la mémoire structurée n'a pas encore absorbés.
 */
export function selectOptimizedConversation(
  conversation: ConversationMessage[],
  memoryLastTurn: number,
  maxMessages = 8,
  targetChars = 1_200,
): ConversationMessage[] {
  const recent = conversation.slice(-4);
  const unsummarized = selectUnsummarizedConversation(conversation, memoryLastTurn, maxMessages);
  const candidateCount = Math.min(maxMessages, Math.max(recent.length, unsummarized.length));
  const candidates = conversation.slice(-candidateCount);
  const selected: ConversationMessage[] = [];
  let usedChars = 0;
  for (let index = candidates.length - 1; index >= 0 && selected.length < maxMessages; index -= 2) {
    const exchange = candidates.slice(Math.max(0, index - 1), index + 1);
    const exchangeChars = exchange.reduce((sum, message) => sum + message.content.length, 0);
    if (usedChars + exchangeChars > targetChars || selected.length + exchange.length > maxMessages) break;
    selected.unshift(...exchange);
    usedChars += exchangeChars;
  }
  return selected;
}
