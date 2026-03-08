import { useState, useCallback, useRef, useEffect } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useTimer } from "@/hooks/useTimer";
import { DeepgramSTT } from "@/services/deepgramSTT";
import { processConversationTurn } from "@/services/conversationOrchestrator";
import { TTSQueue, extractSentences } from "@/services/elevenLabsTTS";
import { createSession, updateSession, endSession, saveQuestionnaire, syncQuestionnaireToNotion } from "@/services/sessionService";
import { preloadSystemPrompt } from "@/agents/maxAgent";
import { trackEvent, identifyUser } from "@/services/posthogService";
import settings from "@/config/settings.json";
import type { QuestionnaireData, ConversationMessage } from "@/types";

import OnboardingScreen from "@/components/OnboardingScreen";
import VideoPlaceholder from "@/components/VideoPlaceholder";
import GumletVideoPlayer from "@/components/GumletVideoPlayer";
import ConversationScreen from "@/components/ConversationScreen";
import GameOverScreen from "@/components/GameOverScreen";
import GateScreen from "@/components/GateScreen";
import QuestionnaireScreen from "@/components/QuestionnaireScreen";
import ThanksScreen from "@/components/ThanksScreen";

const INTRO_VIDEO_URL = "https://gumlet.tv/watch/67a281cac82041cdc3714c0c/";

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
  video_url: INTRO_VIDEO_URL,
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
  const [micEverStarted, setMicEverStarted] = useState(false);
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
    // Fire preloads in parallel with session creation
    preloadSystemPrompt();
    // Warm up edge functions (fire-and-forget OPTIONS preflight)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    ["proxy-llm", "proxy-tts", "query-rag"].forEach(fn => {
      fetch(`${supabaseUrl}/functions/v1/${fn}`, { method: "OPTIONS" }).catch(() => {});
    });

    try {
      const id = await createSession();
      sessionIdRef.current = id;
      identifyUser(id);
      trackEvent("game_started", { session_id: id });
    } catch (e) {
      console.error("Failed to create session:", e);
    }
    setPhase("intro_video");
    trackEvent("phase_changed", { phase: "intro_video" });
  }, [setPhase]);

  const startMicPersistent = useCallback(async () => {
    if (sttRef.current) return;
    setMicActive(true);
    setMicEverStarted(true);
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
    trackEvent("intro_video_completed");
    trackEvent("phase_changed", { phase: "conversation" });
  }, [setPhase, timer]);

  const handleTriggerComplete = useCallback(() => {
    endTrigger();
    setTimeout(() => resumeMic(), 300);
  }, [endTrigger, resumeMic]);

  // ---- Optimized conversation pipeline with sentence-level TTS ----
  const processUserMessage = useCallback(async (userText: string) => {
    console.log(`[processUserMessage] Called with: "${userText.slice(0, 50)}", isProcessing=${isProcessing}`);
    if (isProcessing || !userText.trim()) {
      console.log(`[processUserMessage] BLOCKED — isProcessing=${isProcessing}, empty=${!userText.trim()}`);
      return;
    }

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
      console.log("[processUserMessage] Starting LLM call...");
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
        postVideoContext || undefined,
        sessionIdRef.current || undefined
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
        trackEvent("game_over", { reason, trust_level: newTrust, duration: settings.TIMEOUT_SECONDS - timer.remaining });
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
        trackEvent("video_trigger_activated", { trigger_id: trigger.id, trigger_title: trigger.title });
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
    trackEvent("questionnaire_submitted", { session_id: sessionIdRef.current });
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
    setMicEverStarted(false);
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
        <GumletVideoPlayer
          videoUrl={INTRO_TRIGGER.video_url}
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
          micEverStarted={micEverStarted}
          elapsedSeconds={settings.TIMEOUT_SECONDS - timer.remaining}
          onEarlyQuestionnaire={handleQuestionnaire}
        />
      );
    case "video_trigger": {
      const triggerVideoUrl = state.currentTrigger?.video_url;
      if (triggerVideoUrl) {
        return (
          <GumletVideoPlayer
            videoUrl={triggerVideoUrl}
            onComplete={handleTriggerComplete}
            onSkip={handleTriggerComplete}
          >
            {/* HUD overlay on trigger videos — no mic */}
            <div className="absolute top-5 left-5 z-20">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/20 bg-black/30 backdrop-blur-sm">
                <span className={`font-mono text-sm tabular-nums ${timer.isWarning ? "text-timer-warning" : "text-muted-foreground/70"}`}>
                  {timer.formatted}
                </span>
                <div className="w-px h-5 bg-border/20" />
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-border/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, (state.trustLevel / settings.TRUST_THRESHOLD) * 100)}%`,
                        background: state.trustLevel >= settings.TRUST_THRESHOLD
                          ? 'hsl(var(--primary))'
                          : state.trustLevel > settings.TRUST_THRESHOLD * 0.5
                            ? 'hsl(var(--trust))'
                            : 'hsl(var(--muted-foreground) / 0.4)',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {state.trustLevel}/{settings.TRUST_THRESHOLD}
                  </span>
                </div>
              </div>
            </div>
          </GumletVideoPlayer>
        );
      }
      // Fallback to placeholder if no video_url
      return (
        <VideoPlaceholder
          title={state.currentTrigger?.title || "Vidéo"}
          description={state.currentTrigger?.placeholder_text || ""}
          durationSeconds={state.currentTrigger?.duration_seconds || 10}
          onComplete={handleTriggerComplete}
          onSkip={handleTriggerComplete}
        />
      );
    }
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
