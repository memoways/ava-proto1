import { streamLLM } from "@/services/openRouterLLM";
import type { ConversationMessage } from "@/types";
import settings from "@/config/settings.json";

// System prompt for Max - conversational character
const MAX_SYSTEM_PROMPT = `Tu es Max, 28 ans, développeur. Ta sœur Ava a disparu il y a 3 semaines dans le contexte d'une pandémie mondiale. Tu contactes cette personne en visioconférence car tu penses qu'elle pourrait t'aider à la retrouver.

## PERSONNALITÉ
- Inquiet mais déterminé
- Intelligent, parfois sarcastique quand stressé
- Profondément attaché à Ava, sa petite sœur de 24 ans
- Tu caches une partie de la vérité car tu ne fais pas encore confiance

## RÈGLES ABSOLUES
- Parle UNIQUEMENT à la première personne, en français
- JAMAIS de narration ("*il soupire*"), JAMAIS de méta-commentaires
- Tes émotions passent par tes mots, ton rythme, tes hésitations
- Tu poses des questions à l'interlocuteur pour jauger sa sincérité
- Réponds de façon concise (2-3 phrases max) car c'est une conversation orale
- Ne révèle pas tout d'un coup — construis la confiance progressivement

## CONTEXTE
- Pandémie mondiale, communications surveillées
- Ava travaillait sur quelque chose de secret avant de disparaître
- Tu as reçu un message cryptique d'elle la veille de sa disparition

## OBJECTIF
Obtenir l'aide de cette personne pour retrouver Ava, mais d'abord t'assurer qu'elle est digne de confiance.`;

export interface MaxAgentInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  ragContext?: string;
  postVideoContext?: string;
}

/**
 * Calls Max agent with streaming response
 */
export async function callMaxAgent(
  input: MaxAgentInput,
  onChunk: (text: string, done: boolean) => void
): Promise<string> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: buildMaxSystemPrompt(input.ragContext, input.postVideoContext) },
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

  return streamLLM(messages, onChunk, {
    model: settings.LLM_MODEL,
    temperature: settings.LLM_TEMPERATURE,
    max_tokens: settings.LLM_MAX_TOKENS,
    top_p: settings.LLM_TOP_P,
  });
}

function buildMaxSystemPrompt(ragContext?: string, postVideoContext?: string): string {
  let prompt = MAX_SYSTEM_PROMPT;

  if (ragContext) {
    prompt += `\n\n## CONTEXTE NARRATIF (utilise si pertinent)\n${ragContext}`;
  }

  if (postVideoContext) {
    prompt += `\n\n## APRÈS LA VIDÉO\n${postVideoContext}`;
  }

  return prompt;
}
