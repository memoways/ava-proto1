import { simulateMaxResponse, validateMaxResponseConstraints, type MaxAgentInput } from "@/agents/maxAgent";
import { callGameMaster, planGameMasterTurn, type GameMasterInput } from "@/agents/gameMasterAgent";
import { buildKnowledgeContextFromRAG, formatRAGContext, queryRAG } from "@/services/ragService";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, ConversationPipelineTrace, ConversationValidationTrace, GameMasterResponse, GameMasterTurnBrief, MaxConstraintCheckResult, VideoTrigger } from "@/types";
import { getGameplaySettings } from "@/services/settingsService";

// Demo triggers for the prototype
const DEMO_TRIGGERS: Record<string, VideoTrigger> = {
  trigger_famille: {
    id: "trigger_famille",
    title: "Flashback famille",
    type: "mid_conversation",
    themes: ["famille", "parents", "enfance"],
    placeholder_text: "Max se souvient de son enfance avec Ava. Des images de leur maison familiale, des rires partagés, avant que tout change...",
    priority: 1,
    transition_style: "fade_black",
    post_video_context: "Tu viens de te souvenir de ton enfance avec Ava. Ces souvenirs te rendent nostalgique mais aussi plus déterminé.",
    duration_seconds: 8,
  },
  trigger_secret: {
    id: "trigger_secret",
    title: "Le message cryptique",
    type: "mid_conversation",
    themes: ["secret", "mystère", "vérité"],
    placeholder_text: "Le dernier message d'Ava apparaît à l'écran. Des symboles étranges, des coordonnées partielles, un avertissement...",
    priority: 2,
    transition_style: "fade_black",
    post_video_context: "Tu as montré le message d'Ava. C'est un pas vers la confiance.",
    duration_seconds: 10,
  },
  trigger_disparition: {
    id: "trigger_disparition",
    title: "Le jour de la disparition",
    type: "mid_conversation",
    themes: ["disparition", "absence", "recherche"],
    placeholder_text: "Reconstitution du dernier jour où Ava a été vue. Son appartement vide, des indices laissés derrière elle...",
    priority: 3,
    transition_style: "fade_black",
    post_video_context: "Tu as partagé ce que tu sais sur sa disparition. La confiance grandit.",
    duration_seconds: 12,
  },
};

export interface ConversationTurnResult {
  maxResponse: string;
  gameMasterResponse: GameMasterResponse;
  trigger: VideoTrigger | null;
}

const PIPELINE_TRACE_KEY = "ava_pipeline_last_trace";
const MAX_VALIDATION_RETRIES = 1;

interface ValidatedMaxResponse {
  response: string;
  validation: ConversationValidationTrace;
}

/**
 * Orchestrates a full conversation turn with optimized latency:
 * 1. Fetch RAG context
 * 2. Stream Max agent response
 * 3. Run Game Master in parallel (doesn't block TTS)
 * Returns Max response ASAP + a promise for Game Master results
 */
