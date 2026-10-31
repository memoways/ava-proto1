/**
 * Canonical acting intent for per-turn TTS, plus provider adapters.
 *
 * Derived from the spoken line (no extra LLM). Providers map this to their
 * own knobs: Fish Audio emotion markers, Inworld `instruction`, ElevenLabs sliders /
 * v3 tags, Gradium temp/padding, Cartesia generation_config.
 */

import type { TTSProviderId } from "./types";
import { getActiveEnvironment } from '../environmentContext';
import { getSpeechPerformanceSettings, type SpeechPerformanceSettings } from './speechPerformanceSettings';
import { supportsElevenLabsAudioTags } from "../../../supabase/functions/_shared/elevenLabsModels";
import type { GradiumPauseSeconds } from './gradiumSpeech';

export type CanonicalEmotion =
  | "neutral"
  | "tense"
  | "angry"
  | "sad"
  | "scared"
  | "fragile"
  | "warm"
  | "accusatory"
  | "sarcastic"
  | "urgent";

export type PerformanceDelivery = "measured" | "whisper" | "rushed" | "cutting";
export type PerformanceSource = "lexicon" | "gm_memory" | "manual" | "speech_state";
export type PerformanceIntensity = 0 | 1 | 2;

export interface PerformanceIntent {
  emotion: CanonicalEmotion;
  intensity: PerformanceIntensity;
  delivery?: PerformanceDelivery;
  /** English, ≤100 chars — Inworld acting instructions. */
  actingNl: string;
  speedHint?: number;
  source: PerformanceSource;
  speechState?: string;
  pauses?: 'short' | 'normal' | 'long';
  mappingVersion?: string;
}

export interface DerivePerformanceInput {
  text: string;
  characterKey?: string | null;
  previousEmotionalState?: string | null;
  userMessage?: string | null;
  speechState?: string | null;
  rugosite?: number;
  validSpeechStates?: string[];
  speechSettings?: SpeechPerformanceSettings;
}

export const CANONICAL_EMOTIONS: CanonicalEmotion[] = [
  "neutral",
  "tense",
  "angry",
  "sad",
  "scared",
  "fragile",
  "warm",
  "accusatory",
  "sarcastic",
  "urgent",
];

/** How much a provider can actually perform the canonical acting intent. */
export type ActingUsability = "audible" | "weak" | "speed_only" | "en_emotion_only";

export interface ProviderActingSupport {
  usability: ActingUsability;
  /** Short badge in Admin → TTS Config. */
  labelFr: string;
  /** One-line explanation under the badge / in the audition matrix. */
  detailFr: string;
}

export const PROVIDER_ACTING_SUPPORT: Record<TTSProviderId, ProviderActingSupport> = {
  fish: {
    usability: "audible",
    labelFr: "Oui — audible",
    detailFr: "Marqueur d'émotion Fish (ex. (sad), (whispering)) ajouté par l'app depuis l'état du tour, plus vitesse.",
  },
  inworld: {
    usability: "audible",
    labelFr: "Oui — audible",
    detailFr: "Instruction d'acting envoyée à chaque tour (modèle TTS-2).",
  },
  elevenlabs: {
    usability: "weak",
    labelFr: "Faible",
    detailFr: "Sliders style / stabilité / vitesse. Balises [angry] seulement avec les modèles v3 / v4.",
  },
  gradium: {
    usability: "speed_only",
    labelFr: "Très faible",
    detailFr: "Température et rythme seulement — pas d'émotion nommée.",
  },
  cartesia: {
    usability: "en_emotion_only",
    labelFr: "Volume / vitesse en FR",
    detailFr: "Speed et volume à chaque tour. Émotion nommée Cartesia uniquement si Langue = en.",
  },
};

