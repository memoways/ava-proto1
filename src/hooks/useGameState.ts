import { useState, useCallback } from "react";
import type { GameState, GamePhase, AudioState, ConversationMessage, VideoTrigger } from "@/types";

const initialState: GameState = {
  phase: "onboarding",
  trustLevel: 0,
  triggeredIds: [],
  questionCount: 0,
  audioState: "idle",
  conversationLog: [],
  gameOverReason: null,
  currentTrigger: null,
};

export function useGameState() {
  const [state, setState] = useState<GameState>(initialState);

  const setPhase = useCallback((phase: GamePhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setAudioState = useCallback((audioState: AudioState) => {
    setState((s) => ({ ...s, audioState }));
  }, []);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setState((s) => ({
      ...s,
      conversationLog: [...s.conversationLog, msg],
      questionCount: msg.role === "user" ? s.questionCount + 1 : s.questionCount,
    }));
  }, []);

  const updateTrust = useCallback((delta: number) => {
    setState((s) => ({ ...s, trustLevel: Math.max(0, s.trustLevel + delta) }));
  }, []);

  const triggerVideo = useCallback((trigger: VideoTrigger) => {
    setState((s) => ({
      ...s,
      phase: "video_trigger",
      currentTrigger: trigger,
      triggeredIds: [...s.triggeredIds, trigger.id],
    }));
  }, []);

  const endTrigger = useCallback(() => {
    setState((s) => ({ ...s, phase: "conversation", currentTrigger: null }));
  }, []);

  const gameOver = useCallback((reason: string) => {
    setState((s) => ({ ...s, phase: "game_over", gameOverReason: reason }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    setPhase,
    setAudioState,
    addMessage,
    updateTrust,
    triggerVideo,
    endTrigger,
    gameOver,
    reset,
  };
}
