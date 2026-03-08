import { useState, useCallback, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useTimer } from "@/hooks/useTimer";
import { DeepgramSTT } from "@/services/deepgramSTT";
import settings from "@/config/settings.json";
import type { QuestionnaireData } from "@/types";

import OnboardingScreen from "@/components/OnboardingScreen";
import VideoPlaceholder from "@/components/VideoPlaceholder";
import ConversationScreen from "@/components/ConversationScreen";
import GameOverScreen from "@/components/GameOverScreen";
import GateScreen from "@/components/GateScreen";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import ThanksScreen from "@/components/ThanksScreen";

const DEMO_TRIGGERS = [
  {
    id: "intro",
    title: "Cinématique d'introduction",
    type: "intro" as const,
    themes: [],
    placeholder_text: "Le monde a changé. Une pandémie a tout bouleversé. Les communications sont surveillées. Et Ava… Ava a disparu sans laisser de trace.",
    priority: 0,
    transition_style: "fade_black",
    post_video_context: null,
    duration_seconds: settings.VIDEO_PLACEHOLDER_DURATION,
  },
];

const Index = () => {
  const { state, setPhase, setAudioState, gameOver, reset } = useGameState();
  const [micActive, setMicActive] = useState(false);
  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");

  const timer = useTimer(settings.TIMEOUT_SECONDS, () => {
    gameOver("timeout");
  });

  const handleStart = useCallback(() => {
    setPhase("intro_video");
  }, [setPhase]);

  const handleIntroComplete = useCallback(() => {
    setPhase("conversation");
    timer.start();
  }, [setPhase, timer]);

  const sttRef = useRef<DeepgramSTT | null>(null);

  const handleMicToggle = useCallback(async () => {
    if (micActive) {
      // Stop STT
      sttRef.current?.stop();
      sttRef.current = null;
      setMicActive(false);
      setAudioState("idle");
      setUserSubtitle("");
    } else {
      // Start STT
      setMicActive(true);
      setAudioState("user_speaking");
      setUserSubtitle("Connexion au micro…");
      
      const stt = new DeepgramSTT((text, isFinal) => {
        setUserSubtitle(text);
        if (isFinal) {
          console.log("[STT Final]", text);
          // TODO: send to LLM agents (Max + Game Master)
        }
      });
      
      try {
        await stt.start();
        sttRef.current = stt;
      } catch (err) {
        console.error("Failed to start STT:", err);
        setMicActive(false);
        setAudioState("idle");
        setUserSubtitle("Erreur micro — vérifiez les permissions");
      }
    }
  }, [micActive, setAudioState]);

  const handleQuestionnaire = useCallback(() => {
    setPhase("questionnaire");
  }, [setPhase]);

  const handleQuestionnaireSubmit = useCallback((data: QuestionnaireData) => {
    console.log("Questionnaire submitted:", data);
    setPhase("thanks");
  }, [setPhase]);

  const handleRestart = useCallback(() => {
    reset();
    timer.reset();
    setMicActive(false);
    setUserSubtitle("");
    setMaxSubtitle("");
  }, [reset, timer]);

  const handleGateContinue = useCallback(() => {
    setPhase("game_over");
    gameOver("completion");
  }, [setPhase, gameOver]);

  switch (state.phase) {
    case "onboarding":
      return <OnboardingScreen onStart={handleStart} onSkip={handleStart} />;

    case "intro_video":
      return (
        <VideoPlaceholder
          title="Cinématique d'introduction"
          description={DEMO_TRIGGERS[0].placeholder_text}
          durationSeconds={DEMO_TRIGGERS[0].duration_seconds}
          onComplete={handleIntroComplete}
          onSkip={handleIntroComplete}
        />
      );

    case "conversation":
      return (
        <ConversationScreen
          timerFormatted={timer.formatted}
          timerWarning={timer.isWarning}
          trustLevel={state.trustLevel}
          trustThreshold={settings.TRUST_THRESHOLD}
          audioState={state.audioState}
          userSubtitle={userSubtitle}
          maxSubtitle={maxSubtitle}
          onMicToggle={handleMicToggle}
          micActive={micActive}
        />
      );

    case "video_trigger":
      return (
        <VideoPlaceholder
          title={state.currentTrigger?.title || "Vidéo"}
          description={state.currentTrigger?.placeholder_text || ""}
          durationSeconds={state.currentTrigger?.duration_seconds || 10}
          onComplete={handleIntroComplete}
          onSkip={handleIntroComplete}
        />
      );

    case "gate":
      return <GateScreen onContinue={handleGateContinue} />;

    case "game_over":
      return (
        <GameOverScreen
          reason={state.gameOverReason}
          onRestart={handleRestart}
          onQuestionnaire={handleQuestionnaire}
        />
      );

    case "questionnaire":
      return <QuestionnaireScreen onSubmit={handleQuestionnaireSubmit} />;

    case "thanks":
      return <ThanksScreen onRestart={handleRestart} />;

    default:
      return null;
  }
};

export default Index;
