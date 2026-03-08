import { useState, useCallback, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useTimer } from "@/hooks/useTimer";
import { DeepgramSTT } from "@/services/deepgramSTT";
import { processConversationTurn } from "@/services/conversationOrchestrator";
import { generateSpeech, playAudioBlob } from "@/services/elevenLabsTTS";
import { createSession, updateSession, endSession, saveQuestionnaire, syncQuestionnaireToNotion } from "@/services/sessionService";
import settings from "@/config/settings.json";
import type { QuestionnaireData, ConversationMessage } from "@/types";

import OnboardingScreen from "@/components/OnboardingScreen";
import VideoPlaceholder from "@/components/VideoPlaceholder";
import ConversationScreen from "@/components/ConversationScreen";
import GameOverScreen from "@/components/GameOverScreen";
import GateScreen from "@/components/GateScreen";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import ThanksScreen from "@/components/ThanksScreen";

const INTRO_TRIGGER = {
  id: "intro",
  title: "Cinématique d'introduction",
  type: "intro" as const,
  themes: [],
  placeholder_text: "Le monde a changé. Une pandémie a tout bouleversé. Les communications sont surveillées. Et Ava… Ava a disparu sans laisser de trace.",
  priority: 0,
  transition_style: "fade_black",
  post_video_context: null,
  duration_seconds: settings.VIDEO_PLACEHOLDER_DURATION,
};

