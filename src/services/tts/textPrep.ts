import { normalizeCharacterNames } from "@/services/characterNames";
import { stripTavusEmotionTags } from "@/services/streamingAvatar/protocolCommands";

/**
 * Provider-agnostic text preparation for TTS.
 * Strips markdown, narration brackets, and normalises punctuation so every TTS
 * provider receives clean French prose.
 */
export function prepareTextForTTS(text: string): string {
  // A Tavus Echo tag is face-only: never read aloud (removing `>` alone left `<emotion value=…/`).
  return normalizeCharacterNames(stripTavusEmotionTags(text))
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[_`#>]/g, "")
    .replace(/\[(?:il|elle|max)\s+[^\]]+\]/gi, "")
    .replace(/\((?:il|elle|max)\s+[^)]+\)/gi, "")
    .replace(/\bA\.V\.A\.?/g, (match, offset: number, whole: string) =>
      match.endsWith(".") && /^\s*(?:$|[A-ZÀ-Ý«"])/.test(whole.slice(offset + match.length)) ? "Ava." : "Ava")
    .replace(/\bIA\b/g, "I A")
    .replace(/\bRAG\b/g, "rague")
    .replace(/\bSTT\b/g, "S T T")
    .replace(/\bTTS\b/g, "T T S")
    .replace(/\bGM\b/g, "game master")
    .replace(/…/g, "...")
    .replace(/\.{4,}/g, "...")
    .replace(/[◆•]/g, ",")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/([,;:.!?])(?=\S)/g, "$1 ")
    .replace(/\. \. \./g, "...")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