const ACTING_NL: Record<CanonicalEmotion, string> = {
  neutral: "neutral, conversational",
  tense: "tense, guarded, slightly suspicious",
  angry: "angry, sharp, heated",
  sad: "sad, heavy, subdued",
  scared: "frightened, anxious, uneasy",
  fragile: "fragile, hesitant, contained emotion",
  warm: "warm, open, gently concerned",
  accusatory: "accusatory, direct, confronting",
  sarcastic: "dry, sarcastic, ironic",
  urgent: "urgent, rushed, insistent",
};

const DELIVERY_NL: Record<PerformanceDelivery, string> = {
  measured: "measured, deliberate",
  whisper: "whispering, hushed",
  rushed: "rushed",
  cutting: "clipped, cutting",
};

const ELEVENLABS_AUDIO_TAGS: Record<CanonicalEmotion, string> = {
  neutral: "",
  tense: "[tense]",
  angry: "[angry]",
  sad: "[sad]",
  scared: "[worried]",
  fragile: "[hesitant]",
  warm: "[warmly]",
  accusatory: "[stern]",
  sarcastic: "[sarcastic]",
  urgent: "[urgent]",
};

const CARTESIA_EMOTION: Record<CanonicalEmotion, string> = {
  neutral: "neutral",
  tense: "anxious",
  angry: "angry",
  sad: "sad",
  scared: "scared",
  fragile: "hesitant",
  warm: "content",
  accusatory: "frustrated",
  sarcastic: "sarcastic",
  urgent: "panicked",
};

const LEXICON: Record<Exclude<CanonicalEmotion, "neutral">, string[]> = {
  angry: [
    "en colere", "colere", "furieux", "fous", "foutre", "merde", "putain",
    "comment oses", "tais-toi", "degage", "insupportable", "scandale",
    "j'en ai marre", "ca suffit",
  ],
  sad: [
    "triste", "tristesse", "perdu", "perdue", "disparu", "disparue",
    "plus jamais", "je m'en veux", "desole", "desolee", "larmes", "pleurer",
    "pleure", "deuil", "chagrin",
  ],
  scared: [
    "peur", "effraye", "effrayee", "terrifie", "terrifiee", "j'ai peur",
    "inquiet", "inquiete", "angoisse", "danger", "panique",
  ],
  tense: [
    "tendu", "tendue", "mefiant", "mefiante", "qui es-tu", "je ne te connais",
    "qu'est-ce que tu", "pas le temps", "je ne sais pas qui tu es",
  ],
  fragile: [
    "peut-etre", "je ne sais pas trop", "j'essaie", "c'est difficile",
    "je n'arrive pas",
  ],
  warm: [
    "merci", "je t'ecoute", "vas-y", "d'accord", "prends ton temps",
    "je suis la",
  ],
  accusatory: [
    "tu mens", "tu caches", "c'est toi", "avoue", "pourquoi tu",
    "tu me caches", "tu savais",
  ],
  sarcastic: [
    "bien sur", "evidemment", "genial", "formidable", "c'est ca",
  ],
  urgent: [
    "maintenant", "vite", "tout de suite", "il faut me le dire",
    "on n'a plus le temps",
  ],
};

