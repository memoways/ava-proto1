/**
 * IndexPRD4 — Nouveau parcours (mai 2026).
 *
 * Phase 1 : flow complet cliquable, sans STT/LLM/TTS. La conversation est
 * stubbée pour vérifier l'enchaînement des écrans. Les Phases 2+ branchent
 * la création de rôle (LLM), Max contextualisé et le GM post-turn.
 *
 * L'ancien Index reste accessible sur /legacy.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useExperienceState } from "@/hooks/useExperienceState";
import type { AudioState, FilmAnswer, UserRoleProfile } from "@/types";
import { trackEvent } from "@/services/posthogService";

import WelcomeScreen from "@/components/prd4/WelcomeScreen";
import FilmQuestionScreen from "@/components/prd4/FilmQuestionScreen";
import TeaserScreen from "@/components/prd4/TeaserScreen";
import RoleCaptureScreen from "@/components/prd4/RoleCaptureScreen";
import RoleSummaryScreen from "@/components/prd4/RoleSummaryScreen";
import CharacterSelectScreen from "@/components/prd4/CharacterSelectScreen";
import CallingMaxScreen from "@/components/prd4/CallingMaxScreen";
import ConversationScreen from "@/components/prd4/ConversationScreen";
import EndSessionScreen from "@/components/prd4/EndSessionScreen";

/** Phase 1 : fabrique un profil-stub à partir du texte saisi. */
function stubRoleProfile(rawInput: string): UserRoleProfile {
  return {
    raw_input: rawInput,
    summary_for_user: `Tu te présentes comme : « ${rawInput.slice(0, 200)}${rawInput.length > 200 ? "…" : ""} ». (Phase 1 — résumé LLM branché en Phase 2.)`,
    summary_for_max: rawInput,
    relationship_to_family: "inconnu",
    age: "inconnu",
    gender: "inconnu",
    proximity_level: "inconnu",
    intent: "inconnu",
    created_by_system: true,
    created_at: new Date().toISOString(),
  };
}

