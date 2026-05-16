/**
 * Provider-agnostic text preparation for TTS.
 * Strips markdown, narration brackets, and normalises punctuation so every TTS
 * provider receives clean French prose.
 */
export function prepareTextForTTS(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[_`#>]/g, "")
    .replace(/\[(?:il|elle|max)\s+[^\]]+\]/gi, "")
    .replace(/\((?:il|elle|max)\s+[^)]+\)/gi, "")
    .replace(/\bA\.V\.A\.\b/g, "Ava")
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
