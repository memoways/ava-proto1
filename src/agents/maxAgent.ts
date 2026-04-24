import { callLLM, streamLLM } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, MaxConstraintCheckResult, MaxTurnKnowledgeContext } from "@/types";
import { getLLMSettings, getMaxPromptControlSettings } from "@/services/settingsService";

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
  knowledgeContext?: MaxTurnKnowledgeContext;
}

/**
 * Calls Max agent with streaming response
 */
export async function callMaxAgent(
  input: MaxAgentInput,
  onChunk: (text: string, done: boolean) => void
): Promise<string> {
  const systemPrompt = await buildMaxSystemPrompt(input.ragContext, input.postVideoContext, input.knowledgeContext, input.conversationHistory);
  debugLogger.log({ service: "llm", level: "info", direction: "out", label: `Max agent: ${input.conversationHistory.length} history + "${input.userMessage.slice(0, 80)}"`, payload: `System prompt: ${systemPrompt.length} chars` });

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

export async function simulateMaxResponse(input: MaxAgentInput): Promise<{ response: string; systemPrompt: string }> {
  const systemPrompt = await buildMaxSystemPrompt(input.ragContext, input.postVideoContext, input.knowledgeContext, input.conversationHistory);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...input.conversationHistory.map((msg) => ({
      role: msg.role === "max" ? "assistant" as const : "user" as const,
      content: msg.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const llm = getLLMSettings();
  const response = await callLLM(messages, {
    model: llm.LLM_MODEL,
    temperature: llm.LLM_TEMPERATURE,
    max_tokens: llm.LLM_MAX_TOKENS,
    top_p: llm.LLM_TOP_P,
    feature_key: "max_prompt_test",
  });

  return { response, systemPrompt };
}

export async function validateMaxResponseConstraints(input: {
  userMessage: string;
  response: string;
  ragContext?: string;
  knowledgeContext?: MaxTurnKnowledgeContext;
}): Promise<MaxConstraintCheckResult> {
  const llm = getLLMSettings();
  const control = getMaxPromptControlSettings();
  const validatorPrompt = `Tu es un validateur éditorial strict. Tu dois vérifier si la réponse de Max respecte les contraintes suivantes.

## RÈGLES À FAIRE RESPECTER
- Max ne doit affirmer aucun fait absent du contexte autorisé.
- Max ne doit jamais transformer une hypothèse en certitude.
- Max doit respecter les sujets interdits et assertions bloquées.
- Si l'information manque, Max doit exprimer le doute plutôt qu'inventer.

## POLITIQUE D'AFFIRMATION
${control.forbiddenAssertions}

## SUJETS INTERDITS
${control.forbiddenTopics}

## CONTEXTE AUTORISÉ
${formatKnowledgeList("FAITS AUTORISÉS", input.knowledgeContext?.allowedFacts)}

${formatKnowledgeList("SOUVENIRS ACTIVÉS", input.knowledgeContext?.activeMemories)}

${formatKnowledgeList("HYPOTHÈSES", input.knowledgeContext?.hypotheses)}

${formatKnowledgeList("SUJETS INTERDITS", input.knowledgeContext?.forbiddenTopics)}

${formatKnowledgeList("ASSERTIONS BLOQUÉES", input.knowledgeContext?.blockedAssertions)}

## CONTEXTE RAG BRUT
${input.ragContext || "aucun"}

## MESSAGE UTILISATEUR
${input.userMessage}

## RÉPONSE DE MAX À ÉVALUER
${input.response}

Retourne UNIQUEMENT un JSON valide avec cette structure:
{
  "compliant": true,
  "summary": "...",
  "violations": ["..."],
  "safe_points": ["..."]
}`;

  const raw = await callLLM([{ role: "system", content: validatorPrompt }], {
    model: llm.LLM_MODEL_GM,
    temperature: 0.1,
    max_tokens: 350,
    feature_key: "max_prompt_validation",
  });

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in validator response");
    return JSON.parse(jsonMatch[0]) as MaxConstraintCheckResult;
  } catch {
    return {
      compliant: false,
      summary: "Validation indisponible — réponse du validateur illisible.",
      violations: ["Impossible de parser le rapport de validation."],
      safe_points: [],
    };
  }
}

function formatKnowledgeList(title: string, values?: string[]): string {
  if (!values?.length) return `${title}\n- aucun`;
  return `${title}\n${values.map((value) => `- ${value}`).join("\n")}`;
}

function formatRecentHistory(history: ConversationMessage[]): string {
  if (!history.length) return "- aucun historique récent";
  return history.slice(-6).map((msg) => `- ${msg.role === "user" ? "UTILISATEUR" : "MAX"}: ${msg.content}`).join("\n");
}

async function buildMaxSystemPrompt(
  ragContext?: string,
  postVideoContext?: string,
  knowledgeContext?: MaxTurnKnowledgeContext,
  conversationHistory: ConversationMessage[] = []
): Promise<string> {
  const characterPrompt = await getCharacterSystemPrompt("Max");
  const control = getMaxPromptControlSettings();
  let prompt = `${characterPrompt}\n${GAMEPLAY_RULES}\n\n## PERSONA STABLE\n${control.persona}\n\n## OBJECTIFS\n${control.objectives}\n\n## RÔLE ET CONTEXTE\n${control.roleContext}\n\n## HISTORIQUE STABLE\n${control.longTermMemory}\n\n## STYLE DE RÉPONSE\n${control.responseStyle}\n\n## POLITIQUE DE SAVOIR AUTORISÉ\n${control.allowedKnowledgePolicy}\n\n## INTERDITS D'AFFIRMATION\n${control.forbiddenAssertions}\n\n## SUJETS SENSIBLES / INTERDITS\n${control.forbiddenTopics}\n\n## POLITIQUE D'INCERTITUDE\n${control.uncertaintyPolicy}`;

  prompt += `\n\n## HISTORIQUE RÉCENT DU TOUR\n${formatRecentHistory(conversationHistory)}`;

  prompt += `\n\n## CONTEXTE AUTORISÉ DU TOUR\n${formatKnowledgeList("### FAITS AUTORISÉS", knowledgeContext?.allowedFacts)}\n\n${formatKnowledgeList("### SOUVENIRS ACTIVÉS", knowledgeContext?.activeMemories)}\n\n${formatKnowledgeList("### HYPOTHÈSES (à ne jamais affirmer comme vraies)", knowledgeContext?.hypotheses)}\n\n${formatKnowledgeList("### SUJETS INTERDITS", knowledgeContext?.forbiddenTopics)}\n\n${formatKnowledgeList("### ASSERTIONS BLOQUÉES", knowledgeContext?.blockedAssertions)}`;

  if (ragContext) {
    prompt += `\n\n## CONTEXTE NARRATIF (SOURCE DE VÉRITÉ — utilise ces informations)\n${ragContext}`;
  }

  if (postVideoContext) {
    prompt += `\n\n## APRÈS LA VIDÉO\n${postVideoContext}`;
  }

  return prompt;
}
