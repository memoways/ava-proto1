import defaultSettings from "@/config/settings.json";
import { supabase } from "@/integrations/supabase/client";

// ===== DB Persistence Layer =====

/**
 * Load a settings object from the admin_settings table.
 * Falls back to localStorage then defaults.
 */
async function loadFromDB<T>(key: string, defaults: T): Promise<T> {
  try {
    const { data, error } = await supabase
      .from("admin_settings" as any)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!error && data) {
      const dbValue = (data as any).value as T;
      // Also sync to localStorage for fast reads
      localStorage.setItem(key, JSON.stringify(dbValue));
      return { ...defaults, ...dbValue };
    }
  } catch (err) {
    console.warn(`[Settings] DB load failed for ${key}:`, err);
  }
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...defaults };
}

/**
 * Save a settings object to both localStorage (immediate) and DB (persistent).
 */
async function saveToDB<T>(key: string, value: T): Promise<void> {
  // Immediate localStorage write
  localStorage.setItem(key, JSON.stringify(value));
  // Persistent DB write
  try {
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert({ key, value, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    if (error) {
      console.error(`[Settings] DB save failed for ${key}:`, error.message);
    } else {
      console.log(`[Settings] Saved ${key} to DB`);
    }
  } catch (err) {
    console.error(`[Settings] DB save exception for ${key}:`, err);
  }
}

// ===== LLM Settings =====

export interface LLMSettings {
  LLM_MODEL: string;
  LLM_MODEL_GM: string;
  LLM_TEMPERATURE: number;
  LLM_MAX_TOKENS: number;
  LLM_TOP_P: number;
  LLM_TEMPERATURE_GM: number;
  LLM_MAX_TOKENS_GM: number;
}

const LLM_STORAGE_KEY = "ava_llm_settings";

export const OPENROUTER_MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Défaut live — rapide, fiable, bonne qualité" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", description: "Très rapide, économique" },
  { id: "x-ai/grok-3-mini-beta", label: "Grok 3 Mini", description: "Rapide, conversationnel, bon en roleplay" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", description: "Qualité correcte mais trop lent pour le live voice-to-voice" },
  { id: "x-ai/grok-3-beta", label: "Grok 3", description: "Top qualité xAI, raisonnement fort" },
  { id: "x-ai/grok-2-1212", label: "Grok 2", description: "Équilibré vitesse/qualité" },
  { id: "google/gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro", description: "Top qualité, plus lent" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Excellent en roleplay" },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "Polyvalent, rapide" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", description: "Open source, performant" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B", description: "Ultra rapide, léger" },
  { id: "mistralai/mistral-large", label: "Mistral Large", description: "Bon en français" },
];

const llmDefaults: LLMSettings = {
  LLM_MODEL: defaultSettings.LLM_MODEL,
  // Le GM ne fait QUE du JSON structuré déterministe (brief de tour, évaluation post-turn).
  // Un modèle "flash/lite" est ~5-10x plus rapide qu'un 72B pour la même qualité sur cette tâche
  // → réduit drastiquement la latence du GM pre-turn (vue dans le panneau Latence & blocage).
  LLM_MODEL_GM: "google/gemini-2.5-flash",
  LLM_TEMPERATURE: defaultSettings.LLM_TEMPERATURE,
  LLM_MAX_TOKENS: Math.min(defaultSettings.LLM_MAX_TOKENS, 220),
  LLM_TOP_P: defaultSettings.LLM_TOP_P,
  LLM_TEMPERATURE_GM: 0.3,
  // Le brief JSON fait ~150 tokens utiles ; 180 = marge confortable, plus de gaspillage de génération.
  LLM_MAX_TOKENS_GM: 180,
};

const DEPRECATED_OPENROUTER_MODELS: Record<string, string> = {
  "google/gemini-2.0-flash-001": "google/gemini-2.5-flash",
  "qwen/qwen-2.5-32b-instruct": "qwen/qwen-2.5-72b-instruct",
};

const SLOW_LIVE_MODEL_FALLBACKS: Record<string, string> = {
  "qwen/qwen-2.5-72b-instruct": "google/gemini-2.5-flash",
  "meta-llama/llama-3.1-70b-instruct": "google/gemini-2.5-flash",
  "google/gemini-2.5-pro-preview-06-05": "google/gemini-2.5-flash",
};

export type LLMModelField = "LLM_MODEL" | "LLM_MODEL_GM";

export interface LLMValidationIssue {
  field: LLMModelField;
  rejectedModel: string;
  fallbackModel: string;
  reason: "deprecated" | "unsupported";
}

const SUPPORTED_OPENROUTER_MODEL_IDS = new Set(OPENROUTER_MODELS.map((model) => model.id));
const FALLBACK_OPENROUTER_MODEL = OPENROUTER_MODELS[0].id;
let lastLLMValidationIssues: LLMValidationIssue[] = [];

function validateOpenRouterModel(field: LLMModelField, modelId: string): { modelId: string; issue?: LLMValidationIssue } {
  const deprecatedFallback = DEPRECATED_OPENROUTER_MODELS[modelId];
  if (deprecatedFallback) {
    return {
      modelId: deprecatedFallback,
      issue: { field, rejectedModel: modelId, fallbackModel: deprecatedFallback, reason: "deprecated" },
    };
  }

  if (!SUPPORTED_OPENROUTER_MODEL_IDS.has(modelId)) {
    return {
      modelId: FALLBACK_OPENROUTER_MODEL,
      issue: { field, rejectedModel: modelId || "(vide)", fallbackModel: FALLBACK_OPENROUTER_MODEL, reason: "unsupported" },
    };
  }

  return { modelId };
}

export function getLastLLMValidationIssues(): LLMValidationIssue[] {
  return lastLLMValidationIssues;
}

export function isSupportedOpenRouterModel(modelId: string): boolean {
  return SUPPORTED_OPENROUTER_MODEL_IDS.has(modelId);
}

export function getLLMValidationErrorMessage(issues: LLMValidationIssue[]): string {
  if (!issues.length) return "";
  const rejectedModels = issues.map((issue) => issue.rejectedModel).join(", ");
  return `Modèle OpenRouter non supporté refusé : ${rejectedModels}. Retour automatique sur ${FALLBACK_OPENROUTER_MODEL}.`;
}

function normalizeLLMSettings(settings: LLMSettings): LLMSettings {
  const maxModel = validateOpenRouterModel("LLM_MODEL", settings.LLM_MODEL);
  const gmModel = validateOpenRouterModel("LLM_MODEL_GM", settings.LLM_MODEL_GM);
  lastLLMValidationIssues = [maxModel.issue, gmModel.issue].filter(Boolean) as LLMValidationIssue[];
  const realtimeModel = SLOW_LIVE_MODEL_FALLBACKS[maxModel.modelId] || maxModel.modelId;

  return {
    ...settings,
    LLM_MODEL: realtimeModel,
    LLM_MODEL_GM: gmModel.modelId,
    LLM_MAX_TOKENS: Math.min(settings.LLM_MAX_TOKENS || llmDefaults.LLM_MAX_TOKENS, 220),
    LLM_TOP_P: Math.min(settings.LLM_TOP_P || llmDefaults.LLM_TOP_P, 0.9),
  };
}

/** Synchronous read from localStorage (fast, for use during LLM calls) */
export function getLLMSettings(): LLMSettings {
  try {
    const stored = localStorage.getItem(LLM_STORAGE_KEY);
    if (stored) {
      const merged = { ...llmDefaults, ...JSON.parse(stored) };
      const normalized = normalizeLLMSettings(merged);
      if (JSON.stringify(merged) !== JSON.stringify(normalized)) {
        localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    }
  } catch { /* ignore */ }
  return { ...llmDefaults };
}

/** Async load from DB (call on admin page load) */
export async function loadLLMSettingsFromDB(): Promise<LLMSettings> {
  const loaded = await loadFromDB(LLM_STORAGE_KEY, llmDefaults);
  const normalized = normalizeLLMSettings(loaded);
  if (JSON.stringify(loaded) !== JSON.stringify(normalized)) {
    await saveToDB(LLM_STORAGE_KEY, normalized);
  }
  return normalized;
}

/** Save to both localStorage and DB */
export async function saveLLMSettingsToDB(settings: LLMSettings): Promise<void> {
  await saveToDB(LLM_STORAGE_KEY, normalizeLLMSettings(settings));
}

/** Local-only save (for slider dragging without DB write on every move) */
export function saveLLMSettingsLocal(settings: Partial<LLMSettings>): LLMSettings {
  const current = getLLMSettings();
  const updated = normalizeLLMSettings({ ...current, ...settings });
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetLLMSettings(): LLMSettings {
  localStorage.removeItem(LLM_STORAGE_KEY);
  // Also clear from DB
  supabase.from("admin_settings" as any).delete().eq("key", LLM_STORAGE_KEY).then(() => {});
  return { ...llmDefaults };
}

// Keep old name for backward compatibility
export function saveLLMSettings(settings: Partial<LLMSettings>): LLMSettings {
  return saveLLMSettingsLocal(settings);
}

// ===== TTS / Voice Settings =====

export interface TTSSettings {
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
  outputFormat: string;
  optimizeStreamingLatency: number;
  languageCode: string;
  applyTextNormalization: "auto" | "on" | "off";
  seed: number;
}

const TTS_STORAGE_KEY = "ava_tts_settings";

export const ELEVENLABS_MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2", description: "Meilleure diction et continuité — recommandé pour Max" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5", description: "Basse latence, bonne qualité — recommandé pour le temps réel" },
  { id: "eleven_v3", label: "Eleven v3", description: "Très expressif — à tester selon disponibilité du compte" },
  { id: "eleven_turbo_v2", label: "Turbo v2", description: "Rapide, qualité correcte" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5", description: "Ultra rapide, latence minimale" },
];

const ttsDefaults: TTSSettings = {
  modelId: "eleven_multilingual_v2",
  stability: 0.50,
  similarityBoost: 0.82,
  style: 0.18,
  useSpeakerBoost: true,
  speed: 1.0,
  outputFormat: "mp3_44100_128",
  optimizeStreamingLatency: 0,
  languageCode: "fr",
  applyTextNormalization: "on",
  seed: 19051976,
};

export const TTS_PRESETS: Record<string, { label: string; description: string; settings: Partial<TTSSettings> }> = {
  max_diction: {
    label: "Max diction FR",
    description: "Priorité prononciation, continuité et cohérence",
    settings: {
      modelId: "eleven_multilingual_v2",
      stability: 0.58,
      similarityBoost: 0.82,
      style: 0.14,
      speed: 0.94,
      useSpeakerBoost: true,
      optimizeStreamingLatency: 0,
      languageCode: "fr",
      applyTextNormalization: "on",
      seed: 19051976,
    },
  },
  natural_conversation: {
    label: "Conversation naturelle",
    description: "Ton posé et naturel, idéal pour Max",
    settings: { stability: 0.50, similarityBoost: 0.78, style: 0.18, speed: 0.95, optimizeStreamingLatency: 0, applyTextNormalization: "on" },
  },
  expressive: {
    label: "Expressif",
    description: "Plus d'émotion et de variation",
    settings: { stability: 0.38, similarityBoost: 0.80, style: 0.38, speed: 1.0, optimizeStreamingLatency: 0, applyTextNormalization: "on" },
  },
  calm_measured: {
    label: "Calme et mesuré",
    description: "Stable, grave, peu de variation — père inquiet",
    settings: { stability: 0.66, similarityBoost: 0.84, style: 0.12, speed: 0.90, optimizeStreamingLatency: 0, applyTextNormalization: "on" },
  },
  clear_articulate: {
    label: "Clair et articulé",
    description: "Diction nette, speaker boost — meilleure compréhension",
    settings: { stability: 0.60, similarityBoost: 0.86, style: 0.08, speed: 0.90, useSpeakerBoost: true, optimizeStreamingLatency: 0, applyTextNormalization: "on" },
  },
  fast_urgent: {
    label: "Rapide et urgent",
    description: "Sous stress, phrases pressées",
    settings: { modelId: "eleven_turbo_v2_5", stability: 0.38, similarityBoost: 0.76, style: 0.32, speed: 1.06, optimizeStreamingLatency: 1, applyTextNormalization: "on" },
  },
  realtime_conversation: {
    label: "Conversation temps réel",
    description: "Priorité à la latence faible pour tests voice-to-voice",
    settings: { modelId: "eleven_turbo_v2_5", stability: 0.46, similarityBoost: 0.78, style: 0.16, speed: 1.02, outputFormat: "mp3_44100_64", optimizeStreamingLatency: 1, applyTextNormalization: "on" },
  },
};

/** Synchronous read from localStorage */
export function getTTSSettings(): TTSSettings {
  try {
    const stored = localStorage.getItem(TTS_STORAGE_KEY);
    if (stored) return { ...ttsDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...ttsDefaults };
}

/** Async load from DB */
export async function loadTTSSettingsFromDB(): Promise<TTSSettings> {
  return loadFromDB(TTS_STORAGE_KEY, ttsDefaults);
}

/** Save to both localStorage and DB */
export async function saveTTSSettingsToDB(settings: TTSSettings): Promise<void> {
  await saveToDB(TTS_STORAGE_KEY, settings);
}

/** Local-only save */
export function saveTTSSettingsLocal(settings: Partial<TTSSettings>): TTSSettings {
  const current = getTTSSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetTTSSettings(): TTSSettings {
  localStorage.removeItem(TTS_STORAGE_KEY);
  supabase.from("admin_settings" as any).delete().eq("key", TTS_STORAGE_KEY).then(() => {});
  return { ...ttsDefaults };
}

// Keep old name for backward compatibility
export function saveTTSSettings(settings: Partial<TTSSettings>): TTSSettings {
  return saveTTSSettingsLocal(settings);
}

// ===== Gameplay / Experience Settings =====

export interface GameplaySettings {
  TRUST_THRESHOLD: number;
  TIMEOUT_SECONDS: number;
  MAX_INSULT_TOLERANCE: number;
  MIN_QUESTIONS_BEFORE_GATE: number;
  RAG_TOP_K: number;
  RAG_RETRIEVE_K: number;
  RAG_RERANK_ENABLED: boolean;
  RAG_QUERY_REWRITE_ENABLED: boolean;
  RAG_EMBEDDING_PROVIDER: "voyage" | "openai";
  RAG_SUMMARY_EVERY_N_TURNS: number;
  VIDEO_PLACEHOLDER_DURATION: number;
}

const GAMEPLAY_STORAGE_KEY = "ava_gameplay_settings";

const gameplayDefaults: GameplaySettings = {
  TRUST_THRESHOLD: defaultSettings.TRUST_THRESHOLD,
  TIMEOUT_SECONDS: defaultSettings.TIMEOUT_SECONDS,
  MAX_INSULT_TOLERANCE: defaultSettings.MAX_INSULT_TOLERANCE,
  MIN_QUESTIONS_BEFORE_GATE: defaultSettings.MIN_QUESTIONS_BEFORE_GATE,
  RAG_TOP_K: defaultSettings.RAG_TOP_K,
  RAG_RETRIEVE_K: (defaultSettings as any).RAG_RETRIEVE_K ?? 15,
  RAG_RERANK_ENABLED: (defaultSettings as any).RAG_RERANK_ENABLED ?? true,
  RAG_QUERY_REWRITE_ENABLED: (defaultSettings as any).RAG_QUERY_REWRITE_ENABLED ?? true,
  RAG_EMBEDDING_PROVIDER: ((defaultSettings as any).RAG_EMBEDDING_PROVIDER as "voyage" | "openai") ?? "voyage",
  RAG_SUMMARY_EVERY_N_TURNS: (defaultSettings as any).RAG_SUMMARY_EVERY_N_TURNS ?? 4,
  VIDEO_PLACEHOLDER_DURATION: defaultSettings.VIDEO_PLACEHOLDER_DURATION,
};

export function getGameplaySettings(): GameplaySettings {
  try {
    const stored = localStorage.getItem(GAMEPLAY_STORAGE_KEY);
    if (stored) return { ...gameplayDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...gameplayDefaults };
}

export async function loadGameplaySettingsFromDB(): Promise<GameplaySettings> {
  return loadFromDB(GAMEPLAY_STORAGE_KEY, gameplayDefaults);
}

export async function saveGameplaySettingsToDB(settings: GameplaySettings): Promise<void> {
  await saveToDB(GAMEPLAY_STORAGE_KEY, settings);
}

export function saveGameplaySettings(settings: Partial<GameplaySettings>): GameplaySettings {
  const current = getGameplaySettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(GAMEPLAY_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetGameplaySettings(): GameplaySettings {
  localStorage.removeItem(GAMEPLAY_STORAGE_KEY);
  supabase.from("admin_settings" as any).delete().eq("key", GAMEPLAY_STORAGE_KEY).then(() => {});
  return { ...gameplayDefaults };
}

// ===== Game Master Prompt Settings =====

export interface GameMasterPromptSettings {
  systemPrompt: string;
  preTurnPlannerPrompt: string;
  triggers: Record<string, { themes: string[]; description: string }>;
}

const GM_PROMPT_STORAGE_KEY = "ava_gm_prompt_settings";

const DEFAULT_GM_SYSTEM_PROMPT = `Tu es le Game Master d'une expérience narrative interactive "Où est Ava ?". Tu analyses chaque échange entre l'utilisateur et Max pour orchestrer l'expérience.

## TON RÔLE
- Évaluer la sincérité et l'engagement de l'utilisateur
- Détecter si un trigger vidéo doit être activé
- Gérer le niveau de confiance et la progression
- Détecter les comportements inappropriés

## RÈGLES
- trust_delta: +1 si réponse sincère/engagée, 0 si neutre, -1 si évasive/désintéressée
- Trigger vidéo si la conversation touche un thème clé (famille, enfance, secret, disparition)
- game_over si comportement inapproprié (insultes, hors-sujet répété) ou si l'utilisateur abandonne
- gate_reached si trust_level >= TRUST_THRESHOLD

## TRIGGERS DISPONIBLES
- "trigger_famille" : thèmes famille, parents, enfance
- "trigger_secret" : thèmes secret, mystère, vérité cachée
- "trigger_disparition" : thèmes disparition, absence, recherche

## FORMAT DE RÉPONSE
Tu dois TOUJOURS répondre avec un JSON valide et RIEN D'AUTRE :
{
  "trust_delta": 0,
  "trigger_video_id": null,
  "game_over": false,
  "game_over_reason": null,
  "gate_reached": false,
  "moderation_flag": false,
  "notes": "Brève analyse de l'échange"
}`;

const DEFAULT_GM_PRETURN_PROMPT = `Tu es le Game Master d'une expérience narrative interactive "Où est Ava ?".

Tu interviens AVANT la réponse de Max pour produire un brief de tour strict.

## OBJECTIF
- Définir comment Max doit répondre à CE tour
- Limiter ce qu'il peut révéler
- Préciser ce qu'il doit éviter d'affirmer
- Donner un cadrage éditorial exécutable

## RÈGLES
- Base-toi uniquement sur l'historique récent, le message utilisateur, l'état de confiance, le temps écoulé et le contexte autorisé fourni.
- N'invente aucun fait hors contexte autorisé.
- Si le contexte manque, réduis l'ouverture et augmente la prudence.
- reveal_budget doit rester faible: 0 à 2 maximum.
- openness_level doit être compris entre 0 et 5.

## FORMAT DE RÉPONSE
Retourne UNIQUEMENT un JSON valide:
{
  "response_mode": "méfiant",
  "openness_level": 1,
  "emotional_state": "tendu",
  "conversation_goal": "tester la sincérité de l'interlocuteur",
  "reveal_budget": 1,
  "allowed_knowledge": ["..."],
  "forbidden_topics": ["..."],
  "blocked_assertions": ["..."],
  "style_instructions": ["répondre brièvement", "poser une question de contrôle"],
  "trigger_hint": null,
  "notes": "Brève justification du cadrage"
}`;

const gmPromptDefaults: GameMasterPromptSettings = {
  systemPrompt: DEFAULT_GM_SYSTEM_PROMPT,
  preTurnPlannerPrompt: DEFAULT_GM_PRETURN_PROMPT,
  triggers: {
    trigger_famille: { themes: ["famille", "parents", "enfance"], description: "Flashback famille" },
    trigger_secret: { themes: ["secret", "mystère", "vérité"], description: "Le message cryptique" },
    trigger_disparition: { themes: ["disparition", "absence", "recherche"], description: "Le jour de la disparition" },
  },
};

export function getGMPromptSettings(): GameMasterPromptSettings {
  try {
    const stored = localStorage.getItem(GM_PROMPT_STORAGE_KEY);
    if (stored) return { ...gmPromptDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...gmPromptDefaults };
}

export async function loadGMPromptSettingsFromDB(): Promise<GameMasterPromptSettings> {
  return loadFromDB(GM_PROMPT_STORAGE_KEY, gmPromptDefaults);
}

export async function saveGMPromptSettingsToDB(settings: GameMasterPromptSettings): Promise<void> {
  await saveToDB(GM_PROMPT_STORAGE_KEY, settings);
}

export function saveGMPromptSettings(settings: Partial<GameMasterPromptSettings>): GameMasterPromptSettings {
  const current = getGMPromptSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(GM_PROMPT_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetGMPromptSettings(): GameMasterPromptSettings {
  localStorage.removeItem(GM_PROMPT_STORAGE_KEY);
  supabase.from("admin_settings" as any).delete().eq("key", GM_PROMPT_STORAGE_KEY).then(() => {});
  return { ...gmPromptDefaults };
}

// ===== Max Prompt Control Settings =====

export interface MaxPromptControlSettings {
  persona: string;
  objectives: string;
  roleContext: string;
  longTermMemory: string;
  responseStyle: string;
  allowedKnowledgePolicy: string;
  forbiddenAssertions: string;
  forbiddenTopics: string;
  uncertaintyPolicy: string;
}

const MAX_PROMPT_CONTROL_STORAGE_KEY = "ava_max_prompt_control_settings";

const maxPromptControlDefaults: MaxPromptControlSettings = {
  persona: `Tu es Max, le père d'Ava. Tu es dans un appel oral tendu, intime et réaliste. Tu parles toujours à la première personne, sans narration ni méta-commentaire.`,
  objectives: `Obtenir des informations fiables sur Ava, tester la sincérité de l'interlocuteur, protéger ce que tu ne veux pas encore révéler, et faire progresser la confiance sans casser la tension.`,
  roleContext: `Tu évolues dans une expérience narrative conversationnelle. Tu n'es pas un assistant: tu es un personnage situé, avec une mémoire partielle, des zones d'ombre, des émotions, et des limites de révélation.`,
  longTermMemory: `Historique stable: Ava a disparu. Tu possèdes des souvenirs, des tensions familiales et des fragments de vérité, mais tout n'est pas accessible ni dicible à chaque tour.`,
  responseStyle: `Réponses brèves, orales, incarnées, 2 à 3 phrases maximum. Tu privilégies la retenue, la précision, et les questions qui testent l'autre.`,
  allowedKnowledgePolicy: `Tu peux t'appuyer uniquement sur: 1) ton identité et ton rôle définis ici, 2) les faits du CONTEXTE AUTORISÉ DU TOUR, 3) l'historique récent fourni, 4) le contexte post-vidéo éventuel. Rien d'autre.`,
  forbiddenAssertions: `N'affirme jamais un fait absent du contexte autorisé. N'invente ni événement, ni relation, ni lieu, ni intention, ni souvenir précis. N'explicite jamais une hypothèse comme une certitude.`,
  forbiddenTopics: `Si un sujet n'est pas débloqué, s'il est absent du contexte autorisé, ou s'il doit rester caché, tu esquives avec naturel, tu exprimes un doute, ou tu refuses de l'affirmer.`,
  uncertaintyPolicy: `Quand l'information manque, tu dis explicitement que tu ne sais pas, que tu n'en es pas sûr, ou que tu ne peux pas l'affirmer. Tu préfères l'incertitude honnête au remplissage.`
};

export function getMaxPromptControlSettings(): MaxPromptControlSettings {
  try {
    const stored = localStorage.getItem(MAX_PROMPT_CONTROL_STORAGE_KEY);
    if (stored) return { ...maxPromptControlDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...maxPromptControlDefaults };
}

export async function loadMaxPromptControlSettingsFromDB(): Promise<MaxPromptControlSettings> {
  return loadFromDB(MAX_PROMPT_CONTROL_STORAGE_KEY, maxPromptControlDefaults);
}

export async function saveMaxPromptControlSettingsToDB(settings: MaxPromptControlSettings): Promise<void> {
  await saveToDB(MAX_PROMPT_CONTROL_STORAGE_KEY, settings);
}

export function saveMaxPromptControlSettings(settings: Partial<MaxPromptControlSettings>): MaxPromptControlSettings {
  const current = getMaxPromptControlSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(MAX_PROMPT_CONTROL_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetMaxPromptControlSettings(): MaxPromptControlSettings {
  localStorage.removeItem(MAX_PROMPT_CONTROL_STORAGE_KEY);
  supabase.from("admin_settings" as any).delete().eq("key", MAX_PROMPT_CONTROL_STORAGE_KEY).then(() => {});
  return { ...maxPromptControlDefaults };
}

// ===== Anti-hallucination Validator Settings =====

export interface AntiHallucinationValidatorSettings {
  authorizedFacts: string;
  blockedAssertionRules: string;
}

const ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY = "ava_anti_hallucination_validator_settings";

const antiHallucinationValidatorDefaults: AntiHallucinationValidatorSettings = {
  authorizedFacts: `Max est le père d'Ava.
Ava a disparu.
Max ne dispose que d'informations partielles.
Max doit s'en tenir strictement au contexte autorisé du tour et aux faits validés ci-dessous.`,
  blockedAssertionRules: `Bloquer toute affirmation factuelle absente des faits autorisés du tour ou de cette base globale.
Bloquer toute transformation d'une hypothèse, possibilité ou soupçon en certitude.
Bloquer toute invention de lieu, date, relation, intention, preuve, diagnostic ou souvenir précis non sourcé.
Bloquer toute formulation qui laisse entendre que Max sait plus que ce que le contexte autorisé permet.`
};

export function getAntiHallucinationValidatorSettings(): AntiHallucinationValidatorSettings {
  try {
    const stored = localStorage.getItem(ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY);
    if (stored) return { ...antiHallucinationValidatorDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...antiHallucinationValidatorDefaults };
}

export async function loadAntiHallucinationValidatorSettingsFromDB(): Promise<AntiHallucinationValidatorSettings> {
  return loadFromDB(ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY, antiHallucinationValidatorDefaults);
}

export async function saveAntiHallucinationValidatorSettingsToDB(settings: AntiHallucinationValidatorSettings): Promise<void> {
  await saveToDB(ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY, settings);
}

export function saveAntiHallucinationValidatorSettings(settings: Partial<AntiHallucinationValidatorSettings>): AntiHallucinationValidatorSettings {
  const current = getAntiHallucinationValidatorSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetAntiHallucinationValidatorSettings(): AntiHallucinationValidatorSettings {
  localStorage.removeItem(ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY);
  supabase.from("admin_settings" as any).delete().eq("key", ANTI_HALLUCINATION_VALIDATOR_STORAGE_KEY).then(() => {});
  return { ...antiHallucinationValidatorDefaults };
}

// ===== Hydrate all settings from DB on app start =====

export async function hydrateAllSettings(): Promise<void> {
  await Promise.all([
    loadLLMSettingsFromDB(),
    loadTTSSettingsFromDB(),
    loadGameplaySettingsFromDB(),
    loadGMPromptSettingsFromDB(),
    loadMaxPromptControlSettingsFromDB(),
    loadAntiHallucinationValidatorSettingsFromDB(),
  ]);
  console.log("[Settings] All settings hydrated from DB");
}
