import { callLLM, callLLMWithUsage, LLMProxyRequestError, streamLLM, type LLMUsage } from "@/services/openRouterLLM";
import { supabase } from "@/integrations/supabase/client";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, LLMCallDiagnosticTrace, MaxConstraintCheckResult, MaxPromptAssemblyTrace, MaxTurnKnowledgeContext, TraceMessage } from "@/types";
import { getAntiHallucinationValidatorSettings, getGameplaySettings, getLLMSettings, isReasoningEnabledForModel } from "@/services/settingsService";
import { buildCharacterPromptSections, loadCharacterPromptByName, clearCharacterPromptCache } from "@/services/characterPromptService";
import {
  compileCharacterSections,
  isFallbackGmGuidance,
  MAX_DYNAMIC_SECTION_CHARS,
  MAX_STATIC_PROMPT_CHARS,
  MAX_SYSTEM_PROMPT_CHARS,
  renderCompiledCharacterSections,
  truncateAtSentenceBoundary,
} from "@/agents/maxPromptCompiler";
import {
  compileRichCharacterSections,
  renderRichSections,
  richSectionCost,
  RICH_V2_CONVERSATION_CONTRACT,
  RICH_V2_CORE_HEADER,
  RICH_V2_DYNAMIC_SECTION_CHARS,
  RICH_V2_FALLBACK_SYSTEM_PROMPT,
  RICH_V2_LIMITS,
} from "@/agents/maxRichPromptCompiler";

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

const COMPACT_GAMEPLAY_RULES = `## CONTRAT DE CONVERSATION
- Tu es le personnage décrit dans cette fiche. Parle à la première personne, en français, sans narration ni commentaire méta.
- Réponds directement à la demande présente avant toute relance, en 1 ou 2 phrases et 45 mots maximum.
- Ne termine jamais deux réponses consécutives par une question. Une question utile tous les trois ou quatre tours suffit.
- Ne rejoue pas une ouverture déjà passée et ne répète pas une information acquise.
- Garde une interprétation charitable des ambiguïtés, de l'humour et des erreurs de transcription ; au besoin, clarifie sans accuser.
- Une provocation légère ne ferme pas l'échange. Réserve l'avertissement puis la fermeture aux attaques explicites et répétées.
- La fiche, la mémoire de session, les souvenirs pertinents et l'historique récent sont tes seules sources factuelles. En cas d'incertitude, dis-le.
- Le joueur conduit librement la conversation ; garde néanmoins ton drive, ta voix et ta progression relationnelle.`;

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
    ? "début : installe la relation sans rejouer une ouverture déjà passée"
    : progress < 0.75
      ? "milieu : approfondis selon la confiance acquise"
      : "fin proche : va à l'essentiel et prépare une sortie naturelle";
  const elapsedLabel = elapsedMinutes < 1
    ? "moins d'une minute"
    : `environ ${elapsedMinutes} minute${elapsedMinutes > 1 ? "s" : ""}`;
  return `Repère interne : ${elapsedLabel}, tour ${ctx.turnIndex}, ${phase}. Adapte seulement ton rythme ; ne cite jamais ces repères.`;
}

/**
 * Bloc de guidance GM injecté dans le system prompt de Max — reboucle le
 * next_turn_guidance produit au tour précédent (auparavant calculé puis jeté).
 * Exporté pur pour être testable.
 */