const Index = () => {
  const { state, setPhase, setAudioState, addMessage, updateTrust, triggerVideo, endTrigger, gameOver, reset } = useGameState();
  const [micActive, setMicActive] = useState(false);
  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [postVideoContext, setPostVideoContext] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const restartMicRef = useRef<() => void>(() => {});

  const sttRef = useRef<DeepgramSTT | null>(null);
  const processUserMessageRef = useRef<(text: string) => void>(() => {});
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);

  const timer = useTimer(settings.TIMEOUT_SECONDS, () => {
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current, {
        game_over_reason: "timeout",
        trust_level: state.trustLevel,
        conversation_log: conversationHistoryRef.current,
        triggers_activated: state.triggeredIds,
        duration_seconds: settings.TIMEOUT_SECONDS,
      }).catch(console.error);
    }
    gameOver("timeout");
  });

  const handleStart = useCallback(async () => {
    try {
      const id = await createSession();
      sessionIdRef.current = id;
    } catch (e) {
      console.error("Failed to create session:", e);
    }
    setPhase("intro_video");
  }, [setPhase]);

  // Start persistent mic connection (stays open the whole conversation)
  const startMicPersistent = useCallback(async () => {
    if (sttRef.current) return; // Already running
    setMicActive(true);
    setAudioState("user_speaking");

    const stt = new DeepgramSTT((text, isFinal) => {
      setUserSubtitle(text);
      if (isFinal && text.trim()) {
        // Pause mic while processing, but don't close
        stt.pause();
        processUserMessageRef.current(text);
      }
    });

    try {
      await stt.start();
      sttRef.current = stt;
    } catch (err) {
      console.error("Failed to start STT:", err);
      setMicActive(false);
      setAudioState("idle");
    }
  }, [setAudioState]);

  // Resume mic after Max finishes (no need to reconnect)
  const resumeMic = useCallback(() => {
    if (sttRef.current?.isActive) {
      sttRef.current.resume();
      setMicActive(true);
      setAudioState("user_speaking");
      setUserSubtitle("");
    } else {
      // Connection lost, restart
      sttRef.current = null;
      startMicPersistent();
    }
  }, [setAudioState, startMicPersistent]);

  // Keep restartMicRef in sync
  restartMicRef.current = () => {
    setTimeout(() => resumeMic(), 500);
  };

  const handleIntroComplete = useCallback(() => {
    setPhase("conversation");
    timer.start();
    // Start persistent mic when conversation begins
    setTimeout(() => startMicPersistent(), 500);
  }, [setPhase, timer, startMicPersistent]);

  const handleTriggerComplete = useCallback(() => {
    endTrigger();
    // Resume mic after video trigger
    setTimeout(() => resumeMic(), 500);
  }, [endTrigger, resumeMic]);

  // Process user message through LLM agents
  const processUserMessage = useCallback(async (userText: string) => {
    if (isProcessing || !userText.trim()) return;

    setIsProcessing(true);
    setAudioState("max_thinking");
    setUserSubtitle("");

    // Add user message to history
    const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
    conversationHistoryRef.current.push(userMsg);
    addMessage(userMsg);

    try {
      // Process conversation turn (Max + Game Master)
      const result = await processConversationTurn(
        userText,
        conversationHistoryRef.current.slice(0, -1), // History without current message
        state.trustLevel,
        state.triggeredIds,
        settings.TIMEOUT_SECONDS - timer.remaining,
        (chunk, done) => {
          if (!done) {
            setMaxSubtitle((prev) => prev + chunk);
            setAudioState("max_speaking");
          }
        },
        undefined, // RAG context (TODO: integrate later)
        postVideoContext || undefined
      );

      // Add Max response to history
      const maxMsg: ConversationMessage = { role: "max", content: result.maxResponse, timestamp: Date.now() };
      conversationHistoryRef.current.push(maxMsg);
      addMessage(maxMsg);

      // Update trust
      const newTrust = state.trustLevel + result.gameMasterResponse.trust_delta;
      if (result.gameMasterResponse.trust_delta !== 0) {
        updateTrust(result.gameMasterResponse.trust_delta);
      }

      console.log("[Game Master]", result.gameMasterResponse);

      // Persist session state
      if (sessionIdRef.current) {
        updateSession(sessionIdRef.current, {
          trust_level: newTrust,
          conversation_log: conversationHistoryRef.current,
          triggers_activated: state.triggeredIds,
        }).catch(console.error);
      }
      setPostVideoContext(null);

      // Play Max's response with TTS
      if (result.maxResponse.trim()) {
        setAudioState("max_speaking");
        try {
          const audioBlob = await generateSpeech(result.maxResponse);
          await playAudioBlob(audioBlob);
        } catch (ttsError) {
          console.error("TTS error:", ttsError);
          // Continue even if TTS fails - subtitles are shown
        }
      }

      // Handle game over
      if (result.gameMasterResponse.game_over) {
        const reason = result.gameMasterResponse.game_over_reason || "moderation";
        if (sessionIdRef.current) {
          endSession(sessionIdRef.current, {
            game_over_reason: reason,
            trust_level: newTrust,
            conversation_log: conversationHistoryRef.current,
            triggers_activated: state.triggeredIds,
            duration_seconds: settings.TIMEOUT_SECONDS - timer.remaining,
          }).catch(console.error);
        }
        gameOver(reason);
        return;
      }

      // Handle gate reached
      if (result.gameMasterResponse.gate_reached) {
        setPhase("gate");
        return;
      }

      // Handle video trigger (wait a moment then trigger)
      if (result.trigger) {
        setTimeout(() => {
          setPostVideoContext(result.trigger?.post_video_context || null);
          triggerVideo(result.trigger!);
        }, 1500); // Wait for Max to finish speaking
      }

    } catch (error) {
      console.error("Error processing conversation:", error);
      setMaxSubtitle("Désolé, j'ai eu un problème de connexion...");
    } finally {
      setIsProcessing(false);
      setAudioState("idle");
      // Clear Max subtitle after a delay
      setTimeout(() => setMaxSubtitle(""), 3000);
      // Auto-restart mic for continuous conversation
      restartMicRef.current();
    }
  }, [isProcessing, setAudioState, addMessage, state.trustLevel, state.triggeredIds, timer.remaining, postVideoContext, updateTrust, gameOver, setPhase, triggerVideo]);

  // Keep ref in sync
  processUserMessageRef.current = processUserMessage;

  const handleMicToggle = useCallback(async () => {
    if (micActive) {
      // Pause STT (keep connection alive)
      sttRef.current?.pause();
      setMicActive(false);
      setAudioState("idle");
      setUserSubtitle("");
    } else {
      // Resume or start
      resumeMic();
    }
  }, [micActive, setAudioState, resumeMic]);

  const handleQuestionnaire = useCallback(() => {
    setPhase("questionnaire");
  }, [setPhase]);

  const handleQuestionnaireSubmit = useCallback((data: QuestionnaireData) => {
    console.log("Questionnaire submitted:", data);
    if (sessionIdRef.current) {
      saveQuestionnaire(sessionIdRef.current, data).catch(console.error);
      // Sync to Notion
      syncQuestionnaireToNotion(sessionIdRef.current, data, state.trustLevel, settings.TIMEOUT_SECONDS - timer.remaining, state.gameOverReason);
    }
    setPhase("thanks");
  }, [setPhase, state.trustLevel, timer.remaining, state.gameOverReason]);

  const handleRestart = useCallback(() => {
    reset();
    timer.reset();
    setMicActive(false);
    setUserSubtitle("");
    setMaxSubtitle("");
    conversationHistoryRef.current = [];
    setPostVideoContext(null);
    sessionIdRef.current = null;
  }, [reset, timer]);

  const handleGateContinue = useCallback(() => {
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current, {
        game_over_reason: "completion",
        trust_level: state.trustLevel,
        conversation_log: conversationHistoryRef.current,
        triggers_activated: state.triggeredIds,
        duration_seconds: settings.TIMEOUT_SECONDS - timer.remaining,
      }).catch(console.error);
    }
    setPhase("game_over");
    gameOver("completion");
  }, [setPhase, gameOver, state.trustLevel, state.triggeredIds, timer.remaining]);

  switch (state.phase) {
    case "onboarding":
      return <OnboardingScreen onStart={handleStart} onSkip={handleStart} />;

    case "intro_video":
      return (
        <VideoPlaceholder
          title="Cinématique d'introduction"
          description={INTRO_TRIGGER.placeholder_text}
          durationSeconds={INTRO_TRIGGER.duration_seconds}
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
          onComplete={handleTriggerComplete}
          onSkip={handleTriggerComplete}
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
