import defaultSettings from "@/config/settings.json";

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
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", description: "Défaut — bon rapport qualité/coût" },
  { id: "qwen/qwen-2.5-32b-instruct", label: "Qwen 2.5 32B", description: "Plus rapide, bonne qualité" },
  { id: "x-ai/grok-3-mini-beta", label: "Grok 3 Mini", description: "Rapide, conversationnel, bon en roleplay" },
  { id: "x-ai/grok-3-beta", label: "Grok 3", description: "Top qualité xAI, raisonnement fort" },
  { id: "x-ai/grok-2-1212", label: "Grok 2", description: "Équilibré vitesse/qualité" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", description: "Très rapide, gratuit" },
  { id: "google/gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro", description: "Top qualité, plus lent" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Excellent en roleplay" },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "Polyvalent, rapide" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", description: "Très rapide, économique" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", description: "Open source, performant" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B", description: "Ultra rapide, léger" },
  { id: "mistralai/mistral-large", label: "Mistral Large", description: "Bon en français" },
];

const llmDefaults: LLMSettings = {
  LLM_MODEL: defaultSettings.LLM_MODEL,
  LLM_MODEL_GM: defaultSettings.LLM_MODEL,
  LLM_TEMPERATURE: defaultSettings.LLM_TEMPERATURE,
  LLM_MAX_TOKENS: defaultSettings.LLM_MAX_TOKENS,
  LLM_TOP_P: defaultSettings.LLM_TOP_P,
  LLM_TEMPERATURE_GM: 0.3,
  LLM_MAX_TOKENS_GM: 200,
};

export function getLLMSettings(): LLMSettings {
  try {
    const stored = localStorage.getItem(LLM_STORAGE_KEY);
    if (stored) return { ...llmDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...llmDefaults };
}

export function saveLLMSettings(settings: Partial<LLMSettings>): LLMSettings {
  const current = getLLMSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetLLMSettings(): LLMSettings {
  localStorage.removeItem(LLM_STORAGE_KEY);
  return { ...llmDefaults };
}

// ===== TTS / Voice Settings =====

export interface TTSSettings {
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

const TTS_STORAGE_KEY = "ava_tts_settings";

export const ELEVENLABS_MODELS = [
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5", description: "Basse latence, bonne qualité — recommandé pour le temps réel" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2", description: "Meilleure qualité, 29 langues — plus lent" },
  { id: "eleven_turbo_v2", label: "Turbo v2", description: "Rapide, qualité correcte" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5", description: "Ultra rapide, latence minimale" },
];

const ttsDefaults: TTSSettings = {
  modelId: "eleven_turbo_v2_5",
  stability: 0.50,
  similarityBoost: 0.75,
  style: 0.30,
  useSpeakerBoost: true,
  speed: 1.0,
};

// Presets for quick tuning
export const TTS_PRESETS: Record<string, { label: string; description: string; settings: Partial<TTSSettings> }> = {
  natural_conversation: {
    label: "Conversation naturelle",
    description: "Ton posé et naturel, idéal pour Max",
    settings: { stability: 0.45, similarityBoost: 0.70, style: 0.20, speed: 0.95 },
  },
  expressive: {
    label: "Expressif",
    description: "Plus d'émotion et de variation",
    settings: { stability: 0.30, similarityBoost: 0.80, style: 0.50, speed: 1.0 },
  },
  calm_measured: {
    label: "Calme et mesuré",
    description: "Stable, grave, peu de variation — père inquiet",
    settings: { stability: 0.65, similarityBoost: 0.80, style: 0.15, speed: 0.90 },
  },
  clear_articulate: {
    label: "Claire et articulé",
    description: "Diction nette, speaker boost — meilleure compréhension",
    settings: { stability: 0.55, similarityBoost: 0.85, style: 0.10, speed: 0.92, useSpeakerBoost: true },
  },
  fast_urgent: {
    label: "Rapide et urgent",
    description: "Sous stress, phrases pressées",
    settings: { stability: 0.35, similarityBoost: 0.75, style: 0.40, speed: 1.10 },
  },
};

export function getTTSSettings(): TTSSettings {
  try {
    const stored = localStorage.getItem(TTS_STORAGE_KEY);
    if (stored) return { ...ttsDefaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...ttsDefaults };
}

export function saveTTSSettings(settings: Partial<TTSSettings>): TTSSettings {
  const current = getTTSSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetTTSSettings(): TTSSettings {
  localStorage.removeItem(TTS_STORAGE_KEY);
  return { ...ttsDefaults };
}