const GM_MEMORY_MAP: Array<{ pattern: RegExp; emotion: CanonicalEmotion }> = [
  { pattern: /col[eè]re|furieux|enerv/i, emotion: "angry" },
  { pattern: /triste|chagrin|deuil|abattu/i, emotion: "sad" },
  { pattern: /peur|effray|angoiss|terrif/i, emotion: "scared" },
  { pattern: /fragile|h[eé]sit|vuln[eé]r/i, emotion: "fragile" },
  { pattern: /chaleur|ouvert|apais|calme|pos[eé]/i, emotion: "warm" },
  { pattern: /accus|confront|dur/i, emotion: "accusatory" },
  { pattern: /sarcas|iron/i, emotion: "sarcastic" },
  { pattern: /urgent|press[eé]/i, emotion: "urgent" },
  { pattern: /tendu|m[eé]fiant|sur la d[eé]fensive|guarded/i, emotion: "tense" },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function buildActingNl(
  emotion: CanonicalEmotion,
  intensity: PerformanceIntensity,
  delivery?: PerformanceDelivery,
): string {
  const intensityPrefix = intensity === 0 ? "slightly " : intensity === 2 ? "very " : "";
  const base = ACTING_NL[emotion];
  const withIntensity = intensityPrefix && emotion !== "neutral"
    ? `${intensityPrefix}${base}`
    : base;
  const parts = [withIntensity, delivery ? DELIVERY_NL[delivery] : ""].filter(Boolean);
  return parts.join(", ").slice(0, 100);
}

export function intentFromManualEmotion(
  emotion: CanonicalEmotion,
  intensity: PerformanceIntensity = 1,
): PerformanceIntent {
  const delivery = defaultDelivery(emotion);
  return {
    emotion,
    intensity,
    delivery,
    actingNl: buildActingNl(emotion, intensity, delivery),
    speedHint: speedFor(emotion, intensity, delivery),
    source: "manual",
  };
}

function defaultDelivery(emotion: CanonicalEmotion): PerformanceDelivery | undefined {
  if (emotion === "fragile" || emotion === "sad") return "measured";
  if (emotion === "urgent" || emotion === "scared") return "rushed";
  if (emotion === "angry" || emotion === "accusatory" || emotion === "tense") return "cutting";
  return undefined;
}

function speedFor(
  emotion: CanonicalEmotion,
  intensity: PerformanceIntensity,
  delivery?: PerformanceDelivery,
): number {
  let speed = 1;
  if (emotion === "sad" || emotion === "fragile") speed = 0.9;
  if (emotion === "angry" || emotion === "urgent") speed = 1.08;
  if (emotion === "scared") speed = 1.05;
  if (delivery === "rushed") speed += 0.06;
  if (delivery === "measured" || delivery === "whisper") speed -= 0.08;
  if (intensity === 2) speed += 0.03;
  if (intensity === 0) speed -= 0.03;
  return clamp(Number(speed.toFixed(2)), 0.7, 1.2);
}

function characterBaseline(characterKey?: string | null): { emotion: CanonicalEmotion; delivery?: PerformanceDelivery } {
  const key = characterKey?.trim().toLowerCase();
  if (key === "emma") return { emotion: "warm", delivery: "measured" };
  if (key === "max") return { emotion: "tense", delivery: "cutting" };
  return { emotion: "neutral" };
}

function scoreLexicon(folded: string): { emotion: CanonicalEmotion; score: number } | null {
  let best: { emotion: CanonicalEmotion; score: number } | null = null;
  for (const [emotion, phrases] of Object.entries(LEXICON) as Array<[Exclude<CanonicalEmotion, "neutral">, string[]]>) {
    let score = 0;
    for (const phrase of phrases) {
      if (folded.includes(phrase)) score += phrase.includes(" ") ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { emotion, score };
    }
  }
  return best;
}

function emotionFromGmMemory(value?: string | null): CanonicalEmotion | null {
  if (!value?.trim()) return null;
  for (const entry of GM_MEMORY_MAP) {
    if (entry.pattern.test(value)) return entry.emotion;
  }
  return null;
}

function punctuationSignals(text: string): { intensityBoost: PerformanceIntensity; delivery?: PerformanceDelivery; emotionHint?: CanonicalEmotion } {
  const bangs = (text.match(/!/g) || []).length;
  const ellipsis = /\.\.\.|…/.test(text);
  if (bangs >= 2) return { intensityBoost: 2, delivery: "rushed", emotionHint: "urgent" };
  if (bangs === 1) return { intensityBoost: 1, delivery: "rushed" };
  if (ellipsis) return { intensityBoost: 1, delivery: "measured", emotionHint: "fragile" };
  return { intensityBoost: 0 };
}

export function derivePerformanceIntent(input: DerivePerformanceInput): PerformanceIntent {
  const settings = input.speechSettings ?? getSpeechPerformanceSettings();
  const state = input.validSpeechStates?.find(name => name.toLocaleLowerCase('fr') === input.speechState?.toLocaleLowerCase('fr'));
  const mapping = state ? settings.byCharacter?.[input.characterKey ?? '']?.[state] : undefined;
  if (settings.enabled && mapping && (input.rugosite ?? 0) > 0) {
    const amount = clamp(input.rugosite ?? 0, 0, 3) / 3;
    const speed = Number(mapping.speed);
    return { emotion: mapping.emotion, intensity: amount < 0.5 ? 0 : amount < 1 ? 1 : 2,
      delivery: mapping.delivery, speedHint: clamp(1 + ((Number.isFinite(speed) ? speed : 1) - 1) * amount, 0.7, 1.2),
      actingNl: `${mapping.instruction}; ${mapping.pauses} pauses, clear diction`.slice(0, 100),
      pauses: mapping.pauses, speechState: state, mappingVersion: settings.version, source: 'speech_state' };
  }
  const text = input.text?.trim() || "";
  const folded = foldText(text);
  const lex = scoreLexicon(folded);
  const punct = punctuationSignals(text);
  const gmEmotion = emotionFromGmMemory(input.previousEmotionalState);
  const baseline = characterBaseline(input.characterKey);

  let emotion: CanonicalEmotion = baseline.emotion;
  let source: PerformanceSource = "lexicon";
  let intensity: PerformanceIntensity = 1;
  let delivery = baseline.delivery;

  if (lex && lex.score >= 2) {
    emotion = lex.emotion;
    intensity = lex.score >= 4 ? 2 : 1;
    delivery = defaultDelivery(emotion) ?? delivery;
  } else if (lex && lex.score === 1 && !gmEmotion) {
    emotion = lex.emotion;
    intensity = 1;
    delivery = defaultDelivery(emotion) ?? delivery;
  } else if (gmEmotion) {
    emotion = gmEmotion;
    source = "gm_memory";
    intensity = 1;
    delivery = defaultDelivery(emotion) ?? delivery;
  } else if (punct.emotionHint && !lex) {
    emotion = punct.emotionHint;
    delivery = punct.delivery ?? delivery;
  }

  if (punct.intensityBoost > intensity) intensity = punct.intensityBoost;
  if (punct.delivery && (emotion === "fragile" || emotion === "urgent" || emotion === "sad")) {
    delivery = punct.delivery;
  }

  const userFolded = foldText(input.userMessage || "");
  const userHostile = scoreLexicon(userFolded);
  if (userHostile && (userHostile.emotion === "angry" || userHostile.emotion === "accusatory") && emotion === "tense") {
    intensity = intensity < 2 ? ((intensity + 1) as PerformanceIntensity) : 2;
  }

  return {
    emotion,
    intensity,
    delivery,
    actingNl: buildActingNl(emotion, intensity, delivery),
    speedHint: speedFor(emotion, intensity, delivery),
    source,
  };
}

/** Fish Audio emotion markers (S1 vocabulary) for each canonical emotion. */
export const FISH_EMOTION_TAGS: Record<CanonicalEmotion, string> = {
  neutral: "",
  tense: "(nervous)",
  angry: "(angry)",
  sad: "(sad)",
  scared: "(scared)",
  fragile: "(hesitating)",
  warm: "(empathetic)",
  accusatory: "(disdainful)",
  sarcastic: "(sarcastic)",
  urgent: "(in a hurry tone)",
};

const FISH_DELIVERY_TAGS: Partial<Record<PerformanceDelivery, string>> = {
  whisper: "(whispering)",
  rushed: "(in a hurry tone)",
};

export interface FishVoiceShaping { text: string; speed: number; tag: string }

/**
 * Adapter-side Fish emotion injection: the tag comes from the turn state only.
 * Any parenthesised marker already present at the start of the LLM text is
 * stripped first so the model can never pick the voice emotion itself.
 */
export function applyFishPerformance(
  base: { speed: number; emotionTags: boolean; defaultEmotion: string },
  text: string,
  intent?: PerformanceIntent | null,
): FishVoiceShaping {
  const clean = text.replace(/^\s*(\([^)]{1,40}\)\s*)+/, "");
  // Fish is already slow and "pasty" when slowed further: workshop intents never go below the base speed.
  const hint = intent?.source === 'speech_state' ? (intent.speedHint ?? 1) : Math.max(1, intent?.speedHint ?? 1);
  const speed = Math.min(2, Math.max(0.5, base.speed * hint));
  if (!base.emotionTags) return { text: clean, speed, tag: "" };
  const emotionTag = intent && intent.intensity > 0 ? FISH_EMOTION_TAGS[intent.emotion] : "";
  const deliveryTag = intent?.delivery ? FISH_DELIVERY_TAGS[intent.delivery] ?? "" : "";
  const tag = [emotionTag || base.defaultEmotion.trim(), deliveryTag].filter((t, i, all) => t && all.indexOf(t) === i).join(" ");
  return { text: tag ? `${tag} ${clean}` : clean, speed, tag };
}

