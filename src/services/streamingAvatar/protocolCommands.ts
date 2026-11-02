import type { TavusEmotion } from "./types";

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

/**
 * Echo-mode text tags (a different vocabulary from `set_emotion`). Tavus requires
 * them in Echo mode: an untagged text echo lets the face pick its own emotion,
 * which overrides `set_emotion` and brings back the smile.
 */
export const TAVUS_ECHO_EMOTION_TAGS: Record<TavusEmotion, string> = {
  sadness: "dejected",
  fear: "scared",
  anger: "angry",
  disgust: "disgusted",
  contempt: "contempt",
  surprise: "surprised",
  neutral: "neutral",
  happiness: "content",
};

const EMOTION_TAG_PATTERN = /<emotion\s+value="[a-z]+"\s*\/>\s*/g;

export function stripTavusEmotionTags(text: string): string {
  return text.replace(EMOTION_TAG_PATTERN, "");
}

export function buildTavusEchoCommand(
  conversationId: string,
  text: string,
  emotion?: TavusEmotion,
) {
  const tag = emotion ? `<emotion value="${TAVUS_ECHO_EMOTION_TAGS[emotion]}"/> ` : "";
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "text",
      text: `${tag}${text}`,
      done: true,
    },
  } as const;
}

/**
 * Tavus holds this facial emotion while listening and speaking, until the next
 * `conversation.set_emotion`. Echo text tags still decide each spoken line.
 */
export function buildTavusSetEmotionCommand(conversationId: string, emotion: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.set_emotion",
    conversation_id: conversationId,
    properties: { emotion },
  } as const;
}

/** Stops the current Tavus line at once; the next echo starts clean. */
export function buildTavusInterruptCommand(conversationId: string) {
  return {
    message_type: "conversation",
    event_type: "conversation.interrupt",
    conversation_id: conversationId,
  } as const;
}

/**
 * LiveAvatar `avatar.start_listening` / `avatar.stop_listening` (SDK 0.0.19): posture only.
 * The SDK voice chat stays muted, so no microphone audio ever reaches LiveAvatar.
 */
export function sendHeyGenListening(
  session: { startListening: () => string; stopListening: () => string },
  listening: boolean,
): string {
  return listening ? session.startListening() : session.stopListening();
}
