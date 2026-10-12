/**
 * Conversation mains libres : détection de fin de parole et interruption
 * (barge-in). Logique pure, indépendante du fournisseur de reconnaissance
 * vocale : elle ne regarde que le texte reconnu et le temps écoulé.
 */

export interface HandsFreeVoiceSettings {
  /** Micro ouvert en continu : aucun bouton à presser pour parler ou finir. */
  enabled: boolean;
  /** Silence après le dernier mot reconnu avant que le personnage réponde. */
  endOfSpeechMs: number;
  /** Attente supplémentaire quand la phrase semble inachevée (« euh », « et… », virgule). */
  hesitationExtraMs: number;
  /** Le joueur peut couper la parole au personnage en parlant. */
  bargeInEnabled: boolean;
  /** Nombre de mots reconnus nécessaires pour interrompre (évite toux, bruits, écho). */
  bargeInMinWords: number;
}

export const END_OF_SPEECH_MIN_MS = 300;
export const END_OF_SPEECH_MAX_MS = 3_000;
export const HESITATION_EXTRA_MAX_MS = 3_000;
export const BARGE_IN_MIN_WORDS_MIN = 1;
export const BARGE_IN_MIN_WORDS_MAX = 6;

export const HANDS_FREE_DEFAULTS: HandsFreeVoiceSettings = {
  enabled: false,
  endOfSpeechMs: 900,
  hesitationExtraMs: 700,
  bargeInEnabled: true,
  bargeInMinWords: 2,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeHandsFreeSettings(raw: Partial<HandsFreeVoiceSettings> | null | undefined): HandsFreeVoiceSettings {
  const value = raw ?? {};
  return {
    enabled: value.enabled === true,
    endOfSpeechMs: clamp(value.endOfSpeechMs, END_OF_SPEECH_MIN_MS, END_OF_SPEECH_MAX_MS, HANDS_FREE_DEFAULTS.endOfSpeechMs),
    hesitationExtraMs: clamp(value.hesitationExtraMs, 0, HESITATION_EXTRA_MAX_MS, HANDS_FREE_DEFAULTS.hesitationExtraMs),
    bargeInEnabled: value.bargeInEnabled !== false,
    bargeInMinWords: clamp(value.bargeInMinWords, BARGE_IN_MIN_WORDS_MIN, BARGE_IN_MIN_WORDS_MAX, HANDS_FREE_DEFAULTS.bargeInMinWords),
  };
}

const HESITANT_LAST_WORDS = new Set([
  "euh", "heu", "hum", "hmm", "mmh", "ben", "bah", "bon", "enfin", "genre",
  "et", "mais", "ou", "donc", "alors", "puis", "parce", "que", "qui", "car", "si", "comme", "quand",
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "à", "au", "aux", "en", "pour", "avec", "sur", "dans",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "mon", "ma", "mes", "ton", "ta", "son", "sa",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** La phrase semble inachevée : mot de liaison, hésitation, virgule ou points de suspension. */
export function isHesitantEnding(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/(,|…|\.\.\.|-)$/.test(trimmed)) return true;
  if (/[.!?]$/.test(trimmed)) return false;
  const list = words(trimmed);
  const last = list[list.length - 1];
  if (!last) return false;
  const lastAccentless = last.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return HESITANT_LAST_WORDS.has(last) || HESITANT_LAST_WORDS.has(lastAccentless) || last === "a";
}

/** Délai de silence à attendre avant de considérer que le joueur a fini de parler. */
export function endOfSpeechDelayMs(text: string, settings: HandsFreeVoiceSettings): number {
  return settings.endOfSpeechMs + (isHesitantEnding(text) ? settings.hesitationExtraMs : 0);
}

/**
 * Le joueur coupe-t-il la parole au personnage ?
 * Ignore les bruits courts et l'écho : si presque tous les mots entendus
 * appartiennent à la réplique en cours du personnage, c'est le haut-parleur.
 */
export function shouldBargeIn(heardText: string, characterText: string, settings: HandsFreeVoiceSettings): boolean {
  if (!settings.enabled || !settings.bargeInEnabled) return false;
  const heard = words(heardText);
  if (heard.length < settings.bargeInMinWords) return false;
  const spoken = new Set(words(characterText));
  if (spoken.size === 0) return true;
  const echoed = heard.filter((word) => spoken.has(word)).length;
  return echoed / heard.length < 0.8;
}
