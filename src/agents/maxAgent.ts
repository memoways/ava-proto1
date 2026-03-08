import { streamLLM } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import type { ConversationMessage } from "@/types";
import { getLLMSettings } from "@/services/settingsService";

// Fallback minimal system prompt if DB fetch fails
const FALLBACK_SYSTEM_PROMPT = `Tu es un personnage dans une expérience narrative interactive. Parle à la première personne, en français, de façon concise (2-3 phrases). Utilise le CONTEXTE NARRATIF ci-dessous comme source de vérité.`;

// Gameplay rules — always appended regardless of character
const GAMEPLAY_RULES = `
## RÈGLES DE JEU
- Parle UNIQUEMENT à la première personne, en français
- JAMAIS de narration ("*il soupire*"), JAMAIS de méta-commentaires
- Tes émotions passent par tes mots, ton rythme, tes hésitations
- Tu poses des questions à l'interlocuteur pour jauger sa sincérité
- Réponds de façon concise (2-3 phrases max) car c'est une conversation orale
- Ne révèle pas tout d'un coup — construis la confiance progressivement

## RÈGLE CRITIQUE — CONTEXTE NARRATIF
Le bloc "CONTEXTE NARRATIF" ci-dessous contient des informations issues de ta mémoire et du monde.
Ces informations sont LA SOURCE DE VÉRITÉ ABSOLUE. Tu DOIS les utiliser pour répondre.
Ne contredis JAMAIS ces informations. Si tu ne sais pas quelque chose, dis-le plutôt que d'inventer.
N'invente AUCUN fait qui ne figure pas dans le contexte narratif.`;

let cachedSystemPrompt: string | null = null;
let systemPromptPromise: Promise<string> | null = null;

async function getCharacterSystemPrompt(name = "Max"): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  try {
    const { data, error } = await supabase
      .from("characters")
      .select("system_prompt, name, personality")
      .eq("name", name)
      .maybeSingle();

    if (error || !data?.system_prompt) {
      console.warn("[MaxAgent] Could not fetch system_prompt from DB, using fallback");
      return FALLBACK_SYSTEM_PROMPT;
    }

    cachedSystemPrompt = data.system_prompt;
    console.log(`[MaxAgent] Loaded system_prompt for ${data.name} (${data.system_prompt.length} chars)`);
    return data.system_prompt;
  } catch (err) {
    console.error("[MaxAgent] DB error:", err);
    return FALLBACK_SYSTEM_PROMPT;
  }
}

/** Preload system prompt into cache (call early, e.g. during intro video) */
export function preloadSystemPrompt(): void {
  if (cachedSystemPrompt || systemPromptPromise) return;
  console.log("[MaxAgent] Preloading system prompt...");
  systemPromptPromise = getCharacterSystemPrompt().then(p => {
    systemPromptPromise = null;
    return p;
  });
}

/** Clear cached prompt (call after editing in admin) */
export function clearSystemPromptCache() {
  cachedSystemPrompt = null;
}

export interface MaxAgentInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  ragContext?: string;
  postVideoContext?: string;
  session_id?: string;
}

/**
 * Calls Max agent with streaming response
 */
export async function callMaxAgent(
  input: MaxAgentInput,
  onChunk: (text: string, done: boolean) => void
): Promise<string> {
  const systemPrompt = await buildMaxSystemPrompt(input.ragContext, input.postVideoContext);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of input.conversationHistory) {
    messages.push({
      role: msg.role === "max" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: input.userMessage });

  const llm = getLLMSettings();
  return streamLLM(messages, onChunk, {
    model: llm.LLM_MODEL,
    temperature: llm.LLM_TEMPERATURE,
    max_tokens: llm.LLM_MAX_TOKENS,
    top_p: llm.LLM_TOP_P,
    feature_key: "chat",
    session_id: input.session_id,
  });
}

async function buildMaxSystemPrompt(ragContext?: string, postVideoContext?: string): Promise<string> {
  const characterPrompt = await getCharacterSystemPrompt("Max");
  let prompt = characterPrompt + "\n" + GAMEPLAY_RULES;

  if (ragContext) {
    prompt += `\n\n## CONTEXTE NARRATIF (SOURCE DE VÉRITÉ — utilise ces informations)\n${ragContext}`;
  }

  if (postVideoContext) {
    prompt += `\n\n## APRÈS LA VIDÉO\n${postVideoContext}`;
  }

  return prompt;
}