/** Only an authorized state mapping may enable the experimental WS pauses. */
export function resolveGradiumPauseSeconds(intent: PerformanceIntent | null | undefined, characterKey?: string,
  settings = getSpeechPerformanceSettings()): GradiumPauseSeconds | undefined {
  if (getActiveEnvironment() === 'prod' || !settings.enabled || settings.gradiumPausesEnabled !== true
    || intent?.source !== 'speech_state' || !intent.mappingVersion || intent.mappingVersion !== settings.version
    || !intent.speechState || !characterKey) return undefined;
  const mapping = settings.byCharacter?.[characterKey]?.[intent.speechState];
  if (!mapping || mapping.pauses !== intent.pauses) return undefined;
  return { short: 0.25, normal: 0.6, long: 1 }[mapping.pauses] as GradiumPauseSeconds | undefined;
}

export interface ElevenLabsVoiceShaping {
  style: number;
  stability: number;
  speed: number;
  text: string;
}

export function applyElevenLabsPerformance(
  base: { style: number; stability: number; speed: number; modelId: string },
  text: string,
  intent?: PerformanceIntent | null,
): ElevenLabsVoiceShaping {
  if (!intent) {
    return { style: base.style, stability: base.stability, speed: base.speed, text };
  }
  const factor = (intent.intensity + 1) / 2;
  const deltas: Record<CanonicalEmotion, { style: number; stability: number; speed: number }> = {
    neutral: { style: 0, stability: 0, speed: 0 },
    tense: { style: 0.08, stability: -0.04, speed: 0.02 },
    angry: { style: 0.18, stability: -0.12, speed: 0.08 },
    sad: { style: 0.06, stability: 0.04, speed: -0.08 },
    scared: { style: 0.12, stability: -0.08, speed: 0.05 },
    fragile: { style: 0.04, stability: 0.02, speed: -0.1 },
    warm: { style: 0.05, stability: 0, speed: -0.02 },
    accusatory: { style: 0.14, stability: -0.08, speed: 0.04 },
    sarcastic: { style: 0.1, stability: -0.06, speed: 0 },
    urgent: { style: 0.16, stability: -0.1, speed: 0.12 },
  };
  const delta = deltas[intent.emotion];
  const speed = intent.source === 'speech_state' ? clamp(base.speed * (intent.speedHint ?? 1), 0.7, 1.2) : intent.speedHint ?? clamp(base.speed + delta.speed * factor, 0.7, 1.2);
  let spoken = text;
  if (supportsElevenLabsAudioTags(base.modelId)) {
    const tag = ELEVENLABS_AUDIO_TAGS[intent.emotion];
    const deliveryTag = intent.delivery === "whisper" ? "[whispers]" : "";
    const prefix = [tag, deliveryTag].filter(Boolean).join("");
    if (prefix && !spoken.startsWith("[")) spoken = `${prefix} ${spoken}`;
  }
  return {
    style: clamp(base.style + delta.style * factor, 0, 1),
    stability: clamp(base.stability + delta.stability * factor, 0, 1),
    speed,
    text: spoken,
  };
}

