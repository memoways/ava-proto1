import type { TTSProviderId } from './types';
export const AUDITION_PROVIDERS: TTSProviderId[] = ['gradium','hume','inworld','elevenlabs','cartesia'];
export const AUDITION_LEVELS = [1,2,3] as const;
export interface AuditionLine { state: string; variants: [string,string,string] }
const CORPUS: Record<string, string[]> = {
 max: ['Je ne sais pas où elle est.', 'Attends, laisse-moi reprendre.', 'Elle devait rentrer à Lausanne.', 'Non, ce n’est pas ce que je voulais dire.', 'Je veux juste entendre sa voix.', 'Tu dis que tu l’as vue ?', 'Je n’arrive pas à finir cette phrase.', 'Emma et moi, on attend.', 'Je t’écoute. Continue.', 'Ava. Je pensais à Ava.'],
 emma: ['Je ne sais pas quoi te répondre.', 'Attends, je reprends.', 'Je pensais qu’elle allait rentrer.', 'Non, ce n’est pas ce que je voulais dire.', 'J’aimerais entendre sa voix.', 'Tu l’as vraiment vue ?', 'C’est difficile à dire.', 'Max et moi, on attend.', 'Oui, je t’écoute.', 'Ava. Je pensais à Ava.'],
};
export function createAuditionCorpus(character: string, states: string[]): AuditionLine[] {
 const lines = CORPUS[character] ?? CORPUS.max;
 return Array.from({length:10}, (_, i) => { const text=lines[i]; return {state:states[i%Math.max(1,states.length)] ?? '',variants:[text, `Euh… ${text}`, `Je… je — ${text}`]}; });
}
export function auditionCount(lines: AuditionLine[]) { return lines.length * AUDITION_LEVELS.length * AUDITION_PROVIDERS.length; }
export function auditionVoice(voices: Record<string,string>, character: string, provider: TTSProviderId): string | null { return voices[`${character}:${provider}`]?.trim() || null; }
