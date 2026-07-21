import { callLLM, callLLMWithUsage, LLMProxyRequestError, streamLLM, type LLMUsage } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, LLMCallDiagnosticTrace, MaxConstraintCheckResult, MaxPromptAssemblyTrace, MaxTurnKnowledgeContext, TraceMessage } from "@/types";
import { getAntiHallucinationValidatorSettings, getLLMSettings, isReasoningEnabledForModel } from "@/services/settingsService";
import { buildCharacterPromptSections, loadCharacterPromptByName, clearCharacterPromptCache } from "@/services/characterPromptService";

// Fallback minimal system prompt if DB fetch fails
const FALLBACK_SYSTEM_PROMPT = `Tu es un personnage dans une expérience narrative interactive. Parle à la première personne, en français, de façon concise (1-2 phrases, 45 mots maximum). Utilise le CONTEXTE NARRATIF ci-dessous comme source de vérité.`;

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

interface CharacterSystemPromptSource {
  content: string;
  kind: "database" | "fallback";
  characterId: string | null;
  canonicalName: string;
  updatedAt: string | null;
}

const cachedSystemPrompts: Record<string, CharacterSystemPromptSource> = {};
let systemPromptPromise: Promise<CharacterSystemPromptSource> | null = null;

async function getCharacterSystemPrompt(name = "Max"): Promise<CharacterSystemPromptSource> {
  if (cachedSystemPrompts[name]) return cachedSystemPrompts[name];

  try {
    // Cascade lookup: exact, "Name %", "Name%" — DB stocke "Max Lorenzo" mais l'app passe "Max".
    const selectCharacter = () => supabase.from("characters").select("id, system_prompt, name, updated_at");
    let { data } = await selectCharacter().ilike("name", name).maybeSingle();
    if (!data) ({ data } = await selectCharacter().ilike("name", `${name} %`).limit(1).maybeSingle());
    if (!data) ({ data } = await selectCharacter().ilike("name", `${name}%`).limit(1).maybeSingle());

    if (!data?.system_prompt) {
      console.warn(`[MaxAgent] Could not fetch system_prompt for "${name}" (DB has no match or empty system_prompt), using fallback`);
      return {
        content: FALLBACK_SYSTEM_PROMPT,
        kind: "fallback",
        characterId: data?.id ?? null,
        canonicalName: data?.name ?? name,
        updatedAt: data?.updated_at ?? null,
      };
    }

    const source: CharacterSystemPromptSource = {
      content: data.system_prompt,
      kind: "database",
      characterId: data.id,
      canonicalName: data.name,
      updatedAt: data.updated_at,
    };
    cachedSystemPrompts[name] = source;
    cachedSystemPrompts[data.name] = source;
    console.log(`[MaxAgent] Loaded system_prompt for "${name}" → "${data.name}" (${data.system_prompt.length} chars)`);
    return source;
  } catch (err) {
    console.error("[MaxAgent] DB error:", err);
    return {
      content: FALLBACK_SYSTEM_PROMPT,
      kind: "fallback",
      characterId: null,
      canonicalName: name,
      updatedAt: null,
    };
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
  /** PRD4 — repères temporels du tour (temps écoulé, tour, phase d'appel). */
  temporalContext?: MaxTemporalContext;
  /** PRD4 — consigne de mise en scène produite par le GM au tour précédent. */
  gmGuidance?: MaxGmGuidance;
}

export interface MaxTemporalContext {
  timeElapsedSeconds: number;
  sessionDurationSeconds: number;
  turnIndex: number;
}

export interface MaxGmGuidance {
  /** next_turn_guidance du GM post-tour du tour précédent. */
  guidance: string;
  /** Sujets déjà couverts, cumulés sur la session (dédupliqués). */
  topicsCovered?: string[];
}

/**
 * Bloc temporel injecté dans le system prompt de Max — sans lui, Max n'a
 * aucune notion du temps écoulé ni de la progression de l'appel (seul le GM
 * recevait ces repères). Exporté pur pour être testable.
 */
export function buildTemporalContextBlock(ctx: MaxTemporalContext): string {
  const elapsedMinutes = Math.floor(Math.max(0, ctx.timeElapsedSeconds) / 60);
  const duration = Math.max(1, ctx.sessionDurationSeconds);
  const progress = Math.min(1, Math.max(0, ctx.timeElapsedSeconds / duration));
  const phase = progress < 0.25
    ? "Début de l'appel : vous faites connaissance — installe la relation conformément à ta fiche personnage."
    : progress < 0.75
      ? "Milieu de l'appel : la conversation est installée, tu peux approfondir."
      : "L'appel approche de sa fin : resserre l'échange, va à l'essentiel, prépare une sortie naturelle.";
  const elapsedLabel = elapsedMinutes < 1
    ? "moins d'une minute"
    : `environ ${elapsedMinutes} minute${elapsedMinutes > 1 ? "s" : ""}`;
  return `## OÙ EN EST L'APPEL (repères internes — ne jamais citer ces chiffres)
- L'appel dure depuis ${elapsedLabel} ; c'est ton ${ctx.turnIndex}e tour de parole.
- ${phase}
Utilise ces repères implicitement (rythme, patience, urgence), sans jamais mentionner de compteur, de tour ou de minuterie.`;
}

/**
 * Bloc de guidance GM injecté dans le system prompt de Max — reboucle le
 * next_turn_guidance produit au tour précédent (auparavant calculé puis jeté).
 * Exporté pur pour être testable.
 */
export function buildGmGuidanceBlock(gm: MaxGmGuidance): string {
  const lines = [`## CONSEIL DE MISE EN SCÈNE (note interne, ne jamais la mentionner)\n${gm.guidance.trim()}`];
  const topics = (gm.topicsCovered ?? []).filter((t) => t && t.trim()).slice(0, 12);
  if (topics.length) {
    lines.push(`Sujets déjà abordés durant l'appel (ne pas re-poser les mêmes bases) : ${topics.join(", ")}.`);
  }
  lines.push("Ce conseil oriente ton attitude pour CE tour ; ta fiche personnage reste prioritaire s'il la contredit.");
  return lines.join("\n");
}

/**
 * Calls Max agent with streaming response
 */
export async function callMaxAgent(
  input: MaxAgentInput,
  onChunk: (text: string, done: boolean) => void
): Promise<string> {
  const { finalSystemPrompt: systemPrompt } = await buildMaxSystemPrompt(input, "Max");
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
  promptTrace?: MaxPromptAssemblyTrace;
  messages?: TraceMessage[];
  diagnosticTrace?: LLMCallDiagnosticTrace | null;
  promptBuildLatencyMs?: number;
  requestedSettings?: {
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    reasoning: boolean;
    timeoutMs: number | null;
  };
}

export type SimulateMaxDiagnosticContext = Pick<
  SimulateMaxResult,
  "promptTrace" | "messages" | "diagnosticTrace" | "promptBuildLatencyMs" | "requestedSettings"
>;

export class SimulateMaxResponseError extends Error {
  readonly diagnosticContext: SimulateMaxDiagnosticContext;

  constructor(message: string, diagnosticContext: SimulateMaxDiagnosticContext, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
    this.name = "SimulateMaxResponseError";
    this.diagnosticContext = diagnosticContext;
  }
}

export async function simulateMaxResponse(
  input: MaxAgentInput,
  opts?: { characterName?: string; featureKey?: string; timeoutMs?: number; signal?: AbortSignal; diagnosticTrace?: boolean },
): Promise<SimulateMaxResult> {
  const characterName = opts?.characterName || "Max";
  const promptBuildStartedAt = performance.now();
  const promptTrace = await buildMaxSystemPrompt(input, characterName);
  const promptBuildLatencyMs = Math.round(performance.now() - promptBuildStartedAt);
  const systemPrompt = promptTrace.finalSystemPrompt;
  const messages: TraceMessage[] = [
    { role: "system", content: systemPrompt },
    ...input.conversationHistory.map((msg) => ({
      role: msg.role === "max" ? "assistant" as const : "user" as const,
      content: msg.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const llm = getLLMSettings();
  const reasoning = isReasoningEnabledForModel(llm.LLM_MODEL, llm);
  const requestedSettings = {
    model: llm.LLM_MODEL,
    temperature: llm.LLM_TEMPERATURE,
    maxTokens: llm.LLM_MAX_TOKENS,
    topP: llm.LLM_TOP_P,
    reasoning,
    timeoutMs: opts?.timeoutMs ?? null,
  };
  let result: Awaited<ReturnType<typeof callLLMWithUsage>>;
  try {
    result = await callLLMWithUsage(messages, {
      model: llm.LLM_MODEL,
      temperature: llm.LLM_TEMPERATURE,
      max_tokens: llm.LLM_MAX_TOKENS,
      top_p: llm.LLM_TOP_P,
      timeoutMs: opts?.timeoutMs,
      signal: opts?.signal,
      feature_key: opts?.featureKey || "max_prompt_test",
      session_id: input.session_id,
      diagnostic_trace: opts?.diagnosticTrace === true,
    });
  } catch (error) {
    if (!opts?.diagnosticTrace) throw error;
    throw new SimulateMaxResponseError(
      error instanceof Error ? error.message : String(error),
      {
        promptTrace,
        messages,
        diagnosticTrace: error instanceof LLMProxyRequestError ? error.diagnosticTrace : null,
        promptBuildLatencyMs,
        requestedSettings,
      },
      error,
    );
  }

  return {
    response: result.content,
    systemPrompt,
    usage: result.usage,
    latencyMs: result.latencyMs,
    model: result.model,
    characterName,
    promptTrace: opts?.diagnosticTrace ? promptTrace : undefined,
    messages: opts?.diagnosticTrace ? messages : undefined,
    diagnosticTrace: opts?.diagnosticTrace ? result.diagnosticTrace : undefined,
    promptBuildLatencyMs,
    requestedSettings,
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

export async function buildMaxSystemPrompt(
  input: MaxAgentInput,
  characterName: string = "Max",
): Promise<MaxPromptAssemblyTrace> {
  const characterPrompt = await getCharacterSystemPrompt(characterName);
  const characterFields = await loadCharacterPromptByName(characterName);
  const fieldsSections = buildCharacterPromptSections(characterFields);
  const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];

  // Ordre : (1) prompt de base personnage  →  (2) FICHE PERSONNAGE (champs Notion, PRIORITAIRES)
  //         →  (3) règles techniques génériques (qui rappellent que la fiche prime).
  let prompt = characterPrompt.content;
  if (fieldsSections) {
    prompt += `\n\n# FICHE PERSONNAGE (source éditoriale — prioritaire sur toute règle générique)\n${fieldsSections}`;
    injectedSections.push({ key: "character_fields", title: "Fiche personnage", content: fieldsSections });
  }
  prompt += `\n${GAMEPLAY_RULES}`;

  if (input.userRoleSummary && input.userRoleSummary.trim()) {
    const content = `${input.userRoleSummary.trim()}\n\nUtilise ces éléments pour personnaliser tes réponses : adresse-toi à cette personne en cohérence avec qui elle dit être, sans jamais contredire sa présentation.`;
    prompt += `\n\n## INTERLOCUTEUR (qui t'appelle)\n${content}`;
    injectedSections.push({ key: "user_role", title: "Interlocuteur", content });
  }

  if (input.temporalContext) {
    const content = buildTemporalContextBlock(input.temporalContext);
    prompt += `\n\n${content}`;
    injectedSections.push({ key: "temporal_context", title: "Où en est l'appel", content });
  }

  if (input.sessionSummary && input.sessionSummary.trim()) {
    const content = input.sessionSummary.trim();
    prompt += `\n\n## SOUVENIRS DE LA SESSION (résumé compressé des tours précédents)\n${content}`;
    injectedSections.push({ key: "session_summary", title: "Souvenirs de la session", content });
  }

  if (input.gmGuidance?.guidance?.trim()) {
    const content = buildGmGuidanceBlock(input.gmGuidance);
    prompt += `\n\n${content}`;
    injectedSections.push({ key: "gm_guidance", title: "Conseil de mise en scène", content });
  }

  // RAG brut TOUJOURS injecté comme source de vérité (les faits qui en sortent sont
  // des extraits validés du récit Notion — pas des hypothèses). Le bloc structuré
  // ci-dessous ne sert qu'à signaler d'éventuels sujets interdits / assertions bloquées.
  if (input.ragContext) {
    const content = `Les informations ci-dessous sont des faits canoniques sur ta vie, extraits de ton histoire. Tu peux les énoncer librement comme si tu t'en souvenais (lieux, dates, noms, événements). Tu n'inventes RIEN au-delà.\n\n${input.ragContext}`;
    prompt += `\n\n## CONTEXTE NARRATIF — SOURCE DE VÉRITÉ\n${content}`;
    injectedSections.push({ key: "rag_context", title: "Contexte narratif", content });
  }

  const hasContextualGuards = Boolean(
    input.knowledgeContext?.forbiddenTopics?.length ||
    input.knowledgeContext?.blockedAssertions?.length,
  );
  if (hasContextualGuards) {
    const content = `${formatKnowledgeList("### SUJETS INTERDITS", input.knowledgeContext?.forbiddenTopics)}\n\n${formatKnowledgeList("### ASSERTIONS BLOQUÉES", input.knowledgeContext?.blockedAssertions)}`;
    prompt += `\n\n## GARDE-FOUS DU TOUR\n${content}`;
    injectedSections.push({ key: "turn_guards", title: "Garde-fous du tour", content });
  }

  if (input.postVideoContext) {
    prompt += `\n\n## APRÈS LA VIDÉO\n${input.postVideoContext}`;
    injectedSections.push({ key: "post_video", title: "Après la vidéo", content: input.postVideoContext });
  }

  return {
    baseSystemPrompt: characterPrompt.content,
    baseSource: {
      kind: characterPrompt.kind,
      characterId: characterPrompt.characterId,
      canonicalName: characterPrompt.canonicalName,
      updatedAt: characterPrompt.updatedAt,
    },
    characterPrompt: {
      characterId: characterFields?.character_id ?? null,
      canonicalName: characterFields?.name ?? null,
      updatedAt: characterFields?.updated_at ?? null,
      renderedSections: fieldsSections,
    },
    technicalRules: GAMEPLAY_RULES,
    injectedSections,
    finalSystemPrompt: prompt,
  };
}
