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
  interruptionStrategy?: "text" | "acoustic_confirmed";
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
  interruptionStrategy: "text",
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
    interruptionStrategy: value.interruptionStrategy === "acoustic_confirmed" ? "acoustic_confirmed" : "text",
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

export function recognizedWordsChanged(previous: string, next: string): boolean {
  return words(previous).join(" ") !== words(next).join(" ");
}

export interface ReversibleVoiceOutput {
  attenuate(): boolean;
  pause(): boolean;
  resume(): boolean;
  playedText(): string;
}
export type InterruptionEvent = "acoustic_candidate" | "attenuation" | "audio_suspended" | "interruption_confirmed" | "interruption_rejected" | "audio_resumed" | "interruption_recovery";
export interface InterruptionObservation { interruption_id: string; event: InterruptionEvent; at: number }

/** Application authority. STT and local VAD only supply evidence; neither commits a turn. */
export function createAcousticInterruptionController(hooks: {
  observe: (event: InterruptionObservation) => void;
  confirm: (text: string) => void;
  recover: () => void;
}) {
  let candidate: { id: string; start: number; lastVoice: number; voiced: boolean; paused: boolean;
    baseline: string; output: ReversibleVoiceOutput } | null = null;
  const event = (name: InterruptionEvent, at: number) => {
    if (candidate) hooks.observe({ interruption_id: candidate.id, event: name, at });
  };
  const reject = (at: number) => {
    if (!candidate) return;
    event("interruption_rejected", at);
    if (candidate.output.resume()) event("audio_resumed", at);
    candidate = null;
  };
  return {
    get pending() { return candidate !== null; },
    reset() { reject(performance.now()); },
    signal(voiced: boolean, at: number, output: ReversibleVoiceOutput | null, baseline: string) {
      if (!candidate && voiced && output) {
        candidate = { id: crypto.randomUUID(), start: at, lastVoice: at, voiced: true, paused: false, baseline, output };
        event("acoustic_candidate", at);
        if (!output.attenuate()) { candidate = null; return; }
        event("attenuation", at);
      }
      if (!candidate) return;
      candidate.voiced = voiced;
      if (voiced) candidate.lastVoice = at;
      if (voiced && !candidate.paused && at - candidate.start >= 120) {
        candidate.paused = candidate.output.pause();
        if (candidate.paused) event("audio_suspended", at);
      }
      if (at - candidate.start >= 8000) {
        if (voiced || at - candidate.lastVoice < 300) {
          event("interruption_recovery", at); candidate = null; hooks.recover();
        } else reject(at);
      } else if (!voiced && at - candidate.lastVoice >= 450 && at - candidate.start >= 1400) reject(at);
    },
    transcript(text: string, at: number): boolean {
      if (!candidate || at < candidate.start || at - candidate.lastVoice > 1400) return false;
      let heard = text.trim();
      if (candidate.baseline && heard.startsWith(candidate.baseline)) heard = heard.slice(candidate.baseline.length).trim();
      if (!heard || !recognizedWordsChanged(candidate.baseline, text)) return false;
      const h = words(heard), played = words(candidate.output.playedText()).slice(-24);
      // Only a contiguous actually played phrase is echo evidence. Shared vocabulary
      // with the generated reply cannot veto a correction; short yes/no remain valid.
      const isEcho = h.length >= 3 && played.join(" ").includes(h.join(" "));
      if (isEcho) { reject(at); return false; }
      event("interruption_confirmed", at);
      candidate = null;
      hooks.confirm(heard);
      return true;
    },
    sttFailed(at: number) {
      if (!candidate) return;
      if (candidate.voiced || at - candidate.lastVoice < 300) {
        event("interruption_recovery", at); candidate = null; hooks.recover();
      } else reject(at);
    },
  };
}
