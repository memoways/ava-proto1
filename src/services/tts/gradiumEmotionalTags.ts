/** Future capability gate: no documented emotional-tag vocabulary approved yet. */
export const GRADIUM_EMOTIONAL_TAGS_AVAILABLE = false;
export function adaptGradiumEmotionalTags(text: string, _state: string | undefined, _enabled = false): string {
  return text; // Deliberately no-op even when the experimental flag is manipulated.
}
