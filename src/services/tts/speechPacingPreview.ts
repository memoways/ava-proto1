import { derivePerformanceIntent, isHeatedIntent, pacingEntryFor, pacingFromHistory, recordPacing, type PacingEntry } from './performanceIntent';
import type { SpeechPerformanceSettings } from './speechPerformanceSettings';

/** The first saved state of a character that is voiced as a flare-up. */
export function heatedStateName(settings: SpeechPerformanceSettings, characterKey: string): string | null {
  const states = settings.byCharacter?.[characterKey] ?? {};
  return Object.keys(states).find(name => isHeatedIntent(states[name])) ?? null;
}

/**
 * What the voice would play if the character picked this state on every reply, at full
 * roughness: the worst case of the pacing rules, computed by the game's own derivation.
 */
export function previewHeatedSequence(settings: SpeechPerformanceSettings, characterKey: string, state: string, replies = 8) {
  let history: PacingEntry[] = [];
  return Array.from({ length: replies }, (_, index) => {
    const turnId = `preview-${index}`;
    const intent = derivePerformanceIntent({ text: '', characterKey, speechState: state, validSpeechStates: [state], rugosite: 3,
      speechSettings: { ...settings, enabled: true }, pacing: pacingFromHistory(history, turnId) });
    history = recordPacing(history, pacingEntryFor(turnId, intent));
    const kind = intent.outburst ? 'éclat' : isHeatedIntent(intent) ? 'moment chaud' : intent.tempered ? 'retenu' : 'jeu calme';
    return { reply: index + 1, kind, intensity: intent.intensity };
  });
}
