import { callMaxAgent, type MaxAgentInput } from "@/agents/maxAgent";
import { callGameMaster, type GameMasterInput } from "@/agents/gameMasterAgent";
import { getRAGContext } from "@/services/ragService";
import type { ConversationMessage, GameMasterResponse, VideoTrigger } from "@/types";

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
  onMaxChunk: (text: string, done: boolean) => void,
  ragContext?: string,
  postVideoContext?: string,
  sessionId?: string
): Promise<{
  maxResponse: string;
  gameMasterPromise: Promise<{ gameMasterResponse: GameMasterResponse; trigger: VideoTrigger | null }>;
}> {
  // Fetch RAG context if not provided
  let finalRagContext = ragContext;
  if (!finalRagContext) {
    try {
      const recentMessages = conversationHistory.slice(-4).map(m => m.content).join(' ');
      finalRagContext = await getRAGContext(userMessage, recentMessages);
      if (finalRagContext) {
        console.log('[RAG] Context found, injecting into prompt');
      }
    } catch (err) {
      console.error('[RAG] Failed to fetch context:', err);
    }
  }

  // Start Max streaming
  let maxFullResponse = "";
  const maxInput: MaxAgentInput = {
    conversationHistory,
    userMessage,
    ragContext: finalRagContext || undefined,
    postVideoContext,
    session_id: sessionId,
  };

  await callMaxAgent(maxInput, (text, done) => {
    if (!done) {
      maxFullResponse += text;
    }
    onMaxChunk(text, done);
  });

  // Fire Game Master in background (don't await - caller can process in parallel with TTS)
  const gameMasterPromise = (async () => {
    const gmInput: GameMasterInput = {
      conversationHistory,
      userMessage,
      maxResponse: maxFullResponse,
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

  return { maxResponse: maxFullResponse, gameMasterPromise };
}
