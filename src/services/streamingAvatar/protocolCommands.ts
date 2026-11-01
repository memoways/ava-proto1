/**
 * Provider commands are deliberately isolated here so Ava's final text cannot
 * accidentally be routed through a provider-side conversational command.
 */
export function sendHeyGenSpeakText(
  session: { repeat: (text: string) => string },
  text: string,
): string {
  // LiveAvatarSession.repeat() is the SDK wrapper for `avatar.speak_text`.
  return session.repeat(text);
}

export function buildTavusEchoCommand(conversationId: string, text: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text,
      done: true,
    },
  } as const;
}

/**
 * Tavus holds this facial emotion while listening and speaking, until the next
 * `conversation.set_emotion`. Without it Phoenix faces default to a friendly smile.
 */
export function buildTavusSetEmotionCommand(conversationId: string, emotion: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.set_emotion",
    conversation_id: conversationId,
    properties: { emotion },
  } as const;
}
