/**
 * Canonical acting intent for per-turn TTS, plus provider adapters.
 *
 * Derived from the spoken line (no extra LLM). Providers map this to their
 * own knobs: Hume `description`, Inworld `instruction`, ElevenLabs sliders /
 * v3 tags, Gradium temp/padding, Cartesia generation_config.
 */

import type { TTSProviderId } from "./types";

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
export type PerformanceSource = "lexicon" | "gm_memory" | "manual";
export type PerformanceIntensity = 0 | 1 | 2;

export interface PerformanceIntent {
  emotion: CanonicalEmotion;
  intensity: PerformanceIntensity;
  delivery?: PerformanceDelivery;
  /** English, ≤100 chars — Hume / Inworld acting instructions. */
  actingNl: string;
  speedHint?: number;
  source: PerformanceSource;
}

export interface DerivePerformanceInput {
  text: string;
  characterKey?: string | null;
  previousEmotionalState?: string | null;
  userMessage?: string | null;
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
  hume: {
    usability: "audible",
    labelFr: "Oui — audible",
    detailFr: "Description d'acting envoyée à chaque tour. C'est ici que les puces d'intention se font entendre.",
  },
  inworld: {
    usability: "audible",
    labelFr: "Oui — audible",
    detailFr: "Instruction d'acting envoyée à chaque tour (modèle TTS-2).",
  },
  elevenlabs: {
    usability: "weak",
    labelFr: "Faible",
    detailFr: "Sliders style / stabilité / vitesse. Tags [angry] uniquement si le modèle est eleven_v3.",
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

const ELEVENLABS_V3_TAGS: Record<CanonicalEmotion, string> = {
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
  const key = (characterKey || "max").toLowerCase();
  if (key === "emma") return { emotion: "warm", delivery: "measured" };
  return { emotion: "tense", delivery: "cutting" };
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

export function composeHumeDescription(baseline: string, intent?: PerformanceIntent | null): string | undefined {
  const parts = [baseline.trim(), intent?.actingNl?.trim()].filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join("; ").slice(0, 100);
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
  const speed = intent.speedHint ?? clamp(base.speed + delta.speed * factor, 0.7, 1.2);
  let spoken = text;
  if (base.modelId === "eleven_v3") {
    const tag = ELEVENLABS_V3_TAGS[intent.emotion];
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
  const tempBump = 0.08 * intent.intensity
    + (intent.emotion === "angry" || intent.emotion === "urgent" || intent.emotion === "scared" ? 0.1 : 0);
  let padding = base.paddingBonus;
  if (intent.delivery === "rushed" || intent.emotion === "urgent") padding -= 0.6;
  if (intent.delivery === "measured" || intent.delivery === "whisper" || intent.emotion === "sad" || intent.emotion === "fragile") {
    padding += 0.5;
  }
  return {
    temp: clamp(base.temp + tempBump, 0, 1.4),
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
    speakingRate: intent.speedHint
      ? clamp(intent.speedHint, 0.5, 2)
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
