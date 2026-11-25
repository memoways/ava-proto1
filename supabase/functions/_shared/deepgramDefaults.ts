/** Shared by the Edge token proxy and the browser runtime to prevent drift. */
export const DEEPGRAM_DEFAULT_MODEL = "nova-3";
/**
 * Nova-3 multilingual. French, English and German are hinted; Deepgram still
 * transcribes another supported language if it hears one.
 */
export const DEEPGRAM_DEFAULT_LANGUAGE = "multi";
export const DEEPGRAM_INPUT_LANGUAGE_HINTS = ["fr", "en", "de"] as const;

const LEGACY_FRENCH_ONLY = new Set(["fr", "fr-fr"]);

/**
 * The historical French-only values become automatic detection among
 * French, English and German. Any other explicit code is kept as a single language.
 */
export function resolveDeepgramLanguage(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.toLowerCase() === "multi" || LEGACY_FRENCH_ONLY.has(text.toLowerCase())) {
    return DEEPGRAM_DEFAULT_LANGUAGE;
  }
  return text;
}
