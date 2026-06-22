import { callLLM, callLLMWithUsage, streamLLM, type LLMUsage } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, MaxConstraintCheckResult, MaxTurnKnowledgeContext } from "@/types";
import { getAntiHallucinationValidatorSettings, getLLMSettings } from "@/services/settingsService";
import { buildCharacterPromptSections, loadCharacterPromptByName, clearCharacterPromptCache } from "@/services/characterPromptService";

// Fallback minimal system prompt if DB fetch fails
const FALLBACK_SYSTEM_PROMPT = `Tu es un personnage dans une expérience narrative interactive. Parle à la première personne, en français, de façon concise (2-3 phrases). Utilise le CONTEXTE NARRATIF ci-dessous comme source de vérité.`;

// Gameplay rules — always appended regardless of character.
// IMPORTANT: ces règles sont des INVARIANTS TECHNIQUES uniquement.
// Toute consigne éditoriale (poser ou non des questions, ton, rythme, retenue, etc.)
// doit venir des sections "FICHE PERSONNAGE" issues de Notion, qui priment.
const GAMEPLAY_RULES = `
## RÈGLES TECHNIQUES (INVARIANTS)
- Parle UNIQUEMENT à la première personne, en français.
- JAMAIS de narration ("*il soupire*"), JAMAIS de méta-commentaires.
- Tes émotions passent par tes mots, ton rythme, tes hésitations.
- Réponds de façon très concise (1-2 phrases max, 45 mots maximum) car c'est une conversation orale temps réel.
- N'invente AUCUN fait absent du CONTEXTE AUTORISÉ DU TOUR ci-dessous.
- Si tu ne sais pas quelque chose, dis-le plutôt que d'inventer.

## PRIORITÉ DES INSTRUCTIONS
Les sections "FICHE PERSONNAGE" (issues de Notion) ci-dessus DÉFINISSENT TON COMPORTEMENT.
Si une instruction de la fiche contredit une règle générique (par exemple "ne pose pas de questions"),
SUIS LA FICHE PERSONNAGE. Ne pose pas systématiquement de questions à l'interlocuteur :
ne le fais que si ta fiche y invite explicitement.`;

const cachedSystemPrompts: Record<string, string> = {};
let systemPromptPromise: Promise<string> | null = null;

async function getCharacterSystemPrompt(name = "Max"): Promise<string> {
  if (cachedSystemPrompts[name]) return cachedSystemPrompts[name];

  try {
    const { data, error } = await supabase
      .from("characters")
      .select("system_prompt, name, personality")
      .eq("name", name)
      .maybeSingle();

    if (error || !data?.system_prompt) {
      console.warn(`[MaxAgent] Could not fetch system_prompt for ${name}, using fallback`);
      return FALLBACK_SYSTEM_PROMPT;
    }

    cachedSystemPrompts[data.name] = data.system_prompt;
    console.log(`[MaxAgent] Loaded system_prompt for ${data.name} (${data.system_prompt.length} chars)`);
    return data.system_prompt;
  } catch (err) {
    console.error("[MaxAgent] DB error:", err);
    return FALLBACK_SYSTEM_PROMPT;
  }
}

/** Preload system prompt into cache (call early, e.g. during intro video) */
export function preloadSystemPrompt(): void {
  if (cachedSystemPrompts["Max"] || systemPromptPromise) return;
  console.log("[MaxAgent] Preloading system prompt...");
  systemPromptPromise = getCharacterSystemPrompt().then(p => {
    systemPromptPromise = null;
    return p;
  });
}

/** Clear cached prompt (call after editing in admin) */
export function clearSystemPromptCache() {
  for (const k of Object.keys(cachedSystemPrompts)) delete cachedSystemPrompts[k];
  clearCharacterPromptCache();
}

export interface MaxAgentInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  ragContext?: string;
  postVideoContext?: string;
  session_id?: string;
  knowledgeContext?: MaxTurnKnowledgeContext;
  /** Compressed bullet-point summary of earlier turns of the same session. */
  sessionSummary?: string;
  /** PRD4 — résumé du rôle inventé par le joueur, injecté à chaque tour. */
  userRoleSummary?: string;
}

/**
 * Calls Max agent with streaming response
 */
