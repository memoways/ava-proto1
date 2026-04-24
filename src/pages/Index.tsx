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
import { getGameplaySettings } from "@/services/settingsService";
import type { QuestionnaireData, ConversationMessage } from "@/types";

import ABChoiceScreen from "@/components/ABChoiceScreen";
import OnboardingScreen from "@/components/OnboardingScreen";
import OnboardingAScreen from "@/components/OnboardingAScreen";
import OnboardingBScreen from "@/components/OnboardingBScreen";
import CharacterSelectScreen from "@/components/CharacterSelectScreen";
import RingingScreen from "@/components/RingingScreen";
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

/**
 * Identify the slowest pipeline step that exceeds the warning threshold.
 * Returns the step name (e.g. "max", "validator", "tts") or null if all OK.
 */
const STEP_THRESHOLDS_MS: Record<string, number> = {
  rag_ms: 1500,
  gm_pre_ms: 2500,
  max_ms: 3000,
  validator_ms: 2000,
  tts_ms: 4000,
  gm_post_ms: 3000,
};
function pickBlocker(t: Partial<Record<string, number>>): string | null {
  let worst: { step: string; ratio: number } | null = null;
  for (const [step, threshold] of Object.entries(STEP_THRESHOLDS_MS)) {
    const v = t[step];
    if (typeof v !== "number" || v <= 0) continue;
    const ratio = v / threshold;
    if (ratio >= 1 && (!worst || ratio > worst.ratio)) {
      worst = { step: step.replace("_ms", ""), ratio };
    }
  }
  return worst?.step ?? null;
}

