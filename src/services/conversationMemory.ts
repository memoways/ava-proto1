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

/** Cuts a message to `budget` characters, ending with an ellipsis when it was shortened. */
function truncateMessage(message: ConversationMessage, budget: number): ConversationMessage {
  if (message.content.length <= budget) return message;
  return { ...message, content: `${message.content.slice(0, Math.max(0, budget - 1)).trimEnd()}…` };
}

/**
 * Latency lot 3: the last exchange alone can exceed the budget. Instead of sending no
 * history at all, keep it, each message cut in proportion to its length.
 */
function truncateExchange(exchange: ConversationMessage[], targetChars: number): ConversationMessage[] {
  const total = exchange.reduce((sum, message) => sum + message.content.length, 0);
  if (total <= targetChars) return exchange;
  return exchange.map((message) =>
    truncateMessage(message, Math.max(1, Math.floor((targetChars * message.content.length) / total))),
  );
}

/**
 * optimized_v3 : garde deux échanges complets et étend temporairement la
 * fenêtre aux tours que la mémoire structurée n'a pas encore absorbés.
 * Si le dernier échange dépasse à lui seul le budget, il est gardé tronqué.
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
  if (selected.length === 0 && candidates.length > 0 && targetChars > 0) {
    return truncateExchange(candidates.slice(-Math.min(2, maxMessages)), targetChars);
  }
  return selected;
}