export async function callMaxAgent(
  input: MaxAgentInput,
  onChunk: (text: string, done: boolean) => void
): Promise<string> {
  const systemPrompt = await buildMaxSystemPrompt(input.ragContext, input.postVideoContext, input.knowledgeContext, input.conversationHistory, "Max", input.sessionSummary, input.userRoleSummary);
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

export interface SimulateMaxResult {
  response: string;
  systemPrompt: string;
  usage?: LLMUsage | null;
  latencyMs?: number;
  model?: string;
  characterName?: string;
}

export async function simulateMaxResponse(
  input: MaxAgentInput,
  opts?: { characterName?: string; featureKey?: string; timeoutMs?: number },
): Promise<SimulateMaxResult> {
  const characterName = opts?.characterName || "Max";
  const systemPrompt = await buildMaxSystemPrompt(
    input.ragContext,
    input.postVideoContext,
    input.knowledgeContext,
    input.conversationHistory,
    characterName,
    input.sessionSummary,
    input.userRoleSummary,
  );
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...input.conversationHistory.map((msg) => ({
      role: msg.role === "max" ? "assistant" as const : "user" as const,
      content: msg.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const llm = getLLMSettings();
  const result = await callLLMWithUsage(messages, {
    model: llm.LLM_MODEL,
    temperature: llm.LLM_TEMPERATURE,
    max_tokens: llm.LLM_MAX_TOKENS,
    top_p: llm.LLM_TOP_P,
    timeoutMs: opts?.timeoutMs,
    feature_key: opts?.featureKey || "max_prompt_test",
  });

  return {
    response: result.content,
    systemPrompt,
    usage: result.usage,
    latencyMs: result.latencyMs,
    model: result.model,
    characterName,
  };
}

function buildValidatorPrompt(input: {
  userMessage: string;
  response: string;
  ragContext?: string;
  knowledgeContext?: MaxTurnKnowledgeContext;
}): string {
  const validatorSettings = getAntiHallucinationValidatorSettings();
  return `Tu es un validateur éditorial strict. Tu dois vérifier si la réponse de Max respecte les contraintes suivantes.

## RÈGLES À FAIRE RESPECTER
- Max ne doit affirmer aucun fait absent du contexte autorisé.
- Max ne doit jamais transformer une hypothèse en certitude.
- Max doit respecter les sujets interdits et assertions bloquées.
- Si l'information manque, Max doit exprimer le doute plutôt qu'inventer.

## BASE GLOBALE DES FAITS AUTORISÉS
${validatorSettings.authorizedFacts}

## RÈGLES GLOBALES D'ASSERTIONS BLOQUÉES
${validatorSettings.blockedAssertionRules}

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
}

export interface ValidateMaxDetailed {
  result: MaxConstraintCheckResult;
  usage?: LLMUsage | null;
  latencyMs?: number;
  model?: string;
  validatorPrompt?: string;
}

export async function validateMaxResponseDetailed(input: {
  userMessage: string;
  response: string;
  ragContext?: string;
  knowledgeContext?: MaxTurnKnowledgeContext;
}): Promise<ValidateMaxDetailed> {
  const llm = getLLMSettings();
  const validatorPrompt = buildValidatorPrompt(input);
  const callRes = await callLLMWithUsage([{ role: "system", content: validatorPrompt }], {
    model: llm.LLM_MODEL_GM,
    temperature: 0.1,
    max_tokens: 350,
    feature_key: "max_prompt_validation",
  });
  let result: MaxConstraintCheckResult;
  try {
    const jsonMatch = callRes.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json");
    result = JSON.parse(jsonMatch[0]) as MaxConstraintCheckResult;
  } catch {
    result = {
      compliant: true,
      summary: "Validation indisponible — JSON validateur illisible (fail-open).",
      violations: [],
      safe_points: ["JSON validateur non-parsable, réponse diffusée par défaut"],
    };
  }
  return { result, usage: callRes.usage, latencyMs: callRes.latencyMs, model: callRes.model, validatorPrompt };
}

export async function validateMaxResponseConstraints(input: {
  userMessage: string;
  response: string;
  ragContext?: string;
  knowledgeContext?: MaxTurnKnowledgeContext;
}): Promise<MaxConstraintCheckResult> {
  const detailed = await validateMaxResponseDetailed(input);
  return detailed.result;
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
  conversationHistory: ConversationMessage[] = [],
  characterName: string = "Max",
  sessionSummary?: string,
  userRoleSummary?: string,
): Promise<string> {
  const characterPrompt = await getCharacterSystemPrompt(characterName);
  const characterFields = await loadCharacterPromptByName(characterName);
  const fieldsSections = buildCharacterPromptSections(characterFields);

  // Ordre : (1) prompt de base personnage  →  (2) FICHE PERSONNAGE (champs Notion, PRIORITAIRES)
  //         →  (3) règles techniques génériques (qui rappellent que la fiche prime).
  let prompt = characterPrompt;
  if (fieldsSections) {
    prompt += `\n\n# FICHE PERSONNAGE (source éditoriale — prioritaire sur toute règle générique)\n${fieldsSections}`;
  }
  prompt += `\n${GAMEPLAY_RULES}`;

  if (userRoleSummary && userRoleSummary.trim()) {
    prompt += `\n\n## INTERLOCUTEUR (qui t'appelle)\n${userRoleSummary.trim()}\n\nUtilise ces éléments pour personnaliser tes réponses : adresse-toi à cette personne en cohérence avec qui elle dit être, sans jamais contredire sa présentation.`;
  }


  if (sessionSummary && sessionSummary.trim()) {
    prompt += `\n\n## SOUVENIRS DE LA SESSION (résumé compressé des tours précédents)\n${sessionSummary.trim()}`;
  }

  prompt += `\n\n## HISTORIQUE RÉCENT DU TOUR\n${formatRecentHistory(conversationHistory)}`;

  prompt += `\n\n## CONTEXTE AUTORISÉ DU TOUR\n${formatKnowledgeList("### FAITS AUTORISÉS", knowledgeContext?.allowedFacts)}\n\n${formatKnowledgeList("### SOUVENIRS ACTIVÉS", knowledgeContext?.activeMemories)}\n\n${formatKnowledgeList("### HYPOTHÈSES (à ne jamais affirmer comme vraies)", knowledgeContext?.hypotheses)}\n\n${formatKnowledgeList("### SUJETS INTERDITS", knowledgeContext?.forbiddenTopics)}\n\n${formatKnowledgeList("### ASSERTIONS BLOQUÉES", knowledgeContext?.blockedAssertions)}`;

  const hasStructuredKnowledge = Boolean(
    knowledgeContext?.allowedFacts?.length ||
    knowledgeContext?.activeMemories?.length ||
    knowledgeContext?.hypotheses?.length,
  );

  if (ragContext && !hasStructuredKnowledge) {
    prompt += `\n\n## CONTEXTE NARRATIF (SOURCE DE VÉRITÉ — utilise ces informations)\n${ragContext}`;
  }

  if (postVideoContext) {
    prompt += `\n\n## APRÈS LA VIDÉO\n${postVideoContext}`;
  }

  return prompt;
}