const Index = () => {
  const { state, setPhase, setAudioState, addMessage, updateTrust, triggerVideo, endTrigger, gameOver, setVariant, setVoiceModality, setCharacter, reset } = useGameState();
  const [micActive, setMicActive] = useState(false);
  const [micEverStarted, setMicEverStarted] = useState(false);
  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [postVideoContext, setPostVideoContext] = useState<string | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Dynamic gameplay settings (read once at mount, includes admin overrides)
  const [gameplaySettings, setGameplaySettings] = useState(() => getGameplaySettings());
  useEffect(() => {
    // Re-read on mount in case admin updated values
    setGameplaySettings(getGameplaySettings());
  }, []);
  const sessionDuration = gameplaySettings.TIMEOUT_SECONDS;
  const trustThreshold = gameplaySettings.TRUST_THRESHOLD;

  const sttRef = useRef<DeepgramSTT | null>(null);
  const processUserMessageRef = useRef<(text: string) => void>(() => {});
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const micStartedRef = useRef(false);

  const timer = useTimer(sessionDuration, () => {
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current, {
        game_over_reason: "timeout",
        trust_level: state.trustLevel,
        conversation_log: conversationHistoryRef.current,
        triggers_activated: state.triggeredIds,
        duration_seconds: sessionDuration,
      }).catch(console.error);
    }
    gameOver("timeout");
  });

  const handleABChoice = useCallback(async (variant: "A" | "B") => {
    // Assign voice modality randomly (50/50)
    const modality: "micro_ouvert" | "push_to_talk" = Math.random() < 0.5 ? "micro_ouvert" : "push_to_talk";
    setVariant(variant);
    setVoiceModality(modality);

    // Fire preloads in parallel with session creation
    preloadSystemPrompt();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    ["proxy-llm", "proxy-tts", "query-rag"].forEach(fn => {
      fetch(`${supabaseUrl}/functions/v1/${fn}`, { method: "OPTIONS" }).catch(() => {});
    });

    try {
      const id = await createSession();
      sessionIdRef.current = id;
      identifyUser(id);
      trackEvent("game_started", { session_id: id, variant, voice_modality: modality });
      trackEvent("ab_choice_made", { variant });
      trackEvent("voice_modality_assigned", { modality });
      // Persist variant + modality in session
      updateSession(id, {
        variante_onboarding: variant,
        modalite_voix: modality,
        personnage_appele: "max",
      }).catch(console.error);
    } catch (e) {
      console.error("Failed to create session:", e);
    }

    // Route to the correct onboarding placeholder
    const nextPhase = variant === "A" ? "onboarding_a" : "onboarding_b";
    setPhase(nextPhase);
    trackEvent("phase_changed", { phase: nextPhase });
  }, [setPhase, setVariant, setVoiceModality]);

  const handleOnboardingComplete = useCallback(() => {
    setPhase("character_select");
    trackEvent("phase_changed", { phase: "character_select" });
  }, [setPhase]);

  const handleCharacterSelect = useCallback((character: "max" | "emma" | "leo" | "ava") => {
    setCharacter(character);
    if (sessionIdRef.current) {
      updateSession(sessionIdRef.current, { personnage_appele: character }).catch(console.error);
    }
    trackEvent("character_selected", { character });
    setPhase("ringing");
    trackEvent("phase_changed", { phase: "ringing" });
  }, [setPhase, setCharacter]);

  const handleRingingAnswer = useCallback(() => {
    setPhase("conversation");
    timer.start();
    trackEvent("phase_changed", { phase: "conversation" });
  }, [setPhase, timer]);

  const handleHangUp = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
    setMicStream(null);
    micStartedRef.current = false;
    setMicActive(false);
    const reason = "hang_up";
    trackEvent("game_over", { reason, trust_level: state.trustLevel });
    if (sessionIdRef.current) {
      endSession(sessionIdRef.current, {
        game_over_reason: reason,
        trust_level: state.trustLevel,
        conversation_log: conversationHistoryRef.current,
        triggers_activated: state.triggeredIds,
        duration_seconds: sessionDuration - timer.remaining,
      }).catch(console.error);
    }
    gameOver(reason);
  }, [gameOver, state.trustLevel, state.triggeredIds, timer.remaining]);

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
      setMicStream(stt.getStream());
    } catch (err) {
      console.error("Failed to start STT:", err);
      setMicActive(false);
      setAudioState("idle");
      setMicStream(null);
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
    setPhase("ab_choice");
    trackEvent("intro_video_completed");
    trackEvent("phase_changed", { phase: "ab_choice" });
  }, [setPhase]);

  const handleTriggerComplete = useCallback(() => {
    endTrigger();
    if (state.voiceModality !== "push_to_talk") {
      setTimeout(() => resumeMic(), 300);
    }
  }, [endTrigger, resumeMic, state.voiceModality]);

  // ---- Optimized conversation pipeline with sentence-level TTS ----
  const processUserMessage = useCallback(async (userText: string) => {
    console.log(`[processUserMessage] Called with: "${userText.slice(0, 50)}", isProcessingRef=${isProcessingRef.current}`);
    if (isProcessingRef.current || !userText.trim()) {
      console.log(`[processUserMessage] BLOCKED — isProcessing=${isProcessingRef.current}, empty=${!userText.trim()}`);
      return;
    }

    const turnPerf = perf("Total turn");
    isProcessingRef.current = true;
    setIsProcessing(true);
    setAudioState("max_thinking");
    setUserSubtitle("");
    setMaxSubtitle("");

    const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
    conversationHistoryRef.current.push(userMsg);
    addMessage(userMsg);

    const llmFirstChunkPerf = perf("LLM first chunk");

    try {
      console.log("[processUserMessage] Starting LLM call...");
      const llmPerf = perf("LLM total (Max streaming)");

      const { maxResponse, validation, timings, gameMasterPromise } = await processConversationTurn(
        userText,
        conversationHistoryRef.current.slice(0, -1),
        state.trustLevel,
        state.triggeredIds,
        sessionDuration - timer.remaining,
        undefined,
        postVideoContext || undefined,
        sessionIdRef.current || undefined
      );

      llmPerf.end();
      llmFirstChunkPerf.end();

      if (validation.regenerated) {
        console.warn("[Validator] Réponse régénérée avant TTS", validation);
      }

      setMaxSubtitle(maxResponse);
      setAudioState("max_speaking");

      const ttsStart = performance.now();
      const ttsQueue = new TTSQueue();
      const [sentences, leftover] = extractSentences(maxResponse);
      for (const sentence of sentences) {
        ttsQueue.enqueue(sentence);
      }
      if (leftover && leftover.length > 3) {
        ttsQueue.enqueue(leftover);
      }

      // Wait for TTS playback + Game Master in parallel
      const gmPerf = perf("Game Master");
      const [, gmResult] = await Promise.all([
        ttsQueue.drain(),
        gameMasterPromise.then(r => { gmPerf.end(); return r; }),
      ]);
      const tts_ms = Math.round(performance.now() - ttsStart);

      // Build full pipeline timings + identify the bottleneck
      const fullTimings = {
        ...timings,
        tts_ms,
        gm_post_ms: gmResult.gm_post_ms,
        total_ms: (timings.total_ms ?? 0) + tts_ms,
        blocker: pickBlocker({
          ...timings,
          tts_ms,
          gm_post_ms: gmResult.gm_post_ms,
        }),
      };

      // Add Max response to history (with validation + pipeline trace for admin observability)
      const maxMsg: ConversationMessage = {
        role: "max",
        content: maxResponse,
        timestamp: Date.now(),
        validation,
        pipeline: fullTimings,
      };
      conversationHistoryRef.current.push(maxMsg);
      addMessage(maxMsg);
      setPostVideoContext(null);

      const { gameMasterResponse, trigger } = gmResult;
      console.log("[Game Master]", gameMasterResponse, "[Pipeline timings]", fullTimings);

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
        trackEvent("game_over", { reason, trust_level: newTrust, duration: sessionDuration - timer.remaining });
        if (sessionIdRef.current) {
          endSession(sessionIdRef.current, {
            game_over_reason: reason,
            trust_level: newTrust,
            conversation_log: conversationHistoryRef.current,
            triggers_activated: state.triggeredIds,
            duration_seconds: sessionDuration - timer.remaining,
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
      setMaxSubtitle("Désolé, j'ai eu un problème de connexion...");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setAudioState("idle");
      setTimeout(() => setMaxSubtitle(""), 3000);
      turnPerf.end();
      if (micStartedRef.current && state.voiceModality !== "push_to_talk") {
        setTimeout(() => resumeMic(), 300);
      }
    }
  }, [setAudioState, addMessage, state.trustLevel, state.triggeredIds, state.voiceModality, timer.remaining, postVideoContext, updateTrust, gameOver, setPhase, triggerVideo, resumeMic]);

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

  // ---- Push-to-talk handlers ----
  const handlePTTPress = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!micStartedRef.current) {
      await startMicPersistent();
    } else {
      resumeMic();
    }
  }, [startMicPersistent, resumeMic]);

  const handlePTTRelease = useCallback(() => {
    if (!sttRef.current) return;
    sttRef.current.flush(); // triggers final transcript → processUserMessage
    sttRef.current.pause();
    setMicActive(false);
    setAudioState("idle");
  }, [setAudioState]);

  const handleQuestionnaire = useCallback(() => {
    setPhase("questionnaire");
  }, [setPhase]);

  const handleQuestionnaireSubmit = useCallback((data: QuestionnaireData) => {
    trackEvent("questionnaire_submitted", { session_id: sessionIdRef.current, variant: state.variant, voice_modality: state.voiceModality });
    if (sessionIdRef.current) {
      saveQuestionnaire(sessionIdRef.current, data).catch(console.error);
      syncQuestionnaireToNotion(sessionIdRef.current, data, state.trustLevel, sessionDuration - timer.remaining, state.gameOverReason, state.variant, state.voiceModality);
    }
    setPhase("thanks");
  }, [setPhase, state.trustLevel, timer.remaining, state.gameOverReason, state.variant, state.voiceModality]);

  const handleRestart = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
    setMicStream(null);
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
        duration_seconds: sessionDuration - timer.remaining,
      }).catch(console.error);
    }
    setPhase("game_over");
    gameOver("completion");
  }, [setPhase, gameOver, state.trustLevel, state.triggeredIds, timer.remaining]);

  switch (state.phase) {
    case "welcome":
      return (
        <OnboardingScreen
          onStart={() => {
            setPhase("intro_video");
            trackEvent("phase_changed", { phase: "intro_video" });
          }}
          onSkip={() => {
            setPhase("intro_video");
            trackEvent("phase_changed", { phase: "intro_video" });
          }}
        />
      );
    case "ab_choice":
      return <ABChoiceScreen onChoose={handleABChoice} />;
    case "onboarding_a":
      return <OnboardingAScreen onContinue={handleOnboardingComplete} />;
    case "onboarding_b":
      return <OnboardingBScreen onContinue={handleOnboardingComplete} />;
    case "character_select":
      return <CharacterSelectScreen onSelect={handleCharacterSelect} />;
    case "ringing":
      return (
        <RingingScreen
          characterName={state.character.charAt(0).toUpperCase() + state.character.slice(1)}
          onAnswer={handleRingingAnswer}
          onHangUp={handleHangUp}
        />
      );
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
          trustThreshold={trustThreshold}
          audioState={state.audioState}
          userSubtitle={userSubtitle}
          maxSubtitle={maxSubtitle}
          onMicToggle={handleMicToggle}
          micActive={micActive}
          micEverStarted={micEverStarted}
          elapsedSeconds={sessionDuration - timer.remaining}
          onEarlyQuestionnaire={handleQuestionnaire}
          onHangUp={handleHangUp}
          voiceModality={state.voiceModality}
          onPTTPress={handlePTTPress}
          onPTTRelease={handlePTTRelease}
          micStream={micStream}
          sessionDurationSeconds={sessionDuration}
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
                        width: `${Math.min(100, (state.trustLevel / trustThreshold) * 100)}%`,
                        background: state.trustLevel >= trustThreshold
                          ? 'hsl(var(--primary))'
                          : state.trustLevel > trustThreshold * 0.5
                            ? 'hsl(var(--trust))'
                            : 'hsl(var(--muted-foreground) / 0.4)',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {state.trustLevel}/{trustThreshold}
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
      return <QuestionnaireScreen onSubmit={handleQuestionnaireSubmit} variant={state.variant} voiceModality={state.voiceModality} />;
    case "thanks":
      return <ThanksScreen onRestart={handleRestart} />;
    default:
      return null;
  }
};

export default Index;
