import { TAVUS_ECHO_EMOTIONS, type TavusEchoEmotion, type TavusEmotion } from "./types";

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
 * which overrides `set_emotion` and brings back the smile. Since lot 1 the Echo tag
 * is its own setting; this table only derives it for settings saved before.
 */
export const TAVUS_ECHO_EMOTION_TAGS: Record<TavusEmotion, TavusEchoEmotion> = {
  sadness: "dejected",
  fear: "scared",
  anger: "angry",
  disgust: "disgusted",
  contempt: "contempt",
  surprise: "surprised",
  neutral: "neutral",
  happiness: "content",
};

/** Any `<emotion value="…"/>` tag (quotes, case and closing slash tolerated) and its trailing space. */
const EMOTION_TAG_PATTERN = /<emotion\s+value\s*=\s*["'][a-z_-]*["']\s*\/?>\s*/gi;

export function stripTavusEmotionTags(text: string): string {
  return text.replace(EMOTION_TAG_PATTERN, "");
}

export function isTavusEchoEmotion(value: unknown): value is TavusEchoEmotion {
  return TAVUS_ECHO_EMOTIONS.includes(value as TavusEchoEmotion);
}

/** Echo text command; the tag is only written for one of the 11 documented Echo values. */
export function buildTavusEchoCommand(
  conversationId: string,
  text: string,
  echoEmotion?: TavusEchoEmotion,
) {
  const tag = isTavusEchoEmotion(echoEmotion) ? `<emotion value="${echoEmotion}"/> ` : "";
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
 * Tavus Echo audio, as verified on a real conversation (6 November 2026, PAL `pipecat0`):
 * `modality: "audio"`, mono PCM16 little-endian in base64, `sample_rate` 24000 (16000 also
 * accepted). Chunks of one line share an `inference_id`; `done` marks the last chunk of the
 * line. Tavus ends a line (`stopped_speaking`) whenever its audio queue runs dry, `done` or not.
 */
export const TAVUS_ECHO_AUDIO_SAMPLE_RATE = 24_000;
/** 250 ms per message: first sound ~0.6 s after sending, against ~1.2 s for one large message. */
export const TAVUS_ECHO_AUDIO_CHUNK_MS = 250;

export function buildTavusEchoAudioCommand(
  conversationId: string,
  audioBase64: string,
  sampleRate: number,
  inferenceId: string,
  done: boolean,
) {
  return {
    message_type: "conversation",
    event_type: "conversation.echo",
    conversation_id: conversationId,
    properties: {
      modality: "audio",
      audio: audioBase64,
      sample_rate: sampleRate,
      inference_id: inferenceId,
      done,
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
