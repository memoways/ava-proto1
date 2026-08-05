/**
 * useExperienceState — état de l'expérience PRD4 (mai 2026).
 *
 * Coexiste avec `useGameState` (ancien flow A/B) jusqu'à la fin de la migration.
 * Voir docs/plan_prd4_implementation.md
 */
import { useCallback, useState } from "react";
import type {
  AudioState,
  ConversationMessage,
  ExperiencePhase,
  ExperienceState,
  FilmAnswer,
  PRD4TurnLabels,
  UserPosture,
  UserRoleProfile,
} from "@/types";

const initialState: ExperienceState = {
  phase: "welcome",
  hasSeenFilm: null,
  teaserSeen: false,
  teaserSkipped: false,
  userRoleProfile: null,
  userPosture: null,
  selectedCharacter: "max",
  conversationLog: [],
  turnCount: 0,
  pttErrors: 0,
  audioState: "idle",
  endReason: null,
};

export function useExperienceState() {
  const [state, setState] = useState<ExperienceState>(initialState);

  const setPhase = useCallback((phase: ExperiencePhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setFilmAnswer = useCallback((answer: FilmAnswer) => {
    setState((s) => ({ ...s, hasSeenFilm: answer }));
  }, []);

  const markTeaserSeen = useCallback((skipped: boolean) => {
    setState((s) => ({ ...s, teaserSeen: true, teaserSkipped: skipped }));
  }, []);

  const setRoleProfile = useCallback((profile: UserRoleProfile | null) => {
    setState((s) => ({ ...s, userRoleProfile: profile }));
  }, []);

  const setUserPosture = useCallback((posture: UserPosture | null) => {
    setState((s) => ({ ...s, userPosture: posture }));
  }, []);

  const setSelectedCharacter = useCallback(
    (character: ExperienceState["selectedCharacter"]) => {
      setState((s) => ({ ...s, selectedCharacter: character }));
    },
    [],
  );

  const setAudioState = useCallback((audioState: AudioState) => {
    setState((s) => ({ ...s, audioState }));
  }, []);

  const addMessage = useCallback((msg: ConversationMessage) => {
    setState((s) => ({
      ...s,
      conversationLog: [...s.conversationLog, msg],
      turnCount: msg.role === "user" ? s.turnCount + 1 : s.turnCount,
    }));
  }, []);

  const removeLastMessage = useCallback((timestamp: number) => {
    setState((s) => {
      const last = s.conversationLog.at(-1);
      if (!last || last.timestamp !== timestamp) return s;
      return {
        ...s,
        conversationLog: s.conversationLog.slice(0, -1),
        turnCount: last.role === "user" ? Math.max(0, s.turnCount - 1) : s.turnCount,
      };
    });
  }, []);

  const incrementPttError = useCallback(() => {
    setState((s) => ({ ...s, pttErrors: s.pttErrors + 1 }));
  }, []);

  /** Met à jour les labels GM du dernier message utilisateur antérieur à `beforeTimestamp` (ou le plus récent). */
  const setLastUserLabels = useCallback((labels: PRD4TurnLabels) => {
    setState((s) => {
      const log = s.conversationLog;
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].role === "user") {
          const next = [...log];
          next[i] = { ...next[i], labels };
          return { ...s, conversationLog: next };
        }
      }
      return s;
    });
  }, []);

  const endExperience = useCallback((reason: string) => {
    setState((s) => ({ ...s, phase: "end_session", endReason: reason }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const restoreConversation = useCallback((restored: {
    conversationLog: ConversationMessage[];
    userRoleProfile: UserRoleProfile | null;
    userPosture: UserPosture | null;
    hasSeenFilm: FilmAnswer | null;
    teaserSeen: boolean;
  }) => {
    setState({
      ...initialState,
      phase: "conversation_max",
      hasSeenFilm: restored.hasSeenFilm,
      teaserSeen: restored.teaserSeen,
      userRoleProfile: restored.userRoleProfile,
      userPosture: restored.userPosture,
      conversationLog: restored.conversationLog,
      turnCount: restored.conversationLog.filter((message) => message.role === "user").length,
      audioState: "idle",
    });
  }, []);

  return {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setUserPosture,
    setSelectedCharacter,
    setAudioState,
    addMessage,
    removeLastMessage,
    setLastUserLabels,
    incrementPttError,
    endExperience,
    reset,
    restoreConversation,
  };
}