export interface GradiumPerformanceTuning {
  temp: number;
  paddingBonus: number;
}

export function applyGradiumPerformance(
  base: { temp: number; paddingBonus: number },
  intent?: PerformanceIntent | null,
): GradiumPerformanceTuning {
  if (!intent) return { temp: base.temp, paddingBonus: base.paddingBonus };
  if (intent.source === 'speech_state') {
    const amount = (intent.intensity + 1) / 3;
    const shift = intent.pauses === 'long' ? 0.5 : intent.pauses === 'short' ? -0.6 : 0;
    return { temp: base.temp, paddingBonus: clamp(base.paddingBonus + shift * amount, -4, 4) };
  }
  // Kept small: high Gradium temperatures produce hiccups, breaths and odd
  // pronunciations. Bump ≤ 0.1 and hard ceiling at 0.85.
  const tempBump = Math.min(0.1, 0.04 * intent.intensity
    + (intent.emotion === "angry" || intent.emotion === "urgent" || intent.emotion === "scared" ? 0.03 : 0));
  let padding = base.paddingBonus;
  if (intent.delivery === "rushed" || intent.emotion === "urgent") padding -= 0.6;
  if (intent.delivery === "measured" || intent.delivery === "whisper" || intent.emotion === "sad" || intent.emotion === "fragile") {
    padding += 0.5;
  }
  return {
    temp: clamp(base.temp + tempBump, 0, 0.85),
    paddingBonus: clamp(padding, -4, 4),
  };
}

