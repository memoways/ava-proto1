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
