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

  const incrementPttError = useCallback(() => {
    setState((s) => ({ ...s, pttErrors: s.pttErrors + 1 }));
  }, []);

  const endExperience = useCallback((reason: string) => {
    setState((s) => ({ ...s, phase: "end_session", endReason: reason }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  return {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setSelectedCharacter,
    setAudioState,
    addMessage,
    incrementPttError,
    endExperience,
    reset,
  };
}
