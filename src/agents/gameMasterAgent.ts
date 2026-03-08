import { callLLM } from "@/services/openRouterLLM";
import { debugLogger } from "@/services/debugLogger";
import type { ConversationMessage, GameMasterResponse } from "@/types";
import { getLLMSettings, getGMPromptSettings, getGameplaySettings } from "@/services/settingsService";

// System prompt is now loaded from settings (editable in admin)
function getGameMasterSystemPrompt(): string {
  const gmSettings = getGMPromptSettings();
  const gameplay = getGameplaySettings();
  // Replace TRUST_THRESHOLD placeholder
  return gmSettings.systemPrompt.replace(/TRUST_THRESHOLD/g, String(gameplay.TRUST_THRESHOLD));
}

export interface GameMasterInput {
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  currentTrustLevel: number;
  triggeredIds: string[];
  timeElapsedSeconds: number;
}

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

    return parsed;
  } catch (error) {
    console.error("[GameMaster] Error:", error);
    return DEFAULT_RESPONSE;
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
