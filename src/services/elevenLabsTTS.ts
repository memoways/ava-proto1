/**
 * Backward-compat shim — re-exports from the new TTS façade (src/services/tts/).
 *
 * Kept so existing imports (`@/services/elevenLabsTTS`) continue to work after the
 * Phase 1 multi-provider refactor. New code should import from `@/services/tts`.
 */

export {
  generateSpeech,
  playAudioBlob,
  speakText,
  prepareTextForTTS,
  chunkTextForTTS,
  extractSentences,
  type TTSOptions,
} from "@/services/tts";

export { TTSQueue } from "@/services/tts/queue";
