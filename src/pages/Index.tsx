import { useState, useCallback, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useTimer } from "@/hooks/useTimer";
import { DeepgramSTT } from "@/services/deepgramSTT";
import { processConversationTurn } from "@/services/conversationOrchestrator";
import { TTSQueue, extractSentences } from "@/services/elevenLabsTTS";
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

/** Performance timer helper */
const perf = (label: string) => {
  const start = performance.now();
  return {
    end: () => {
      const ms = performance.now() - start;
      console.log(`[Perf] ${label}: ${ms.toFixed(0)}ms`);
      return ms;
    },
  };
};

const Index = () => {
  const { state, setPhase, setAudioState, addMessage, updateTrust, triggerVideo, endTrigger, gameOver, reset } = useGameState();
  const [micActive, setMicActive] = useState(false);
  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [postVideoContext, setPostVideoContext] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const sttRef = useRef<DeepgramSTT | null>(null);
  const processUserMessageRef = useRef<(text: string) => void>(() => {});
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const micStartedRef = useRef(false);

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

  const startMicPersistent = useCallback(async () => {
    if (sttRef.current) return;
    setMicActive(true);
    setAudioState("user_speaking");
    micStartedRef.current = true;

    const stt = new DeepgramSTT((text, isFinal) => {
      setUserSubtitle(text);
      if (isFinal && text.trim()) {
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

  const resumeMic = useCallback(() => {
    if (sttRef.current?.isActive) {
      sttRef.current.resume();
      setMicActive(true);
      setAudioState("user_speaking");
      setUserSubtitle("");
    } else {
      sttRef.current = null;
      startMicPersistent();
    }
  }, [setAudioState, startMicPersistent]);

  const handleIntroComplete = useCallback(() => {
    setPhase("conversation");
    timer.start();
  }, [setPhase, timer]);

  const handleTriggerComplete = useCallback(() => {
    endTrigger();
    setTimeout(() => resumeMic(), 300);
  }, [endTrigger, resumeMic]);

  // ---- Optimized conversation pipeline with sentence-level TTS ----
  const processUserMessage = useCallback(async (userText: string) => {
    if (isProcessing || !userText.trim()) return;

    const turnPerf = perf("Total turn");
    setIsProcessing(true);
    setAudioState("max_thinking");
    setUserSubtitle("");
    setMaxSubtitle("");

    const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
    conversationHistoryRef.current.push(userMsg);
    addMessage(userMsg);

    // Create TTS queue for sentence-level pipelining
    const ttsQueue = new TTSQueue();
    let streamedText = "";
    let sentencesSent = 0;
    let firstTTSTime: number | null = null;
    const llmFirstChunkPerf = perf("LLM first chunk");

    try {
      const llmPerf = perf("LLM total (Max streaming)");

      const { maxResponse, gameMasterPromise } = await processConversationTurn(
        userText,
        conversationHistoryRef.current.slice(0, -1),
        state.trustLevel,
        state.triggeredIds,
        settings.TIMEOUT_SECONDS - timer.remaining,
        (chunk, done) => {
          if (!done) {
            if (sentencesSent === 0 && streamedText === "") {
              llmFirstChunkPerf.end();
            }
            streamedText += chunk;
            setMaxSubtitle(streamedText);
            setAudioState("max_speaking");

            // Extract complete sentences and enqueue TTS immediately
            const [sentences, remaining] = extractSentences(streamedText);
            if (sentences.length > sentencesSent) {
              for (let i = sentencesSent; i < sentences.length; i++) {
                if (!firstTTSTime) {
                  firstTTSTime = performance.now();
                  console.log(`[Perf] First TTS enqueue: ${(firstTTSTime - (performance.now() - 10000)).toFixed(0)}ms after turn start`);
                }
                console.log(`[TTS-Pipeline] Enqueuing sentence #${i + 1}: "${sentences[i].slice(0, 50)}..."`);
                ttsQueue.enqueue(sentences[i]);
              }
              sentencesSent = sentences.length;
              // Keep the remaining fragment for next iteration
              streamedText = (sentences.length > 0) 
                ? sentences.join(" ") + (remaining ? " " + remaining : "")
                : streamedText;
            }
          }
        },
        undefined,
        postVideoContext || undefined
      );

      llmPerf.end();

      // Enqueue any remaining text that didn't end with punctuation
      const [, leftover] = extractSentences(streamedText);
      if (leftover && leftover.length > 3) {
        console.log(`[TTS-Pipeline] Enqueuing leftover: "${leftover.slice(0, 50)}..."`);
        ttsQueue.enqueue(leftover);
      }

      // Add Max response to history
      const maxMsg: ConversationMessage = { role: "max", content: maxResponse, timestamp: Date.now() };
      conversationHistoryRef.current.push(maxMsg);
      addMessage(maxMsg);
      setPostVideoContext(null);

      // Wait for TTS playback + Game Master in parallel
      const gmPerf = perf("Game Master");
      const [, gmResult] = await Promise.all([
        ttsQueue.drain(),
        gameMasterPromise.then(r => { gmPerf.end(); return r; }),
      ]);

      const { gameMasterResponse, trigger } = gmResult;
      console.log("[Game Master]", gameMasterResponse);

      const newTrust = state.trustLevel + gameMasterResponse.trust_delta;
      if (gameMasterResponse.trust_delta !== 0) {
        updateTrust(gameMasterResponse.trust_delta);
      }

      if (sessionIdRef.current) {
        updateSession(sessionIdRef.current, {
          trust_level: newTrust,
          conversation_log: conversationHistoryRef.current,
          triggers_activated: state.triggeredIds,
        }).catch(console.error);
      }

      if (gameMasterResponse.game_over) {
        const reason = gameMasterResponse.game_over_reason || "moderation";
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

      if (gameMasterResponse.gate_reached) {
        setPhase("gate");
        return;
      }

      if (trigger) {
        setPostVideoContext(trigger.post_video_context || null);
        triggerVideo(trigger);
        return;
      }

    } catch (error) {
      console.error("Error processing conversation:", error);
      ttsQueue.cancel();
      setMaxSubtitle("Désolé, j'ai eu un problème de connexion...");
    } finally {
      setIsProcessing(false);
      setAudioState("idle");
      setTimeout(() => setMaxSubtitle(""), 3000);
      turnPerf.end();
      if (micStartedRef.current) {
        setTimeout(() => resumeMic(), 300);
      }
    }
  }, [isProcessing, setAudioState, addMessage, state.trustLevel, state.triggeredIds, timer.remaining, postVideoContext, updateTrust, gameOver, setPhase, triggerVideo, resumeMic]);

  processUserMessageRef.current = processUserMessage;

  const handleMicToggle = useCallback(async () => {
    if (micActive) {
      sttRef.current?.pause();
      setMicActive(false);
      setAudioState("idle");
      setUserSubtitle("");
    } else {
      if (!micStartedRef.current) {
        startMicPersistent();
      } else {
        resumeMic();
      }
    }
  }, [micActive, setAudioState, resumeMic, startMicPersistent]);

  const handleQuestionnaire = useCallback(() => {
    setPhase("questionnaire");
  }, [setPhase]);

  const handleQuestionnaireSubmit = useCallback((data: QuestionnaireData) => {
    if (sessionIdRef.current) {
      saveQuestionnaire(sessionIdRef.current, data).catch(console.error);
      syncQuestionnaireToNotion(sessionIdRef.current, data, state.trustLevel, settings.TIMEOUT_SECONDS - timer.remaining, state.gameOverReason);
    }
    setPhase("thanks");
  }, [setPhase, state.trustLevel, timer.remaining, state.gameOverReason]);

  const handleRestart = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
    reset();
    timer.reset();
    setMicActive(false);
    setUserSubtitle("");
    setMaxSubtitle("");
    conversationHistoryRef.current = [];
    setPostVideoContext(null);
    sessionIdRef.current = null;
    micStartedRef.current = false;
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
          elapsedSeconds={settings.TIMEOUT_SECONDS - timer.remaining}
          onEarlyQuestionnaire={handleQuestionnaire}
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
