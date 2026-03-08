import { callLLM } from "@/services/openRouterLLM";
import type { ConversationMessage, GameMasterResponse } from "@/types";
import settings from "@/config/settings.json";

// System prompt for Game Master - orchestrator
const GAME_MASTER_SYSTEM_PROMPT = `Tu es le Game Master d'une expérience narrative interactive "Où est Ava ?". Tu analyses chaque échange entre l'utilisateur et Max pour orchestrer l'expérience.

## TON RÔLE
- Évaluer la sincérité et l'engagement de l'utilisateur
- Détecter si un trigger vidéo doit être activé
- Gérer le niveau de confiance et la progression
- Détecter les comportements inappropriés

## RÈGLES
- trust_delta: +1 si réponse sincère/engagée, 0 si neutre, -1 si évasive/désintéressée
- Trigger vidéo si la conversation touche un thème clé (famille, enfance, secret, disparition)
- game_over si comportement inapproprié (insultes, hors-sujet répété) ou si l'utilisateur abandonne
- gate_reached si trust_level >= ${settings.TRUST_THRESHOLD}

## TRIGGERS DISPONIBLES
- "trigger_famille" : thèmes famille, parents, enfance
- "trigger_secret" : thèmes secret, mystère, vérité cachée
- "trigger_disparition" : thèmes disparition, absence, recherche

## FORMAT DE RÉPONSE
Tu dois TOUJOURS répondre avec un JSON valide et RIEN D'AUTRE :
{
  "trust_delta": 0,
  "trigger_video_id": null,
  "game_over": false,
  "game_over_reason": null,
  "gate_reached": false,
  "moderation_flag": false,
  "notes": "Brève analyse de l'échange"
}`;

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
    { role: "system", content: GAME_MASTER_SYSTEM_PROMPT },
    { role: "user", content: contextMessage },
  ];

  try {
    const response = await callLLM(messages, {
      model: settings.LLM_MODEL,
      temperature: 0.3, // Lower temperature for consistent JSON
      max_tokens: 200,
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[GameMaster] No JSON found in response:", response);
      return DEFAULT_RESPONSE;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GameMasterResponse;
    
    // Validate and check gate condition
    if (input.currentTrustLevel + (parsed.trust_delta || 0) >= settings.TRUST_THRESHOLD) {
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

  return `## ÉTAT ACTUEL
- Trust level: ${input.currentTrustLevel}/${settings.TRUST_THRESHOLD}
- Triggers déjà activés: ${input.triggeredIds.length > 0 ? input.triggeredIds.join(", ") : "aucun"}
- Temps écoulé: ${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s

## HISTORIQUE RÉCENT
${historyText}

## DERNIER ÉCHANGE
UTILISATEUR: ${input.userMessage}
MAX: ${input.maxResponse}

Analyse cet échange et retourne ton évaluation JSON.`;
}