export async function processConversationTurn(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentTrustLevel: number,
  triggeredIds: string[],
  timeElapsedSeconds: number,
  ragContext?: string,
  postVideoContext?: string,
  sessionId?: string
): Promise<{
  maxResponse: string;
  preTurnBrief: GameMasterTurnBrief;
  validation: ConversationValidationTrace;
  gameMasterPromise: Promise<{ gameMasterResponse: GameMasterResponse; trigger: VideoTrigger | null }>;
}> {
  // Fetch RAG context if not provided (non-blocking — start immediately)
  let finalRagContext = ragContext;
  const gameplay = getGameplaySettings();
  const ragPromise = !finalRagContext ? (async () => {
    try {
      const recentMessages = conversationHistory.slice(-4).map(m => m.content).join(' ');
      const matches = await queryRAG(userMessage, recentMessages, gameplay.RAG_TOP_K);
      const ctx = formatRAGContext(matches);
      if (ctx) console.log('[RAG] Context found, injecting into prompt');
      return { ctx, knowledgeContext: buildKnowledgeContextFromRAG(matches) };
    } catch (err) {
      console.error('[RAG] Failed to fetch context:', err);
      return { ctx: "", knowledgeContext: buildKnowledgeContextFromRAG([]) };
    }
  })() : Promise.resolve({ ctx: finalRagContext, knowledgeContext: buildKnowledgeContextFromRAG([]) });

  // Wait for RAG (runs in parallel with any preloaded system prompt)
  const ragResult = await ragPromise;
  finalRagContext = ragResult.ctx;
  debugLogger.log({ service: "other", level: "info", direction: "out", label: `Orchestrator: RAG done, calling Max`, detail: `History: ${conversationHistory.length} msgs, trust: ${currentTrustLevel}` });

  const preTurnBrief = await planGameMasterTurn({
    conversationHistory,
    userMessage,
    currentTrustLevel,
    triggeredIds,
    timeElapsedSeconds,
    knowledgeContext: ragResult.knowledgeContext,
  });

  const maxInput: MaxAgentInput = {
    conversationHistory,
    userMessage,
    ragContext: finalRagContext || undefined,
    postVideoContext,
    session_id: sessionId,
    knowledgeContext: {
      ...ragResult.knowledgeContext,
      allowedFacts: preTurnBrief.allowed_knowledge.length ? preTurnBrief.allowed_knowledge : ragResult.knowledgeContext.allowedFacts,
      forbiddenTopics: preTurnBrief.forbidden_topics.length ? preTurnBrief.forbidden_topics : ragResult.knowledgeContext.forbiddenTopics,
      blockedAssertions: preTurnBrief.blocked_assertions.length ? preTurnBrief.blocked_assertions : ragResult.knowledgeContext.blockedAssertions,
    },
  };

  const validatedTurn = await generateValidatedMaxResponse(maxInput);
  persistPipelineTrace({
    updatedAt: new Date().toISOString(),
    userMessage,
    ragContext: finalRagContext || "",
    preTurnBrief,
    finalResponse: validatedTurn.response,
    validation: validatedTurn.validation,
  });

  // Fire Game Master in background (don't await - caller can process in parallel with TTS)
  const gameMasterPromise = (async () => {
    const gmInput: GameMasterInput = {
      conversationHistory,
      userMessage,
      maxResponse: validatedTurn.response,
      currentTrustLevel,
      triggeredIds,
      timeElapsedSeconds,
    };

    const gameMasterResponse = await callGameMaster(gmInput);

    let trigger: VideoTrigger | null = null;
    if (gameMasterResponse.trigger_video_id) {
      trigger = DEMO_TRIGGERS[gameMasterResponse.trigger_video_id] || null;
    }

    return { gameMasterResponse, trigger };
  })();

  return {
    maxResponse: validatedTurn.response,
    preTurnBrief,
    validation: validatedTurn.validation,
    gameMasterPromise,
  };
}

async function generateValidatedMaxResponse(input: MaxAgentInput): Promise<ValidatedMaxResponse> {
  const reports: ConversationValidationTrace["reports"] = [];

  for (let attempt = 1; attempt <= MAX_VALIDATION_RETRIES + 1; attempt++) {
    const attemptInput = buildAttemptInput(input, reports);
    const { response } = await simulateMaxResponse(attemptInput);
    const validation = await validateAttempt(attemptInput, response);

    reports.push({
      attempt,
      response,
      compliant: validation.compliant,
      summary: validation.summary,
      violations: validation.violations,
      safe_points: validation.safe_points,
    });

    if (validation.compliant) {
      return {
        response,
        validation: {
          attempts: attempt,
          regenerated: attempt > 1,
          finalStatus: "passed",
          reports,
        },
      };
    }
  }

  const lastReport = reports[reports.length - 1];
  const fallbackResponse = "Je ne peux pas l'affirmer avec certitude à partir de ce que je sais. Je préfère rester prudent pour l'instant.";

  return {
    response: fallbackResponse,
    validation: {
      attempts: reports.length,
      regenerated: reports.length > 1,
      finalStatus: "fallback",
      reports: [
        ...reports,
        {
          attempt: reports.length + 1,
          response: fallbackResponse,
          compliant: true,
          summary: `Fallback de sécurité après validation échouée${lastReport ? ` (${lastReport.summary})` : ""}.`,
          violations: [],
          safe_points: ["Réponse remplacée par un message de prudence avant TTS."],
        },
      ],
    },
  };
}

function buildAttemptInput(input: MaxAgentInput, reports: ConversationValidationTrace["reports"]): MaxAgentInput {
  if (!reports.length) return input;

  const lastReport = reports[reports.length - 1];
  const regenerationInstruction = [
    "[RÉGÉNÉRATION SÉCURISÉE]",
    "Ta réponse précédente a été rejetée avant diffusion vocale.",
    `Violations détectées: ${lastReport.violations.join(" | ") || lastReport.summary}`,
    "Réécris une réponse plus prudente.",
    "N'affirme aucun fait absent des faits autorisés.",
    "Si l'information manque, exprime explicitement le doute ou les limites de ce que tu sais.",
  ].join("\n");

  return {
    ...input,
    userMessage: `${input.userMessage}\n\n${regenerationInstruction}`,
  };
}

async function validateAttempt(input: MaxAgentInput, response: string): Promise<MaxConstraintCheckResult> {
  return validateMaxResponseConstraints({
    userMessage: input.userMessage,
    response,
    ragContext: input.ragContext,
    knowledgeContext: input.knowledgeContext,
  });
}

function persistPipelineTrace(trace: ConversationPipelineTrace) {
  try {
    localStorage.setItem(PIPELINE_TRACE_KEY, JSON.stringify(trace));
  } catch {
    // ignore trace persistence issues
  }
}