export interface InworldPerformancePatch {
  instruction?: string;
  deliveryMode?: "STABLE" | "BALANCED" | "CREATIVE";
  speakingRate?: number;
}

export function applyInworldPerformance(
  base: { deliveryMode: "STABLE" | "BALANCED" | "CREATIVE"; speakingRate: number },
  intent?: PerformanceIntent | null,
): InworldPerformancePatch {
  if (!intent) return {};
  return {
    instruction: intent.actingNl,
    deliveryMode: intent.intensity >= 2 ? "CREATIVE" : base.deliveryMode,
    // Inworld already runs ~2x longer than the others (41 s vs 22 s): never slow it down outside the game mapping.
    speakingRate: intent.source === 'speech_state' ? clamp(base.speakingRate * (intent.speedHint ?? 1), 0.5, 2) : intent.speedHint
      ? clamp(Math.max(intent.speedHint, 1), 0.5, 2)
      : base.speakingRate,
  };
}

export interface CartesiaGenerationConfig {
  speed: number;
  volume: number;
  emotion?: string;
}

export function applyCartesiaGenerationConfig(
  intent: PerformanceIntent | null | undefined,
  language: string,
): CartesiaGenerationConfig {
  const speed = clamp(intent?.speedHint ?? 1, 0.6, 1.5);
  let volume = 1;
  if (intent?.emotion === "angry" || intent?.emotion === "urgent") volume = 1.15;
  if (intent?.emotion === "sad" || intent?.delivery === "whisper") volume = 0.85;
  const config: CartesiaGenerationConfig = {
    speed,
    volume: clamp(volume, 0.5, 2),
  };
  const lang = language.trim().toLowerCase();
  if (intent && (lang === "en" || lang.startsWith("en-"))) {
    config.emotion = CARTESIA_EMOTION[intent.emotion];
  }
  return config;
}

export function logPerformanceIntent(intent: PerformanceIntent, extra?: Record<string, unknown>): void {
  console.log(
    `[TTS-performance] emotion=${intent.emotion} intensity=${intent.intensity} source=${intent.source} acting="${intent.actingNl}"`,
    extra ?? "",
  );
}

/** Sampling temperature raised with intensity for workshop intents so the delivery actually varies (Fish, Inworld). */
export function expressiveTemperature(base: number, intent?: PerformanceIntent | null): number {
  if (!intent || intent.source === 'speech_state') return base;
  return clamp(base + 0.12 * intent.intensity, 0, 1);
}
