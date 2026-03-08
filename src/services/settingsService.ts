import defaultSettings from "@/config/settings.json";

export interface LLMSettings {
  LLM_MODEL: string;
  LLM_MODEL_GM: string; // Separate model for Game Master
  LLM_TEMPERATURE: number;
  LLM_MAX_TOKENS: number;
  LLM_TOP_P: number;
  LLM_TEMPERATURE_GM: number;
  LLM_MAX_TOKENS_GM: number;
}

const STORAGE_KEY = "ava_llm_settings";

// Popular OpenRouter models for quick selection
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

const defaults: LLMSettings = {
  LLM_MODEL: defaultSettings.LLM_MODEL,
  LLM_MODEL_GM: defaultSettings.LLM_MODEL, // Same model by default
  LLM_TEMPERATURE: defaultSettings.LLM_TEMPERATURE,
  LLM_MAX_TOKENS: defaultSettings.LLM_MAX_TOKENS,
  LLM_TOP_P: defaultSettings.LLM_TOP_P,
  LLM_TEMPERATURE_GM: 0.3,
  LLM_MAX_TOKENS_GM: 200,
};

/** Get current LLM settings (localStorage with fallback to defaults) */
export function getLLMSettings(): LLMSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { ...defaults };
}

/** Save LLM settings to localStorage */
export function saveLLMSettings(settings: Partial<LLMSettings>): LLMSettings {
  const current = getLLMSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  console.log("[Settings] LLM settings saved:", updated);
  return updated;
}

/** Reset to defaults */
export function resetLLMSettings(): LLMSettings {
  localStorage.removeItem(STORAGE_KEY);
  return { ...defaults };
}