const IndexPRD4 = () => {
  const {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setAudioState,
    addMessage,
    endExperience,
    reset,
  } = useExperienceState();

  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const stubTurnRef = useRef(0);

  // PostHog : phase tracking
  useEffect(() => {
    trackEvent("prd4_phase_changed", { phase: state.phase });
  }, [state.phase]);

  // ---- Welcome ---------------------------------------------------------------
  const handleStart = useCallback(() => setPhase("film_question"), [setPhase]);

  // ---- Film question --------------------------------------------------------
  const handleFilmAnswer = useCallback(
    (answer: FilmAnswer) => {
      setFilmAnswer(answer);
      setPhase(answer === "vu" ? "role_capture" : "teaser");
    },
    [setFilmAnswer, setPhase],
  );

  // ---- Teaser ---------------------------------------------------------------
  const handleTeaserContinue = useCallback(() => {
    markTeaserSeen(false);
    setPhase("role_capture");
  }, [markTeaserSeen, setPhase]);

  const handleTeaserSkip = useCallback(() => {
    markTeaserSeen(true);
    setPhase("role_capture");
  }, [markTeaserSeen, setPhase]);

  // ---- Role capture → résumé (stub Phase 1) ---------------------------------
  const handleRoleSubmit = useCallback(
    (rawInput: string) => {
      const profile = stubRoleProfile(rawInput);
      setRoleProfile(profile);
      trackEvent("prd4_role_created", { length: rawInput.length, stub: true });
      setPhase("role_summary");
    },
    [setRoleProfile, setPhase],
  );

  // ---- Role summary ---------------------------------------------------------
  const handleRoleConfirm = useCallback(() => setPhase("character_select"), [setPhase]);
  const handleRoleRestart = useCallback(() => {
    setRoleProfile(null);
    setPhase("role_capture");
  }, [setRoleProfile, setPhase]);

  // ---- Character select -----------------------------------------------------
  const handleSelectMax = useCallback(() => setPhase("calling_max"), [setPhase]);
  const handleLockedClick = useCallback(
    (id: "emma" | "ava" | "leo") => trackEvent("prd4_character_locked_clicked", { character: id }),
    [],
  );

  // ---- Calling → conversation -----------------------------------------------
  const handleAnswered = useCallback(() => {
    setPhase("conversation_max");
    // Phase 1 : Max ouvre la conversation par une ligne stub.
    const opening = "Allô ? … oui, j'écoute. Qui es-tu ?";
    setMaxSubtitle(opening);
    addMessage({ role: "max", content: opening, timestamp: Date.now() });
  }, [addMessage, setPhase]);

  // ---- Conversation (stub Phase 1) ------------------------------------------
  // Phase 2/3 branchent ici processConversationTurn + STT + TTS.
  const setAudio = useCallback((s: AudioState) => setAudioState(s), [setAudioState]);

  const handlePTTPress = useCallback(() => {
    setAudio("user_speaking");
    setUserSubtitle("(tu parles…)");
  }, [setAudio]);

  const handlePTTRelease = useCallback(() => {
    // Stub Phase 1 : on simule un tour complet en quelques secondes.
    const stubUser = "Phase 1 stub : la conversation réelle sera branchée en Phase 3.";
    setUserSubtitle(stubUser);
    addMessage({ role: "user", content: stubUser, timestamp: Date.now() });
    setAudio("max_thinking");
    setTimeout(() => {
      stubTurnRef.current += 1;
      const reply =
        stubTurnRef.current >= 3
          ? "Je dois te laisser. (Stub Phase 1 — fin auto après 3 tours.)"
          : "D'accord. Continue. (Réponse stub Phase 1.)";
      setMaxSubtitle(reply);
      addMessage({ role: "max", content: reply, timestamp: Date.now() });
      setAudio("max_speaking");
      setTimeout(() => {
        setAudio("idle");
        if (stubTurnRef.current >= 3) endExperience("stub_max_turns");
      }, 1500);
    }, 900);
  }, [addMessage, endExperience, setAudio]);

  const handleHangUp = useCallback(() => endExperience("user_hangup"), [endExperience]);

  // ---- End → questionnaire --------------------------------------------------
  const handleEndContinue = useCallback(() => setPhase("questionnaire"), [setPhase]);

  // ---- Render ---------------------------------------------------------------
  switch (state.phase) {
    case "welcome":
      return <WelcomeScreen onStart={handleStart} />;
    case "film_question":
      return <FilmQuestionScreen onAnswer={handleFilmAnswer} />;
    case "teaser":
      return <TeaserScreen onContinue={handleTeaserContinue} onSkip={handleTeaserSkip} />;
    case "role_capture":
      return <RoleCaptureScreen onSubmit={handleRoleSubmit} />;
    case "role_summary":
      return state.userRoleProfile ? (
        <RoleSummaryScreen
          profile={state.userRoleProfile}
          onConfirm={handleRoleConfirm}
          onRestart={handleRoleRestart}
        />
      ) : null;
    case "character_select":
      return (
        <CharacterSelectScreen onSelectMax={handleSelectMax} onLockedClick={handleLockedClick} />
      );
    case "calling_max":
      return <CallingMaxScreen onAnswered={handleAnswered} />;
    case "conversation_max":
      return (
        <ConversationScreen
          audioState={state.audioState}
          userSubtitle={userSubtitle}
          maxSubtitle={maxSubtitle}
          conversationLog={state.conversationLog}
          onPTTPress={handlePTTPress}
          onPTTRelease={handlePTTRelease}
          onHangUp={handleHangUp}
        />
      );
    case "end_session":
      return <EndSessionScreen onContinue={handleEndContinue} />;
    case "questionnaire":
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <div className="max-w-md space-y-4">
            <h2 className="font-serif text-2xl text-foreground">Questionnaire</h2>
            <p className="text-sm text-muted-foreground">
              Phase 5 — le nouveau questionnaire PRD4 sera branché ici.
            </p>
            <button
              onClick={() => {
                reset();
                stubTurnRef.current = 0;
                setUserSubtitle("");
                setMaxSubtitle("");
              }}
              className="text-sm text-primary underline"
            >
              Recommencer le flow
            </button>
          </div>
        </div>
      );
    case "thanks":
    default:
      return null;
  }
};

export default IndexPRD4;