export function buildGmGuidanceBlock(gm: MaxGmGuidance): string {
  const lines = [gm.guidance.trim()];
  const topics = (gm.topicsCovered ?? []).filter((t) => t && t.trim()).slice(0, 6);
  if (topics.length) {
    lines.push(`Déjà abordé : ${topics.join(", ")}. Ne repars pas de zéro.`);
  }
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
  const variant = (() => {
    try { return getGameplaySettings().MAX_PROMPT_VARIANT; } catch { return "legacy" as const; }
  })();
  const characterFields = await loadCharacterPromptByName(characterName);

  if (variant === "legacy") {
    const characterPrompt = await getCharacterSystemPrompt(characterName);
    const fieldsSections = buildCharacterPromptSections(characterFields);
    const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];
    let prompt = characterPrompt.content;
    const legacyBudgetSections: NonNullable<MaxPromptAssemblyTrace["budget"]>["sections"] = [{
      key: "legacy_system_prompt",
      title: "characters.system_prompt",
      chars: characterPrompt.content.length,
      originalChars: characterPrompt.content.length,
      included: true,
      truncated: false,
    }];
    if (fieldsSections) {
      const renderedFields = `\n\n# FICHE PERSONNAGE (source éditoriale — prioritaire sur toute règle générique)\n${fieldsSections}`;
      prompt += renderedFields;
      injectedSections.push({ key: "character_fields", title: "Fiche personnage", content: fieldsSections });
      legacyBudgetSections.push({ key: "character_fields", title: "Fiche personnage", chars: renderedFields.length, originalChars: fieldsSections.length, included: true, truncated: false });
    }
    prompt += `\n${GAMEPLAY_RULES}`;
    legacyBudgetSections.push({ key: "technical_rules", title: "Règles techniques legacy", chars: GAMEPLAY_RULES.length + 1, originalChars: GAMEPLAY_RULES.length, included: true, truncated: false });
    const legacyStaticChars = prompt.length;

    const legacySections: Array<[string, string, string | undefined]> = [
      ["user_role", "INTERLOCUTEUR (qui t'appelle)", input.userRoleSummary],
      ["temporal_context", "OÙ EN EST L'APPEL", input.temporalContext ? buildTemporalContextBlock(input.temporalContext) : undefined],
      ["session_summary", "SOUVENIRS DE LA SESSION", input.sessionSummary],
      ["gm_guidance", "CONSEIL DE MISE EN SCÈNE", input.gmGuidance?.guidance?.trim() ? buildGmGuidanceBlock(input.gmGuidance) : undefined],
      ["rag_context", "CONTEXTE NARRATIF — SOURCE DE VÉRITÉ", input.ragContext],
      ["post_video", "APRÈS LA VIDÉO", input.postVideoContext],
    ];
    for (const [key, title, rawContent] of legacySections) {
      const content = rawContent?.trim();
      if (!content) {
        legacyBudgetSections.push({ key, title, chars: 0, originalChars: 0, included: false, truncated: false, omissionReason: "section_vide" });
        continue;
      }
      const rendered = `\n\n## ${title}\n${content}`;
      prompt += rendered;
      injectedSections.push({ key, title, content });
      legacyBudgetSections.push({ key, title, chars: rendered.length, originalChars: content.length, included: true, truncated: false });
    }

    const legacyGuards = [
      ...(input.knowledgeContext?.forbiddenTopics ?? []).map((value) => `Sujet interdit : ${value}`),
      ...(input.knowledgeContext?.blockedAssertions ?? []).map((value) => `Assertion interdite : ${value}`),
    ].join("\n");
    if (legacyGuards) {
      const title = "GARDE-FOUS DU TOUR";
      const rendered = `\n\n## ${title}\n${legacyGuards}`;
      prompt += rendered;
      injectedSections.push({ key: "turn_guards", title, content: legacyGuards });
      legacyBudgetSections.push({ key: "turn_guards", title, chars: rendered.length, originalChars: legacyGuards.length, included: true, truncated: false });
    } else {
      legacyBudgetSections.push({ key: "turn_guards", title: "GARDE-FOUS DU TOUR", chars: 0, originalChars: 0, included: false, truncated: false, omissionReason: "section_vide" });
    }

    const conversationChars = input.conversationHistory.reduce((sum, message) => sum + message.content.length, 0) + input.userMessage.length;
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
      budget: {
        variant: "legacy",
        limitChars: MAX_SYSTEM_PROMPT_CHARS,
        staticLimitChars: MAX_STATIC_PROMPT_CHARS,
        staticChars: legacyStaticChars,
        totalSystemChars: prompt.length,
        historyChars: conversationChars - input.userMessage.length,
        currentUserChars: input.userMessage.length,
        totalMessageChars: prompt.length + conversationChars,
        systemToConversationRatio: conversationChars ? prompt.length / conversationChars : null,
        withinBudget: prompt.length <= MAX_SYSTEM_PROMPT_CHARS,
        sections: legacyBudgetSections,
      },
      finalSystemPrompt: prompt,
    };
  }

  if (variant === "rich_v2") {
    return buildRichMaxSystemPrompt(input, characterName, characterFields);
  }

  const compiledFields = compileCharacterSections(characterFields);

  const budgetSections: NonNullable<MaxPromptAssemblyTrace["budget"]>["sections"] = [];
  const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];
  let prompt = "";

  if (compiledFields.length) {
    prompt = "# NOYAU PERSONNAGE\n";
    budgetSections.push({
      key: "prompt_header",
      title: "En-tête du noyau",
      chars: prompt.length,
      originalChars: prompt.length,
      included: true,
      truncated: false,
    });
    for (const section of compiledFields) {
      const prefix = `\n\n## ${section.title}\n`;
      const available = MAX_STATIC_PROMPT_CHARS - COMPACT_GAMEPLAY_RULES.length - prompt.length - prefix.length - 2;
      const content = available > 0
        ? truncateAtSentenceBoundary(section.content, available)
        : "";
      if (!content) {
        budgetSections.push({
          key: section.key,
          title: section.title,
          chars: 0,
          originalChars: section.originalChars,
          included: false,
          truncated: false,
          omissionReason: "budget_statique_epuise",
        });
        continue;
      }
      const rendered = `${prefix}${content}`;
      prompt += rendered;
      budgetSections.push({
        key: section.key,
        title: section.title,
        chars: rendered.length,
        originalChars: section.originalChars,
        included: true,
        truncated: section.truncated || content.length < section.content.length,
      });
    }
    prompt += `\n\n${COMPACT_GAMEPLAY_RULES}`;
  } else {
    prompt = `${FALLBACK_SYSTEM_PROMPT}\n\n${COMPACT_GAMEPLAY_RULES}`;
    budgetSections.push({
      key: "character_fallback",
      title: "Fallback local minimal",
      chars: FALLBACK_SYSTEM_PROMPT.length,
      originalChars: FALLBACK_SYSTEM_PROMPT.length,
      included: true,
      truncated: false,
    });
  }
  budgetSections.push({
    key: "technical_rules",
    title: "Contrat de conversation",
    chars: COMPACT_GAMEPLAY_RULES.length + 2,
    originalChars: COMPACT_GAMEPLAY_RULES.length,
    included: true,
    truncated: false,
  });
  const staticChars = prompt.length;

  const appendDynamicSection = (key: keyof typeof MAX_DYNAMIC_SECTION_CHARS, title: string, rawContent?: string) => {
    const original = rawContent?.trim() ?? "";
    if (!original) {
      budgetSections.push({ key, title, chars: 0, originalChars: 0, included: false, truncated: false, omissionReason: "section_vide" });
      return;
    }
    const sectionCap = MAX_DYNAMIC_SECTION_CHARS[key];
    const sectionContent = truncateAtSentenceBoundary(original, sectionCap);
    const prefix = `\n\n## ${title}\n`;
    const remaining = MAX_SYSTEM_PROMPT_CHARS - prompt.length - prefix.length;
    const content = truncateAtSentenceBoundary(sectionContent, Math.max(0, remaining));
    if (!content) {
      budgetSections.push({ key, title, chars: 0, originalChars: original.length, included: false, truncated: false, omissionReason: "budget_systeme_epuise" });
      return;
    }
    prompt += `${prefix}${content}`;
    injectedSections.push({ key, title, content });
    budgetSections.push({
      key,
      title,
      chars: prefix.length + content.length,
      originalChars: original.length,
      included: true,
      truncated: content.length < original.length,
    });
  };

  // Deterministic dynamic order: call state, caller, memory, GM, guards, RAG, post-video.
  appendDynamicSection("temporal_context", "ÉTAT DE L'APPEL", input.temporalContext ? buildTemporalContextBlock(input.temporalContext) : undefined);
  appendDynamicSection("user_role", "RÔLE DE L'INTERLOCUTEUR", input.userRoleSummary);
  appendDynamicSection("session_summary", "MÉMOIRE DE SESSION", input.sessionSummary);

  const gmGuidance = input.gmGuidance?.guidance?.trim();
  if (gmGuidance && isFallbackGmGuidance(gmGuidance)) {
    budgetSections.push({
      key: "gm_guidance",
      title: "GUIDANCE GM",
      chars: 0,
      originalChars: gmGuidance.length,
      included: false,
      truncated: false,
      omissionReason: "guidance_fallback_sans_information",
    });
  } else {
    appendDynamicSection("gm_guidance", "GUIDANCE GM", gmGuidance && input.gmGuidance ? buildGmGuidanceBlock(input.gmGuidance) : undefined);
  }

  const guards = [
    ...(input.knowledgeContext?.forbiddenTopics ?? []).map((value) => `Sujet interdit : ${value}`),
    ...(input.knowledgeContext?.blockedAssertions ?? []).map((value) => `Assertion interdite : ${value}`),
  ].join("\n");
  appendDynamicSection("turn_guards", "GARDE-FOUS DU TOUR", guards || undefined);
  appendDynamicSection("rag_context", "SOUVENIRS PERTINENTS", input.ragContext);
  appendDynamicSection("post_video", "CONTEXTE POST-VIDÉO", input.postVideoContext);

  const renderedFields = renderCompiledCharacterSections(compiledFields);
  const historyChars = input.conversationHistory.reduce((sum, message) => sum + message.content.length, 0);
  const conversationChars = historyChars + input.userMessage.length;

  return {
    baseSystemPrompt: compiledFields.length ? renderedFields : FALLBACK_SYSTEM_PROMPT,
    baseSource: {
      kind: compiledFields.length ? "compiled" : "fallback",
      characterId: characterFields?.character_id ?? null,
      canonicalName: characterFields?.name ?? characterName,
      updatedAt: characterFields?.updated_at ?? null,
    },
    characterPrompt: {
      characterId: characterFields?.character_id ?? null,
      canonicalName: characterFields?.name ?? null,
      updatedAt: characterFields?.updated_at ?? null,
      renderedSections: renderedFields,
    },
    technicalRules: COMPACT_GAMEPLAY_RULES,
    injectedSections,
    budget: {
      variant: "compact_v1",
      limitChars: MAX_SYSTEM_PROMPT_CHARS,
      staticLimitChars: MAX_STATIC_PROMPT_CHARS,
      staticChars,
      totalSystemChars: prompt.length,
      historyChars,
      currentUserChars: input.userMessage.length,
      totalMessageChars: prompt.length + conversationChars,
      systemToConversationRatio: conversationChars ? prompt.length / conversationChars : null,
      withinBudget: prompt.length <= MAX_SYSTEM_PROMPT_CHARS,
      sections: budgetSections,
    },
    finalSystemPrompt: prompt,
  };
}

