import { callLLM } from "@/services/openRouterLLM";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, GameMasterResponse, GameMasterTurnBrief, MaxTurnKnowledgeContext } from "@/types";
import { getLLMSettings, getGMPromptSettings, getGameplaySettings } from "@/services/settingsService";

// System prompt is now loaded from settings (editable in admin)
function getGameMasterSystemPrompt(): string {
  const gmSettings = getGMPromptSettings();
  const gameplay = getGameplaySettings();
  // Replace TRUST_THRESHOLD placeholder
  return gmSettings.systemPrompt.replace(/TRUST_THRESHOLD/g, String(gameplay.TRUST_THRESHOLD));
}

function getGameMasterPreTurnPrompt(): string {
  return getGMPromptSettings().preTurnPlannerPrompt;
}

export interface GameMasterInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  currentTrustLevel: number;
  triggeredIds: string[];
  timeElapsedSeconds: number;
}

export interface GameMasterPreTurnInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  currentTrustLevel: number;
  triggeredIds: string[];
  timeElapsedSeconds: number;
  knowledgeContext?: MaxTurnKnowledgeContext;
}

const DEFAULT_TURN_BRIEF: GameMasterTurnBrief = {
  response_mode: "méfiant",
  openness_level: 1,
  emotional_state: "tendu",
  conversation_goal: "tester la sincérité de l'interlocuteur",
  reveal_budget: 0,
  allowed_knowledge: [],
  forbidden_topics: [],
  blocked_assertions: [],
  style_instructions: ["répondre brièvement", "exprimer le doute si nécessaire"],
  trigger_hint: null,
  notes: "Brief par défaut appliqué",
};

const DEFAULT_RESPONSE: GameMasterResponse = {
  trust_delta: 0,
  trigger_video_id: null,
  game_over: false,
  game_over_reason: null,
  gate_reached: false,
  moderation_flag: false,
  notes: "Analyse non disponible",
};

/**
 * Calls Game Master agent (non-streaming, returns JSON)
 */
export async function callGameMaster(input: GameMasterInput): Promise<GameMasterResponse> {
  const contextMessage = buildContextMessage(input);

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: getGameMasterSystemPrompt() },
    { role: "user", content: contextMessage },
  ];

  try {
    debugLogger.log({ service: "gm", level: "info", direction: "out", label: "Game Master evaluation", payload: contextMessage.slice(0, 300) });
    const llm = getLLMSettings();
    const response = await callLLM(messages, {
      model: llm.LLM_MODEL_GM,
      temperature: llm.LLM_TEMPERATURE_GM,
      max_tokens: llm.LLM_MAX_TOKENS_GM,
      feature_key: "game_master",
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      debugLogger.log({ service: "gm", level: "error", direction: "in", label: "No JSON in GM response", payload: response });
      console.error("[GameMaster] No JSON found in response:", response);
      return DEFAULT_RESPONSE;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GameMasterResponse;
    
    const gameplay = getGameplaySettings();
    if (input.currentTrustLevel + (parsed.trust_delta || 0) >= gameplay.TRUST_THRESHOLD) {
      parsed.gate_reached = true;
    }

    // Don't trigger same video twice
    if (parsed.trigger_video_id && input.triggeredIds.includes(parsed.trigger_video_id)) {
      parsed.trigger_video_id = null;
    }

    debugLogger.log({ service: "gm", level: "success", direction: "in", label: `GM → trust_delta=${parsed.trust_delta}, gate=${parsed.gate_reached}, trigger=${parsed.trigger_video_id || "none"}`, payload: JSON.stringify(parsed, null, 2) });
    return parsed;
  } catch (error) {
    debugLogger.logError("gm", "Game Master error", error);
    console.error("[GameMaster] Error:", error);
    return DEFAULT_RESPONSE;
  }
}

export async function planGameMasterTurn(input: GameMasterPreTurnInput): Promise<GameMasterTurnBrief> {
  const contextMessage = buildPreTurnContextMessage(input);
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: getGameMasterPreTurnPrompt() },
    { role: "user", content: contextMessage },
  ];

  try {
    debugLogger.log({ service: "gm", level: "info", direction: "out", label: "Game Master pre-turn planning", payload: contextMessage.slice(0, 300) });
    const llm = getLLMSettings();
    const response = await callLLM(messages, {
      model: llm.LLM_MODEL_GM,
      temperature: 0.2,
      max_tokens: 400,
      feature_key: "game_master_pre_turn",
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return DEFAULT_TURN_BRIEF;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<GameMasterTurnBrief>;
    return {
      ...DEFAULT_TURN_BRIEF,
      ...parsed,
      allowed_knowledge: parsed.allowed_knowledge || input.knowledgeContext?.allowedFacts || [],
      forbidden_topics: parsed.forbidden_topics || input.knowledgeContext?.forbiddenTopics || [],
      blocked_assertions: parsed.blocked_assertions || input.knowledgeContext?.blockedAssertions || [],
      style_instructions: parsed.style_instructions?.length ? parsed.style_instructions : DEFAULT_TURN_BRIEF.style_instructions,
    };
  } catch (error) {
    debugLogger.logError("gm", "Game Master pre-turn error", error);
    return {
      ...DEFAULT_TURN_BRIEF,
      allowed_knowledge: input.knowledgeContext?.allowedFacts || [],
      forbidden_topics: input.knowledgeContext?.forbiddenTopics || [],
      blocked_assertions: input.knowledgeContext?.blockedAssertions || [],
    };
  }
}

function buildContextMessage(input: GameMasterInput): string {
  const recentHistory = input.conversationHistory.slice(-6); // Last 6 messages
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`)
    .join("\n");

  const gameplay = getGameplaySettings();
  return `## ÉTAT ACTUEL
- Trust level: ${input.currentTrustLevel}/${gameplay.TRUST_THRESHOLD}
- Triggers déjà activés: ${input.triggeredIds.length > 0 ? input.triggeredIds.join(", ") : "aucun"}
- Temps écoulé: ${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s

## HISTORIQUE RÉCENT
${historyText}

## DERNIER ÉCHANGE
UTILISATEUR: ${input.userMessage}
MAX: ${input.maxResponse}

Analyse cet échange et retourne ton évaluation JSON.`;
}

function buildPreTurnContextMessage(input: GameMasterPreTurnInput): string {
  const recentHistory = input.conversationHistory.slice(-6);
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`)
    .join("\n");

  const gameplay = getGameplaySettings();

  return `## ÉTAT ACTUEL
- Trust level: ${input.currentTrustLevel}/${gameplay.TRUST_THRESHOLD}
- Triggers déjà activés: ${input.triggeredIds.length > 0 ? input.triggeredIds.join(", ") : "aucun"}
- Temps écoulé: ${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s

## HISTORIQUE RÉCENT
${historyText || "aucun"}

## MESSAGE UTILISATEUR
${input.userMessage}

## CONTEXTE AUTORISÉ
- allowed_facts: ${(input.knowledgeContext?.allowedFacts || []).join(" | ") || "aucun"}
- hypotheses: ${(input.knowledgeContext?.hypotheses || []).join(" | ") || "aucune"}
- forbidden_topics: ${(input.knowledgeContext?.forbiddenTopics || []).join(" | ") || "aucun"}
- blocked_assertions: ${(input.knowledgeContext?.blockedAssertions || []).join(" | ") || "aucune"}

Produis le brief JSON du prochain tour de Max.`;
}