/**
 * rich_v2 — assemblage riche et déterministe.
 * `characters.system_prompt` n'est jamais lu ici : `character_prompts` est
 * l'unique source éditoriale statique.
 */
async function buildRichMaxSystemPrompt(
  input: MaxAgentInput,
  characterName: string,
  characterFields: Awaited<ReturnType<typeof loadCharacterPromptByName>>,
): Promise<MaxPromptAssemblyTrace> {
  const compiled = compileRichCharacterSections(characterFields, {
    sessionSummary: input.sessionSummary,
    turnIndex: input.temporalContext?.turnIndex,
  });
  const budgetSections: NonNullable<MaxPromptAssemblyTrace["budget"]>["sections"] = [];
  const injectedSections: MaxPromptAssemblyTrace["injectedSections"] = [];

  let prompt = "";
  if (compiled.sections.length) {
    // Le noyau rendu est exactement : en-tête + sections + contrat.
    prompt = RICH_V2_CORE_HEADER;
    budgetSections.push({
      key: "prompt_header",
      title: "En-tête du noyau",
      chars: RICH_V2_CORE_HEADER.length,
      originalChars: RICH_V2_CORE_HEADER.length,
      included: true,
      truncated: false,
    });
    compiled.sections.forEach((section, index) => {
      if (!section.content) {
        budgetSections.push({
          key: section.key,
          title: section.title,
          chars: 0,
          originalChars: section.originalChars,
          included: false,
          truncated: false,
          omissionReason: section.subparts[0]?.omissionReason ?? "budget_statique_epuise",
          priority: index + 1,
          subpartsDetected: section.subpartsDetected,
          subparts: section.subparts,
        });
        return;
      }
      prompt += `\n\n## ${section.title}\n${section.content}`;
      budgetSections.push({
        key: section.key,
        title: section.title,
        chars: richSectionCost(section.title, section.content),
        originalChars: section.originalChars,
        included: true,
        truncated: section.includedChars < section.originalChars,
        priority: index + 1,
        subpartsDetected: section.subpartsDetected,
        subparts: section.subparts,
      });
    });
    prompt += `\n\n${RICH_V2_CONVERSATION_CONTRACT}`;
  } else {
    prompt = `${RICH_V2_FALLBACK_SYSTEM_PROMPT}\n\n${RICH_V2_CONVERSATION_CONTRACT}`;
    budgetSections.push({
      key: "character_fallback",
      title: "Fallback rich_v2 minimal",
      chars: RICH_V2_FALLBACK_SYSTEM_PROMPT.length,
      originalChars: RICH_V2_FALLBACK_SYSTEM_PROMPT.length,
      included: true,
      truncated: false,
    });
  }
  budgetSections.push({
    key: "technical_rules",
    title: "Contrat de conversation",
    chars: RICH_V2_CONVERSATION_CONTRACT.length + 2,
    originalChars: RICH_V2_CONVERSATION_CONTRACT.length,
    included: true,
    truncated: false,
  });
  const staticChars = prompt.length;

  const appendDynamicSection = (
    key: keyof typeof RICH_V2_DYNAMIC_SECTION_CHARS,
    title: string,
    rawContent?: string,
  ) => {
    const original = rawContent?.trim() ?? "";
    if (!original) {
      budgetSections.push({ key, title, chars: 0, originalChars: 0, included: false, truncated: false, omissionReason: "section_vide" });
      return;
    }
    const capped = truncateAtSentenceBoundary(original, RICH_V2_DYNAMIC_SECTION_CHARS[key]);
    const prefix = `\n\n## ${title}\n`;
    const remaining = RICH_V2_LIMITS.systemHardCapChars - prompt.length - prefix.length;
    const content = truncateAtSentenceBoundary(capped, Math.max(0, remaining));
    if (!content) {
      budgetSections.push({ key, title, chars: 0, originalChars: original.length, included: false, truncated: false, omissionReason: "budget_systeme_epuise" });
      return;
    }
    prompt += `${prefix}${content}`;
    injectedSections.push({ key, title, content });
    budgetSections.push({
      key,
      title,
      chars: prefix.length + content.length,
      originalChars: original.length,
      included: true,
      truncated: content.length < original.length,
    });
  };

  appendDynamicSection("temporal_context", "ÉTAT DE L'APPEL", input.temporalContext ? buildTemporalContextBlock(input.temporalContext) : undefined);
  appendDynamicSection("user_role", "RÔLE DE L'INTERLOCUTEUR", input.userRoleSummary);
  appendDynamicSection("session_summary", "MÉMOIRE DE SESSION", input.sessionSummary);

  const gmGuidance = input.gmGuidance?.guidance?.trim();
  if (gmGuidance && isFallbackGmGuidance(gmGuidance)) {
    budgetSections.push({
      key: "gm_guidance",
      title: "GUIDANCE GM",
      chars: 0,
      originalChars: gmGuidance.length,
      included: false,
      truncated: false,
      omissionReason: "guidance_fallback_sans_information",
    });
  } else {
    appendDynamicSection("gm_guidance", "GUIDANCE GM", gmGuidance && input.gmGuidance ? buildGmGuidanceBlock(input.gmGuidance) : undefined);
  }

  const guards = [
    ...(input.knowledgeContext?.forbiddenTopics ?? []).map((value) => `Sujet interdit : ${value}`),
    ...(input.knowledgeContext?.blockedAssertions ?? []).map((value) => `Assertion interdite : ${value}`),
  ].join("\n");
  appendDynamicSection("turn_guards", "GARDE-FOUS DU TOUR", guards || undefined);
  appendDynamicSection("rag_context", "SOUVENIRS PERTINENTS", input.ragContext);
  appendDynamicSection("post_video", "CONTEXTE POST-VIDÉO", input.postVideoContext);

  const renderedFields = renderRichSections(compiled.sections);
  const historyChars = input.conversationHistory.reduce((sum, message) => sum + message.content.length, 0);
  const conversationChars = historyChars + input.userMessage.length;

  return {
    baseSystemPrompt: compiled.sections.length ? renderedFields : FALLBACK_SYSTEM_PROMPT,
    baseSource: {
      kind: compiled.sections.length ? "compiled" : "fallback",
      characterId: characterFields?.character_id ?? null,
      canonicalName: characterFields?.name ?? characterName,
      updatedAt: characterFields?.updated_at ?? null,
    },
    characterPrompt: {
      characterId: characterFields?.character_id ?? null,
      canonicalName: characterFields?.name ?? null,
      updatedAt: characterFields?.updated_at ?? null,
      renderedSections: renderedFields,
    },
    technicalRules: RICH_V2_CONVERSATION_CONTRACT,
    injectedSections,
    budget: {
      variant: "rich_v2",
      limitChars: RICH_V2_LIMITS.systemHardCapChars,
      staticLimitChars: RICH_V2_LIMITS.staticMaxChars,
      staticChars,
      totalSystemChars: prompt.length,
      historyChars,
      currentUserChars: input.userMessage.length,
      totalMessageChars: prompt.length + conversationChars,
      systemToConversationRatio: conversationChars ? prompt.length / conversationChars : null,
      withinBudget: prompt.length <= RICH_V2_LIMITS.systemHardCapChars,
      sections: budgetSections,
      timelineEvents: compiled.timelineEvents,
      ...(compiled.depthSelection ? { depthSelection: compiled.depthSelection } : {}),
    },
    finalSystemPrompt: prompt,
  };
}
