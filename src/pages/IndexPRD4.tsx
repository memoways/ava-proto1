/**
 * IndexPRD4 — Nouveau parcours (mai 2026).
 *
 * Phase 3 : Max contextualisé (résumé du rôle joueur injecté), conversation
 * réelle STT + TTS via TTSQueue, GM post-turn PRD4 en void (jamais bloquant).
 * Fin de session : durée admin OU clôture naturelle du GM après le seuil minimum.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useExperienceState } from "@/hooks/useExperienceState";
import type { AudioState, ConversationMessage, FilmAnswer } from "@/types";
import { identifyUser, trackEvent } from "@/services/posthogService";
import { summarizeRole } from "@/services/roleProfileService";
import { processPRD4Turn } from "@/services/prd4Orchestrator";
import {
  createPRD4Session,
  endPRD4Session,
  updatePRD4Conversation,
  updatePRD4Onboarding,
  updatePRD4StreamingAvatar,
} from "@/services/prd4Session";
import {
  createConfiguredSTT,
  getSTTProvider,
  loadSTTSettingsFromDB,
  prefetchGamilabSDK,
  type STTSession,
} from "@/services/stt";
import { OPENING_LINE } from "@/services/openingTTSCache";
import { unlockAudioPlayback } from "@/services/audioPlayback";
import {
  getGameplaySettings,
  getLLMSettings,
  loadGameplaySettingsFromDB,
  type GameplaySettings,
} from "@/services/settingsService";
import { withTimeout } from "@/services/asyncUtils";
import {
  buildVoiceTurnCompletedPayload,
  createVoiceTurnId,
  recordVoiceTurnCompleted,
} from "@/services/voiceTelemetry";
import { useTimer } from "@/hooks/useTimer";
import { toast } from "@/hooks/use-toast";
import LatencyOverlay from "@/components/LatencyOverlay";
import {
  useLatencyInstrumentation,
  useLatencyOverlayEnabled,
  type LatencySegmentEvent,
} from "@/hooks/useLatencyOverlay";
import {
  getConfiguredLLMServiceInfo,
  getConfiguredRAGServiceInfo,
  getConfiguredSTTServiceInfo,
  getConfiguredTTSServiceInfo,
  latencyServiceLabel,
} from "@/services/latencyServiceMetadata";
import {
  AvatarRenderError,
  createResponseOutput,
  getOutputSettings,
  getStreamingAvatarSettings,
  loadOutputSettingsFromDB,
  loadStreamingAvatarSettingsFromDB,
  LocalTTSOutput,
  type OutputSettings,
  type ResponseOutput,
  type ResponseOutputResult,
  type StreamingAvatarConnectionState,
  type StreamingAvatarSettings,
} from "@/services/streamingAvatar";

import WelcomeScreen from "@/components/prd4/WelcomeScreen";
import FilmQuestionScreen from "@/components/prd4/FilmQuestionScreen";
import TransitionScreen from "@/components/prd4/TransitionScreen";
import RoleCaptureScreen from "@/components/prd4/RoleCaptureScreen";
import RoleSummaryScreen from "@/components/prd4/RoleSummaryScreen";
import CharacterSelectScreen from "@/components/prd4/CharacterSelectScreen";
import CallingMaxScreen from "@/components/prd4/CallingMaxScreen";
import ConversationScreen from "@/components/prd4/ConversationScreen";
import EndSessionScreen from "@/components/prd4/EndSessionScreen";
import QuestionnaireScreenPRD4 from "@/components/prd4/QuestionnaireScreenPRD4";
import ThanksScreen from "@/components/ThanksScreen";
import GumletVideoPlayer, { type GumletVideoPlayerHandle } from "@/components/GumletVideoPlayer";
import { savePRD4Questionnaire, syncPRD4QuestionnaireToNotion } from "@/services/prd4Questionnaire";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { pickVideoForLabels } from "@/services/videoTriggerMatcher";
import {
  loadVideoTriggerSettingsFromDB,
  videoTriggerDefaults,
  type VideoTriggerSettings,
} from "@/services/settingsService";
import type { QuestionnairePRD4Answers, QuestionnairePRD4Data, UserPosture } from "@/types";
import { ensureGameAuth, isCurrentUserAdmin, isGameCaptchaEnabled, isGameSecurityEnabled } from "@/services/gameAuth";
import {
  getPrivacyPreferences,
  isPrivacyNoticeEnabled,
  savePrivacyPreferences,
  type PrivacyPreferences,
} from "@/services/privacyConsent";
import {
  getSessionMinimumClosureSeconds,
  normalizeSessionDurationSeconds,
  TURN_FIRST_AUDIO_DEADLINE_MS,
} from "@/config/experienceRuntime";

const TEASER_VIDEO_URL = "https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049";

const IndexPRD4 = () => {
  const {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setAudioState,
    addMessage,
    removeLastMessage,
    incrementPttError,
    endExperience,
    reset,
    setLastUserLabels,
  } = useExperienceState();

  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences | null>(() => getPrivacyPreferences());
  const initialSessionDuration = normalizeSessionDurationSeconds(getGameplaySettings().TIMEOUT_SECONDS);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(initialSessionDuration);
  const latencyOverlayEnabled = useLatencyOverlayEnabled();
  const {
    segments: latencySegments,
    currentTurn: latencyCurrentTurn,
    startTurn: startLatencyTurn,
    startSegment: startLatencySegment,
    endSegment: endLatencySegment,
    addCompletedSegment: addCompletedLatencySegment,
  } = useLatencyInstrumentation(latencyOverlayEnabled);

  // Refs pour pipeline conversation
  const sttRef = useRef<STTSession | null>(null);
  const responseOutputRef = useRef<ResponseOutput | null>(null);
  const outputSettingsRef = useRef<OutputSettings>(getOutputSettings());
  const avatarSettingsRef = useRef<StreamingAvatarSettings>(getStreamingAvatarSettings());
  const outputSettingsLoadRef = useRef<Promise<[OutputSettings, StreamingAvatarSettings]> | null>(null);
  const callPreparationRef = useRef<Promise<void> | null>(null);
  const expectedAvatarTextRef = useRef(new Map<string, string>());
  const avatarConnectStartedAtRef = useRef<number | null>(null);
  const avatarFirstFrameAtRef = useRef<number | null>(null);
  const avatarFirstSpeechAtRef = useRef<number | null>(null);
  const [streamingAvatarActive, setStreamingAvatarActive] = useState(false);
  const [streamingAvatarState, setStreamingAvatarState] =
    useState<StreamingAvatarConnectionState>("inactive");
  const sttLatencySegmentRef = useRef<string | null>(null);
  const pttFinalizingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const diagnosticTraceRequestedRef = useRef(
    new URLSearchParams(window.location.search).get("diagnostic") === "full",
  );
  const diagnosticTraceEnabledRef = useRef(false);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const isProcessingRef = useRef(false);
  const processingWatchdogRef = useRef<number | null>(null);
  const activeTurnControllerRef = useRef<AbortController | null>(null);
  const activeTurnSequenceRef = useRef(0);
  const endedRef = useRef(false);
  const userRoleRef = useRef(state.userRoleProfile);
  userRoleRef.current = state.userRoleProfile;
  const userPostureRef = useRef<UserPosture | null>(state.userPosture);
  userPostureRef.current = state.userPosture;
  const turnLatenciesRef = useRef<number[]>([]);
  const sessionDurationRef = useRef<number>(0);
  const configuredSessionDurationRef = useRef<number>(initialSessionDuration);
  const gameplaySettingsLoadRef = useRef<Promise<GameplaySettings> | null>(null);
  const triggeredVideoIdsRef = useRef<string[]>([]);
  const lastVideoTurnRef = useRef<number>(-Infinity);
  const videoTriggerSettingsRef = useRef<VideoTriggerSettings>(videoTriggerDefaults);
  const pendingPostVideoContextRef = useRef<string | null>(null);
  // Boucle GM→Max : guidance produite par le post-tour N, consommée au tour N+1.
  const pendingGmGuidanceRef = useRef<string | null>(null);
  const gmTopicsCoveredRef = useRef<string[]>([]);
  const [submittingQuestionnaire, setSubmittingQuestionnaire] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoTriggerRow | null>(null);
  const [teaserPlayerReady, setTeaserPlayerReady] = useState(false);
  // Chrono onboarding (mesure du time-to-first-Max-response)
  const onboardingStartedAtRef = useRef<number | null>(null);
  const firstMaxResponseAtRef = useRef<number | null>(null);
  const cinematicPlayerRef = useRef<GumletVideoPlayerHandle | null>(null);



  // Timer piloté par le réglage admin TIMEOUT_SECONDS, fin auto à 0.
  const handleTimeout = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("timeout_configured_duration");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const timer = useTimer(sessionDurationSeconds, handleTimeout);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // PostHog : phase tracking
  useEffect(() => {
    trackEvent("prd4_phase_changed", { phase: state.phase });
  }, [state.phase]);

  useEffect(() => {
    void loadSTTSettingsFromDB();
    const outputPromise = Promise.all([
      loadOutputSettingsFromDB(),
      loadStreamingAvatarSettingsFromDB(),
    ]);
    outputSettingsLoadRef.current = outputPromise;
    void outputPromise.then(([output, avatar]) => {
      outputSettingsRef.current = output;
      avatarSettingsRef.current = avatar;
    });
    const settingsPromise = loadGameplaySettingsFromDB();
    gameplaySettingsLoadRef.current = settingsPromise;
    void settingsPromise.then((settings) => {
      const duration = normalizeSessionDurationSeconds(settings.TIMEOUT_SECONDS);
      configuredSessionDurationRef.current = duration;
      setSessionDurationSeconds(duration);
    });
  }, []);

  // Sans CAPTCHA, démarre l'identité anonyme dès que l'information obligatoire
  // est acceptée. Le clic « Commencer » réutilise cette promesse et ne paie donc
  // pas la latence réseau. Avec CAPTCHA, l'identité attend sa preuve utilisateur.
  useEffect(() => {
    if (
      (!isPrivacyNoticeEnabled() || privacyPreferences?.voiceAndStorageAcknowledged) &&
      isGameSecurityEnabled() &&
      !isGameCaptchaEnabled()
    ) {
      void ensureGameAuth().catch(() => {
        // handleStart affichera une erreur actionnable si le second essai échoue.
      });
    }
  }, [privacyPreferences?.voiceAndStorageAcknowledged]);

  // ---- Helpers conversation -------------------------------------------------
  const cleanupAudio = useCallback(() => {
    activeTurnSequenceRef.current += 1;
    activeTurnControllerRef.current?.abort("experience-cleanup");
    activeTurnControllerRef.current = null;
    pttFinalizingRef.current = false;
    try { sttRef.current?.stop(); } catch { /* ignore */ }
    sttRef.current = null;
    try { responseOutputRef.current?.interrupt(); } catch { /* ignore */ }
    const output = responseOutputRef.current;
    responseOutputRef.current = null;
    if (output) void output.dispose();
    setStreamingAvatarActive(false);
    setStreamingAvatarState("inactive");
  }, []);

  const finalizeAndEnd = useCallback(
    async (reason: string) => {
      cleanupAudio();
      const sid = sessionIdRef.current;
      const configuredDuration = configuredSessionDurationRef.current;
      const duration = configuredDuration - (timerRef.current?.remaining ?? configuredDuration);
      sessionDurationRef.current = duration;
      if (sid) {
        await endPRD4Session(sid, reason, conversationRef.current, duration).catch((e) =>
          console.warn("[PRD4] endSession failed:", e),
        );
      }
      trackEvent("prd4_session_ended", { reason, duration_s: duration, turns: conversationRef.current.filter((m) => m.role === "user").length });
      endExperience(reason);
    },
    [cleanupAudio, endExperience],
  );


  // ---- Welcome / Film / Teaser ----------------------------------------------
  const unlockCinematicPlayback = useCallback(() => {
    // This callback runs on the initial pointer/touch gesture. It unlocks the
    // top-level audio context for the whole session and starts the preloaded
    // native cinematic player without any additional play button.
    void unlockAudioPlayback().catch(() => { /* native video activation still proceeds */ });
    cinematicPlayerRef.current?.playWithAudio();
  }, []);

  const handlePrivacyChange = useCallback((choice: Pick<PrivacyPreferences, "voiceAndStorageAcknowledged" | "analyticsAllowed">) => {
    setPrivacyPreferences(savePrivacyPreferences(choice));
  }, []);

  const handleStart = useCallback(async (captchaToken?: string): Promise<boolean> => {
    if (isPrivacyNoticeEnabled() && !privacyPreferences?.voiceAndStorageAcknowledged) return false;

    // Enter the teaser and issue playback while the click still owns browser
    // activation. Authentication can safely finish in parallel with this
    // public/preloaded cinematic; on failure we stop and return to welcome.
    unlockCinematicPlayback();
    flushSync(() => {
      setFilmAnswer("rappel");
      setPhase("teaser");
    });

    if (isGameSecurityEnabled()) {
      try {
        await withTimeout("anonymous_game_auth", ensureGameAuth(captchaToken), 5_000);
      } catch (error) {
        cinematicPlayerRef.current?.stop();
        flushSync(() => setPhase("welcome"));
        console.error("[Auth] Anonymous game session unavailable:", error);
        toast({
          title: "Connexion temporairement indisponible",
          description: "Réessaie la vérification avant de commencer l'expérience.",
          variant: "destructive",
        });
        return false;
      }
    }
    // Gamilab reste hors de la page tant que l'information obligatoire n'a pas
    // été acceptée, puis se précharge pendant le teaser pour préserver la latence.
    if (getSTTProvider() === "gamilab") {
      void prefetchGamilabSDK().catch((error) => {
        console.warn("[Gamilab] SDK prefetch failed; PTT will retry:", error);
      });
    }
    onboardingStartedAtRef.current = Date.now();
    firstMaxResponseAtRef.current = null;
    trackEvent("prd4_onboarding_started", {});
    return true;
  }, [privacyPreferences, setFilmAnswer, setPhase, unlockCinematicPlayback]);
  const handleFilmAnswer = useCallback(
    (a: FilmAnswer) => {
      setFilmAnswer(a);
      trackEvent("prd4_film_answered", { answer: a });
      if (a === "vu") {
        setPhase("character_select");
      } else {
        setPhase("teaser");
      }
    },
    [setFilmAnswer, setPhase],
  );
  const handleTeaserContinue = useCallback(() => {
    markTeaserSeen(false);
    setPhase("character_select");
  }, [markTeaserSeen, setPhase]);
  const handleTeaserSkip = useCallback(() => {
    markTeaserSeen(true);
    setPhase("character_select");
  }, [markTeaserSeen, setPhase]);

  // ---- Role capture → summarize-role (LLM) ----------------------------------
  const handleRoleSubmit = useCallback(
    async (rawInput: string) => {
      setSummarizing(true);
      try {
        const { profile, model, latency_ms } = await summarizeRole(rawInput);
        setRoleProfile(profile);
        trackEvent("prd4_role_created", { length: rawInput.length, model, latency_ms, relationship: profile.relationship_to_family });
        setPhase("role_summary");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        trackEvent("prd4_role_failed", { length: rawInput.length, error: msg.slice(0, 200) });
        toast({ title: "Impossible d'analyser ta présentation", description: "Réessaie dans un instant.", variant: "destructive" });
      } finally {
        setSummarizing(false);
      }
    },
    [setRoleProfile, setPhase],
  );

  const handleRolePTTError = useCallback(
    (err: Error) => {
      incrementPttError();
      trackEvent("prd4_ptt_error", { phase: "role_capture", message: err.message });
    },
    [incrementPttError],
  );

  const handleRoleConfirm = useCallback(() => setPhase("character_select"), [setPhase]);
  const handleRoleRestart = useCallback(() => { setRoleProfile(null); setPhase("role_capture"); }, [setRoleProfile, setPhase]);

  // ---- Character select / Calling -------------------------------------------
  const activateTTSFallback = useCallback(async (reason: string) => {
    const previous = responseOutputRef.current;
    if (previous?.mode === "tts") return previous;
    responseOutputRef.current = null;
    await previous?.dispose().catch(() => {});
    const fallback = new LocalTTSOutput();
    if (sessionIdRef.current) await fallback.prepare({ sessionId: sessionIdRef.current });
    responseOutputRef.current = fallback;
    setStreamingAvatarState("failed");
    const sid = sessionIdRef.current;
    if (sid) {
      void updatePRD4StreamingAvatar(sid, {
        streaming_avatar_fallback_reason: reason.slice(0, 500),
      });
    }
    trackEvent("prd4_streaming_avatar_fallback", {
      session_id: sid,
      provider: avatarSettingsRef.current.activeProvider,
      reason: reason.slice(0, 200),
    });
    return fallback;
  }, []);

  const renderResponseText = useCallback(async (
    text: string,
    context: {
      turnId?: string;
      turnIndex?: number;
      signal?: AbortSignal;
      onPlaybackStart?: () => void;
    } = {},
  ): Promise<ResponseOutputResult> => {
    let output = responseOutputRef.current;
    if (!output) {
      output = new LocalTTSOutput();
      if (sessionIdRef.current) await output.prepare({ sessionId: sessionIdRef.current });
      responseOutputRef.current = output;
    }
    if (output.mode === "streaming_avatar" && context.turnId) {
      expectedAvatarTextRef.current.set(context.turnId, text);
    }
    try {
      if (output.mode === "tts") setAudioState("max_speaking");
      return await output.renderText(text, {
        sessionId: sessionIdRef.current ?? undefined,
        turnId: context.turnId,
        turnIndex: context.turnIndex,
        signal: context.signal,
        onPlaybackStart: context.onPlaybackStart,
      });
    } catch (error) {
      if (context.signal?.aborted) {
        return {
          status: "cancelled",
          provider: output.provider,
          firstPlaybackStartMs: 0,
          playbackTotalMs: 0,
          generatedSegments: 0,
          playedSegments: 0,
          failedSegments: 0,
          started: false,
        };
      }
      if (output.mode === "tts") {
        const ttsError = error instanceof Error ? error : new Error(String(error));
        toast({
          title: "Voix temporairement indisponible",
          description: "La réponse de Max reste affichée. Tu peux continuer la conversation.",
          variant: "destructive",
        });
        return {
          status: "failed",
          provider: output.provider,
          firstPlaybackStartMs: 0,
          playbackTotalMs: 0,
          generatedSegments: 1,
          playedSegments: 0,
          failedSegments: 1,
          started: false,
          error: ttsError,
        };
      }
      const started = error instanceof AvatarRenderError && error.started;
      const message = error instanceof Error ? error.message : String(error);
      const fallback = await activateTTSFallback(message);
      if (!started) {
        setAudioState("max_speaking");
        return fallback.renderText(text, {
          sessionId: sessionIdRef.current ?? undefined,
          turnId: context.turnId,
          turnIndex: context.turnIndex,
          signal: context.signal,
          onPlaybackStart: context.onPlaybackStart,
        });
      }
      return {
        status: "failed",
        provider: output.provider,
        firstPlaybackStartMs: 0,
        playbackTotalMs: 0,
        generatedSegments: 1,
        playedSegments: 0,
        failedSegments: 1,
        started: true,
        error: error instanceof Error ? error : new Error(message),
      };
    } finally {
      if (context.turnId) expectedAvatarTextRef.current.delete(context.turnId);
    }
  }, [activateTTSFallback, setAudioState]);

  const prepareCall = useCallback(async () => {
    avatarConnectStartedAtRef.current = null;
    avatarFirstFrameAtRef.current = null;
    avatarFirstSpeechAtRef.current = null;
    const [outputSettings, avatarSettings] = await (
      outputSettingsLoadRef.current ??
      Promise.all([loadOutputSettingsFromDB(), loadStreamingAvatarSettingsFromDB()])
    );
    outputSettingsRef.current = outputSettings;
    avatarSettingsRef.current = avatarSettings;

    let diagnosticTraceEnabled = false;
    if (diagnosticTraceRequestedRef.current) {
      diagnosticTraceEnabled = await isCurrentUserAdmin().catch(() => false);
      if (!diagnosticTraceEnabled) console.warn("[PRD4] diagnostic request ignored: admin role required");
    }
    diagnosticTraceEnabledRef.current = diagnosticTraceEnabled;

    const sid = await createPRD4Session(
      state.userRoleProfile,
      "max",
      {
        diagnostic_trace_enabled: diagnosticTraceEnabled,
        output_mode: outputSettings.mode,
        streaming_avatar_provider:
          outputSettings.mode === "streaming_avatar" ? avatarSettings.activeProvider : null,
      },
    );
    sessionIdRef.current = sid;
    identifyUser(sid, { experience: "prd4", character: "max" });
    trackEvent("prd4_session_started", {
      session_id: sid,
      diagnostic_trace_enabled: diagnosticTraceEnabled,
      output_mode: outputSettings.mode,
      streaming_avatar_provider:
        outputSettings.mode === "streaming_avatar" ? avatarSettings.activeProvider : null,
    });
    const startedAt = onboardingStartedAtRef.current;
    const posture = userPostureRef.current;
    void updatePRD4Onboarding(sid, {
      has_seen_film: state.hasSeenFilm ?? null,
      teaser_shown: state.teaserSeen,
      user_posture_raw: posture?.raw ?? null,
      user_posture_mode: posture?.mode ?? null,
      onboarding_started_at: startedAt ? new Date(startedAt).toISOString() : null,
    });

    const output = await createResponseOutput({
      mode: outputSettings.mode,
      avatarSettings,
      callbacks: {
        onConnectionStateChange: setStreamingAvatarState,
        onStreamReady: () => {
          avatarFirstFrameAtRef.current = performance.now();
          setStreamingAvatarState("ready");
          const connectStart = avatarConnectStartedAtRef.current;
          const firstFrameMs = connectStart
            ? Math.round(avatarFirstFrameAtRef.current - connectStart)
            : null;
          void updatePRD4StreamingAvatar(sid, {
            streaming_avatar_first_frame_ms: firstFrameMs,
          });
        },
        onDisconnected: (reason) => {
          setStreamingAvatarState("disconnected");
          void activateTTSFallback(reason || "provider_disconnected");
        },
        onSpeakStart: () => {
          setStreamingAvatarState("speaking");
          setAudioState("max_speaking");
          if (avatarFirstSpeechAtRef.current === null) {
            avatarFirstSpeechAtRef.current = performance.now();
            const connectStart = avatarConnectStartedAtRef.current;
            void updatePRD4StreamingAvatar(sid, {
              streaming_avatar_first_speech_ms: connectStart
                ? Math.round(avatarFirstSpeechAtRef.current - connectStart)
                : null,
            });
          }
        },
        onSpeakEnd: () => setStreamingAvatarState("ready"),
        onTranscript: (text, turnId) => {
          const expected = turnId ? expectedAvatarTextRef.current.get(turnId) : undefined;
          if (expected !== undefined && text !== expected) {
            trackEvent("prd4_streaming_avatar_transcript_mismatch", {
              session_id: sid,
              turn_id: turnId,
              provider: avatarSettings.activeProvider,
              expected_length: expected.length,
              actual_length: text.length,
            });
          }
        },
      },
    });
    responseOutputRef.current = output;
    setStreamingAvatarActive(output.mode === "streaming_avatar");
    if (output.mode === "streaming_avatar") avatarConnectStartedAtRef.current = performance.now();
    try {
      await output.prepare({ sessionId: sid });
      // A timeout/disconnect may have installed the TTS fallback while the
      // provider was still finishing its connection in the background.
      if (responseOutputRef.current !== output) {
        await output.dispose().catch(() => {});
        return;
      }
      if (output.mode === "streaming_avatar") {
        const connectMs = avatarConnectStartedAtRef.current
          ? Math.round(performance.now() - avatarConnectStartedAtRef.current)
          : null;
        void updatePRD4StreamingAvatar(sid, {
          streaming_avatar_session_id: output.externalSessionId,
          streaming_avatar_connect_ms: connectMs,
        });
      }
    } catch (error) {
      if (diagnosticTraceEnabled) diagnosticTraceEnabledRef.current = false;
      await activateTTSFallback(error instanceof Error ? error.message : String(error));
    }
  }, [
    activateTTSFallback,
    setAudioState,
    state.hasSeenFilm,
    state.teaserSeen,
    state.userRoleProfile,
  ]);

  const handleSelectMax = useCallback(() => {
    setPhase("calling_max");
    callPreparationRef.current = prepareCall().catch((error) => {
      console.error("[PRD4] call preparation failed", error);
      throw error;
    });
  }, [prepareCall, setPhase]);
  const handleLockedClick = useCallback(
    (id: "emma" | "ava" | "leo") => trackEvent("prd4_character_locked_clicked", { character: id }),
    [],
  );

  // ---- Calling → conversation ------------------------------------------------
  const handleAnswered = useCallback(async () => {
    // La lecture démarre au montage et ne peut retarder l'ouverture de l'appel
    // de plus de 800 ms. En cas de réseau lent, le dernier réglage admin mis en
    // cache reste préférable à une interface bloquée.
    const gameplaySettings = await withTimeout(
      "gameplay_settings_before_call",
      gameplaySettingsLoadRef.current ?? loadGameplaySettingsFromDB(),
      800,
    ).catch(() => getGameplaySettings());
    const configuredDuration = normalizeSessionDurationSeconds(gameplaySettings.TIMEOUT_SECONDS);
    configuredSessionDurationRef.current = configuredDuration;
    setSessionDurationSeconds(configuredDuration);

    // The provider was started when entering `calling_max`. At the end of the
    // ringing window, give it only the configured grace period before falling
    // back to local TTS for this whole session.
    try {
      const preparation = callPreparationRef.current ?? prepareCall();
      callPreparationRef.current = preparation;
      await withTimeout(
        "streaming_avatar_after_rings",
        preparation,
        avatarSettingsRef.current.fallbackTimeoutMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[PRD4] call preparation unavailable:", error);
      if (!sessionIdRef.current) {
        toast({
          title: "Appel temporairement indisponible",
          description: "La session n’a pas pu être ouverte. Réessaie dans un instant.",
          variant: "destructive",
        });
        setPhase("calling_max");
        return;
      }
      await activateTTSFallback(message);
    }

    setPhase("conversation_max");
    endedRef.current = false;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;
    triggeredVideoIdsRef.current = [];
    lastVideoTurnRef.current = -Infinity;
    pendingPostVideoContextRef.current = null;
    pendingGmGuidanceRef.current = null;
    gmTopicsCoveredRef.current = [];
    setActiveVideo(null);

    // Recharge les règles de déclenchement vidéo (admin)
    loadVideoTriggerSettingsFromDB()
      .then((s) => { videoTriggerSettingsRef.current = s; })
      .catch(() => { videoTriggerSettingsRef.current = videoTriggerDefaults; });
    // Le réglage admin est relu au démarrage pour éviter un cache public obsolète.
    timer.reset(configuredDuration);
    timer.start();
    trackEvent("prd4_session_duration_loaded", { duration_seconds: configuredDuration });

    // Réplique d'ouverture de Max (scriptée pour amorcer)
    const opening = OPENING_LINE;
    setMaxSubtitle(opening);
    const openingMsg: ConversationMessage = { role: "max", content: opening, timestamp: Date.now() };
    conversationRef.current = [openingMsg];
    addMessage(openingMsg);
    setAudioState(
      responseOutputRef.current?.mode === "streaming_avatar"
        ? "max_thinking"
        : "max_speaking",
    );

    try {
      await renderResponseText(opening, {
        turnId: `${sessionIdRef.current ?? "local"}:opening`,
        turnIndex: 0,
      });
    } catch (err) {
      console.warn("[PRD4] opening output failed:", err);
    }

    // Marque le first_max_response et calcule la durée onboarding
    if (!firstMaxResponseAtRef.current) {
      firstMaxResponseAtRef.current = Date.now();
      const startedAt = onboardingStartedAtRef.current;
      const durationMs = startedAt ? firstMaxResponseAtRef.current - startedAt : null;
      trackEvent("prd4_first_max_response", {
        session_id: sessionIdRef.current,
        duration_ms: durationMs,
      });
      if (sessionIdRef.current) {
        void updatePRD4Onboarding(sessionIdRef.current, {
          first_max_response_at: new Date(firstMaxResponseAtRef.current).toISOString(),
          onboarding_duration_ms: durationMs,
        });
      }
    }

    setAudioState("idle");
  }, [
    activateTTSFallback,
    addMessage,
    prepareCall,
    renderResponseText,
    setAudioState,
    setPhase,
    timer,
  ]);


  // ---- Conversation : process turn ------------------------------------------
  const processTurn = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current || !userText.trim() || endedRef.current) return;
      isProcessingRef.current = true;
      activeTurnControllerRef.current?.abort("superseded-turn");
      const turnController = new AbortController();
      activeTurnControllerRef.current = turnController;
      const turnSequence = activeTurnSequenceRef.current + 1;
      activeTurnSequenceRef.current = turnSequence;
      const isCurrentTurn = () =>
        activeTurnSequenceRef.current === turnSequence &&
        activeTurnControllerRef.current === turnController &&
        !turnController.signal.aborted &&
        !endedRef.current;

      // Watchdog d'amorçage : protège l'attente RAG/LLM/TTS, mais ne doit jamais
      // imposer une durée maximale à une lecture audio qui progresse normalement.
      if (processingWatchdogRef.current) window.clearTimeout(processingWatchdogRef.current);
      processingWatchdogRef.current = window.setTimeout(() => {
        if (!isCurrentTurn()) return;
        console.warn("[PRD4] turn watchdog fired — releasing processing lock");
        turnController.abort("turn-recovery-deadline");
        try { responseOutputRef.current?.interrupt(); } catch { /* ignore */ }
        isProcessingRef.current = false;
        setAudioState("idle");
        toast({ title: "Le tour a pris trop de temps", description: "Tu peux reparler.", variant: "destructive" });
        trackEvent("prd4_turn_recovered", {
          session_id: sessionIdRef.current,
          turn_sequence: turnSequence,
          reason: "recovery_deadline",
        });
      }, TURN_FIRST_AUDIO_DEADLINE_MS);
      setAudioState("max_thinking");
      setUserSubtitle(userText);

      const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
      conversationRef.current = [...conversationRef.current, userMsg];
      addMessage(userMsg);

      const turnIndex = conversationRef.current.filter((m) => m.role === "user").length;
      const turnId = createVoiceTurnId(sessionIdRef.current, turnIndex);
      const configuredDuration = configuredSessionDurationRef.current;
      const elapsed = configuredDuration - (timerRef.current?.remaining ?? configuredDuration);
      const llmSettings = (() => { try { return getLLMSettings(); } catch { return null; } })();
      const ttsService = getConfiguredTTSServiceInfo();
      const ragService = getConfiguredRAGServiceInfo();
      const latencySegmentIds: Record<string, string | null> = {};
      const serviceLabelForLatency = (segment: string) => {
        if (segment === "RAG") return latencyServiceLabel(ragService);
        if (segment === "LLM") return latencyServiceLabel(getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL));
        if (segment === "GM") return latencyServiceLabel(getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL_GM));
        return segment;
      };
      const handleLatencySegment = latencyOverlayEnabled
        ? (event: { type: "start" | "end"; segment: "RAG" | "LLM" | "GM"; service: string; durationMs?: number }) => {
            const key = `${event.segment}:${event.service}`;
            const segment: LatencySegmentEvent = {
              segment: event.segment,
              service: serviceLabelForLatency(event.segment),
            };
            if (event.type === "start") {
              latencySegmentIds[key] = startLatencySegment(segment);
              return;
            }
            const activeId = latencySegmentIds[key];
            if (activeId) {
              endLatencySegment(activeId);
              latencySegmentIds[key] = null;
            } else if (typeof event.durationMs === "number") {
              addCompletedLatencySegment(segment, event.durationMs);
            }
          }
        : undefined;

      try {
        const postVideoContext = pendingPostVideoContextRef.current ?? undefined;
        pendingPostVideoContextRef.current = null;
        // Consommation one-shot : une guidance périmée ne doit pas survivre à son tour.
        const gmGuidance = pendingGmGuidanceRef.current;
        pendingGmGuidanceRef.current = null;
        const result = await processPRD4Turn({
          sessionId: sessionIdRef.current,
          conversationHistory: conversationRef.current.slice(0, -1),
          userMessage: userText,
          userRole: userRoleRef.current,
          userPostureRaw: userPostureRef.current?.raw ?? null,
          timeElapsedSeconds: elapsed,
          characterName: "Max",
          triggeredVideoIds: triggeredVideoIdsRef.current,
          postVideoContext,
          gmGuidance,
          gmTopicsCovered: gmTopicsCoveredRef.current,
          onLatencySegment: handleLatencySegment,
          signal: turnController.signal,
          turnId,
          diagnosticTraceEnabled: diagnosticTraceEnabledRef.current,
        });

        if (!isCurrentTurn()) return;

        const ttsStart = performance.now();
        const blocker =
          (result.timings.max_ms ?? 0) >= (result.timings.rag_ms ?? 0) ? "max_ms" : "rag_ms";
        const maxMsg: ConversationMessage = {
          role: "max",
          content: result.maxResponse,
          timestamp: Date.now(),
          pipeline: {
            rag_ms: result.timings.rag_ms,
            max_ms: result.timings.max_ms,
            total_ms: result.timings.total_ms,
            blocker,
            segmentServices: {
              rag_ms: ragService,
              max_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL),
            },
          },
        };
        conversationRef.current = [...conversationRef.current, maxMsg];
        addMessage(maxMsg);
        setMaxSubtitle(result.maxResponse);
        setAudioState(
          responseOutputRef.current?.mode === "streaming_avatar"
            ? "max_thinking"
            : "max_speaking",
        );

        // Ava owns the exact final text; the selected output only renders it.
        // Avatar providers are never allowed to generate or transform a reply.
        const outputAtStart = responseOutputRef.current;
        const outputLatencySegmentId = latencyOverlayEnabled
          ? startLatencySegment({
              segment: "TTS",
              service: outputAtStart?.mode === "streaming_avatar"
                ? `Avatar · ${outputAtStart.provider}`
                : latencyServiceLabel(ttsService),
            })
          : null;
        let outputLatencySegmentDone = false;
        const onPlaybackStart = () => {
          if (processingWatchdogRef.current) {
            window.clearTimeout(processingWatchdogRef.current);
            processingWatchdogRef.current = null;
          }
          if (outputLatencySegmentDone) return;
          outputLatencySegmentDone = true;
          endLatencySegment(outputLatencySegmentId);
        };
        const outputResult = await renderResponseText(result.maxResponse, {
          turnId,
          turnIndex,
          signal: turnController.signal,
          onPlaybackStart,
        }).finally(() => {
          if (!outputLatencySegmentDone) endLatencySegment(outputLatencySegmentId);
        });
        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }
        if (!isCurrentTurn()) return;
        const tts_ms =
          outputResult.firstPlaybackStartMs ||
          Math.round(performance.now() - ttsStart);
        if (maxMsg.pipeline) {
          maxMsg.pipeline.tts_ms = tts_ms;
          maxMsg.pipeline.tts_first_playback_ms = tts_ms;
          maxMsg.pipeline.total_ms = (maxMsg.pipeline.total_ms ?? 0) + tts_ms;
          maxMsg.pipeline.segmentServices = {
            ...(maxMsg.pipeline.segmentServices || {}),
            tts_ms: ttsService,
          };
          if (tts_ms > (maxMsg.pipeline.max_ms ?? 0) && tts_ms > (maxMsg.pipeline.rag_ms ?? 0)) {
            maxMsg.pipeline.blocker = "tts_ms";
          }
        }

        const sttTelemetry = sttRef.current?.getLastFinalTelemetry();
        if (maxMsg.pipeline && typeof sttTelemetry?.t_stt_ms === "number") {
          const sttProvider = sttTelemetry.provider || "Unknown";
          maxMsg.pipeline.stt_ms = sttTelemetry.t_stt_ms;
          maxMsg.pipeline.stt_service_ms = sttTelemetry.t_stt_ms;
          maxMsg.pipeline.segmentServices = {
            ...(maxMsg.pipeline.segmentServices || {}),
            stt_ms: {
              serviceProvider: sttProvider,
              serviceName: sttProvider.toLowerCase().replace(/\s+/g, "_"),
              model: sttTelemetry.model || "Unknown",
              mode: "realtime",
            },
          };
        }
        recordVoiceTurnCompleted(buildVoiceTurnCompletedPayload({
          session_id: sessionIdRef.current,
          turn_id: turnId,
          turn_index: turnIndex,
          character: "max",
          voice_modality: "push_to_talk",
          user_message_len: userText.length,
          max_response_len: result.maxResponse.length,
          timings: {
            t_stt_total_ms: sttTelemetry?.t_stt_ms,
            t_rag_total_ms: result.timings.rag_ms,
            t_max_llm_ms: result.timings.max_ms,
            t_tts_total_ms: tts_ms,
            t_audio_playback_total_ms: outputResult.playbackTotalMs,
            t_turn_response_ready_ms: result.timings.total_ms,
            t_turn_voice_ready_ms: (result.timings.total_ms ?? 0) + tts_ms,
          },
          models: {
            max_model: llmSettings?.LLM_MODEL,
            gm_model: llmSettings?.LLM_MODEL_GM,
          },
          rag: { matches_count: result.ragMatches },
          tts: {
            provider: outputResult.provider,
            model: outputResult.model,
            segments_count: outputResult.generatedSegments,
            segments_played: outputResult.playedSegments,
            segments_failed: outputResult.failedSegments,
          },
          stt: {
            provider: sttTelemetry?.provider,
            model: sttTelemetry?.model,
            mode: "realtime",
          },
          had_error: outputResult.status === "failed",
          error_type: outputResult.status === "failed"
            ? (outputAtStart?.mode === "streaming_avatar" ? "streaming_avatar" : "tts")
            : null,
        }));

        // Persist conversation (best effort, fire-and-forget)
        if (sessionIdRef.current) {
          void updatePRD4Conversation(sessionIdRef.current, conversationRef.current);
        }

        // ---- Label pass (parallèle à Max) : labels + trigger vidéo déterministe
        // Une seule vidéo par tour : on mémorise si quelque chose a été déclenché ici
        // pour que le post-turn (garde-fou) ne re-déclenche pas.
        let videoTriggeredThisTurn = false;
        const labelHandling = result.labelPromise.then(async (lab) => {
          if (!isCurrentTurn()) return;
          const labels = lab.labels;
          const total = (labels.themes?.length ?? 0) + (labels.topics?.length ?? 0) + (labels.intentions?.length ?? 0);

          // Attache les labels au dernier message utilisateur (state + persistance).
          if (total > 0) {
            setLastUserLabels(labels);
            const log = conversationRef.current;
            for (let i = log.length - 1; i >= 0; i--) {
              if (log[i].role === "user") {
                log[i] = { ...log[i], labels };
                break;
              }
            }
            if (sessionIdRef.current) {
              void updatePRD4Conversation(sessionIdRef.current, conversationRef.current);
            }
          }

          // Matcher déterministe (un seul thème commun suffit).
          let pickedVideoId: string | null = null;
          try {
            const settings = videoTriggerSettingsRef.current;
            const userTurnNumber = conversationRef.current.filter((m) => m.role === "user").length;
            const labelsCount = (labels.themes?.length ?? 0) + (labels.topics?.length ?? 0) + (labels.intentions?.length ?? 0);
            const gateReason = !settings.ENABLED
              ? "disabled"
              : userTurnNumber < settings.MIN_TURNS_BEFORE_FIRST
                ? "before_first"
                : (userTurnNumber - lastVideoTurnRef.current) < settings.MIN_TURNS_BETWEEN
                  ? "too_soon"
                  : (settings.MAX_PER_SESSION > 0 && triggeredVideoIdsRef.current.length >= settings.MAX_PER_SESSION)
                    ? "max_reached"
                    : labelsCount < settings.MIN_LABELS_REQUIRED
                      ? "not_enough_labels"
                      : null;
            if (gateReason) {
              trackEvent("prd4_video_gate_blocked", {
                session_id: sessionIdRef.current,
                reason: gateReason,
                user_turn: userTurnNumber,
              });
            } else {
              const videos = await getVideoTriggersCached();
              const match = pickVideoForLabels(labels, videos, triggeredVideoIdsRef.current, userText);
              if (match) {
                pickedVideoId = match.row.id;
                triggeredVideoIdsRef.current = [...triggeredVideoIdsRef.current, match.row.id];
                lastVideoTurnRef.current = userTurnNumber;
                videoTriggeredThisTurn = true;
                trackEvent("prd4_video_triggered", {
                  session_id: sessionIdRef.current,
                  video_id: match.row.id,
                  title: match.row.title,
                  source: match.source,
                  matched_term: match.matchedTerm,
                  matched_theme: match.matchedVideoTheme,
                });
                setActiveVideo(match.row);
              }
            }
          } catch (err) {
            console.warn("[PRD4] label-driven video trigger failed:", err);
          }

          trackEvent("prd4_gm_label", {
            session_id: sessionIdRef.current,
            ok: lab.ok,
            latency_ms: lab.latency_ms,
            model: lab.model,
            n_themes: labels.themes?.length ?? 0,
            n_topics: labels.topics?.length ?? 0,
            n_intentions: labels.intentions?.length ?? 0,
            trigger_video_id: pickedVideoId,
          });
        }).catch((err) => console.warn("[PRD4] label pass handling failed:", err));

        // ---- GM post-turn : engagement, end_recommended + garde-fou vidéo
        void result.postTurnPromise.then(async (ev) => {
          if (!isCurrentTurn()) return;
          // Boucle GM→Max : mémorise la guidance pour le tour suivant et cumule
          // les sujets couverts (dédupliqués) sur la session.
          pendingGmGuidanceRef.current = ev.next_turn_guidance?.trim() || null;
          if (ev.topics_covered?.length) {
            const known = new Set(gmTopicsCoveredRef.current.map((t) => t.toLowerCase()));
            for (const topic of ev.topics_covered) {
              const clean = topic?.trim();
              if (clean && !known.has(clean.toLowerCase())) {
                known.add(clean.toLowerCase());
                gmTopicsCoveredRef.current = [...gmTopicsCoveredRef.current, clean].slice(-24);
              }
            }
          }
          trackEvent("prd4_gm_post_turn", {
            session_id: sessionIdRef.current,
            turn_index: ev.turn_index,
            engagement_delta: ev.engagement_delta,
            end_recommended: ev.end_recommended,
            trigger_video_id: ev.trigger_video_id ?? null,
            latency_ms: ev.latency_ms,
            labels: ev.labels ?? null,
          });
          // Fallback labels si le label pass a échoué et que le post-turn en a quand même produit.
          if (ev.labels) {
            const total = (ev.labels.themes?.length ?? 0) + (ev.labels.topics?.length ?? 0) + (ev.labels.intentions?.length ?? 0);
            const log = conversationRef.current;
            const lastUserHasLabels = (() => {
              for (let i = log.length - 1; i >= 0; i--) {
                if (log[i].role === "user") return !!log[i].labels;
              }
              return false;
            })();
            if (total > 0 && !lastUserHasLabels) {
              setLastUserLabels(ev.labels);
              for (let i = log.length - 1; i >= 0; i--) {
                if (log[i].role === "user") {
                  log[i] = { ...log[i], labels: ev.labels };
                  break;
                }
              }
              if (sessionIdRef.current) {
                void updatePRD4Conversation(sessionIdRef.current, conversationRef.current);
              }
            }
          }
          // Garde-fou vidéo : on attend le label pass d'abord pour éviter une double sélection.
          await labelHandling;
          if (!videoTriggeredThisTurn && ev.trigger_video_id && !triggeredVideoIdsRef.current.includes(ev.trigger_video_id)) {
            const settings = videoTriggerSettingsRef.current;
            const userTurnNumber = conversationRef.current.filter((m) => m.role === "user").length;
            const blocked = !settings.ENABLED
              || userTurnNumber < settings.MIN_TURNS_BEFORE_FIRST
              || (userTurnNumber - lastVideoTurnRef.current) < settings.MIN_TURNS_BETWEEN
              || (settings.MAX_PER_SESSION > 0 && triggeredVideoIdsRef.current.length >= settings.MAX_PER_SESSION);
            if (blocked) {
              trackEvent("prd4_video_gate_blocked", {
                session_id: sessionIdRef.current,
                reason: "post_turn_fallback_gate",
                user_turn: userTurnNumber,
              });
            } else {
              try {
                const videos = await getVideoTriggersCached();
                const row = videos.find((v) => v.id === ev.trigger_video_id) || null;
                if (row?.video_url) {
                  triggeredVideoIdsRef.current = [...triggeredVideoIdsRef.current, row.id];
                  lastVideoTurnRef.current = userTurnNumber;
                  trackEvent("prd4_video_triggered", { session_id: sessionIdRef.current, video_id: row.id, title: row.title, source: "post_turn_fallback" });
                  setActiveVideo(row);
                }
              } catch (err) {
                console.warn("[PRD4] post-turn video trigger fallback failed:", err);
              }
            }
          }
          const minimumClosureSeconds = getSessionMinimumClosureSeconds(configuredSessionDurationRef.current);
          if (ev.end_recommended && elapsed >= minimumClosureSeconds && !endedRef.current) {
            endedRef.current = true;
            void finalizeAndEnd("gm_end_recommended");
          } else if (ev.end_recommended && elapsed < minimumClosureSeconds) {
            trackEvent("prd4_early_end_blocked", {
              session_id: sessionIdRef.current,
              elapsed_seconds: elapsed,
              minimum_closure_seconds: minimumClosureSeconds,
            });
          }
        });

        trackEvent("prd4_turn_completed", {
          session_id: sessionIdRef.current,
          ...result.timings,
          rag_matches: result.ragMatches,
          trace_id: result.traceId,
        });
        if (typeof result.timings?.total_ms === "number") {
          turnLatenciesRef.current.push(result.timings.total_ms);
        }

      } catch (err) {
        if (turnController.signal.aborted || activeTurnSequenceRef.current !== turnSequence) return;
        console.error("[PRD4] turn failed:", err);
        const diagnosticFailure = diagnosticTraceEnabledRef.current;
        if (diagnosticFailure) {
          // Le tour n'a pas été diffusé : retire le message optimiste afin qu'un
          // nouvel appui PTT rejoue bien le même index causal, sans doublon.
          const current = conversationRef.current;
          if (current.at(-1)?.timestamp === userMsg.timestamp && current.at(-1)?.role === "user") {
            conversationRef.current = current.slice(0, -1);
            removeLastMessage(userMsg.timestamp);
          }
          trackEvent("prd4_diagnostic_turn_blocked", {
            session_id: sessionIdRef.current,
            turn_id: turnId,
            turn_index: turnIndex,
            error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
          });
        }
        toast({
          title: diagnosticFailure ? "Trace diagnostique non enregistrée" : "Erreur dans la conversation",
          description: diagnosticFailure ? "La réponse de Max n’a pas été diffusée. Tu peux rejouer le tour après avoir vérifié la base." : "Réessaie.",
          variant: "destructive",
        });
      } finally {
        if (activeTurnSequenceRef.current === turnSequence) {
          if (processingWatchdogRef.current) {
            window.clearTimeout(processingWatchdogRef.current);
            processingWatchdogRef.current = null;
          }
          isProcessingRef.current = false;
          setAudioState("idle");
        }
      }
    },
    [
      addCompletedLatencySegment,
      addMessage,
      removeLastMessage,
      renderResponseText,
      endLatencySegment,
      finalizeAndEnd,
      latencyOverlayEnabled,
      setAudioState,
      setLastUserLabels,
      startLatencySegment,
    ],
  );

  // ---- PTT handlers : démarre/reprend STT, finalise au release -------------
  const teardownSTT = useCallback(() => {
    try { sttRef.current?.stop(); } catch { /* ignore */ }
    sttRef.current = null;
  }, []);

  const createSTT = useCallback(async (initialStream?: Promise<MediaStream>) => {
    teardownSTT();
    const stt = await createConfiguredSTT(
      (text, isFinal) => {
        setUserSubtitle(text);
        if (isFinal && text.trim()) {
          endLatencySegment(sttLatencySegmentRef.current);
          sttLatencySegmentRef.current = null;
          stt.pause();
          void processTurn(text);
        }
      },
      {
        onError: (err) => {
          console.error("[PRD4 STT]", err);
          incrementPttError();
          trackEvent("prd4_ptt_error", { phase: "conversation", message: err.message });
          setUserSubtitle("Micro indisponible — réessaie.");
          // Force reset: drop the dead STT so the next click recreates a fresh one
          teardownSTT();
          if (sttLatencySegmentRef.current) {
            endLatencySegment(sttLatencySegmentRef.current);
            sttLatencySegmentRef.current = null;
          }
          setAudioState("idle");
        },
        getTelemetryContext: () => {
          const turnIndex = conversationRef.current.filter((m) => m.role === "user").length + 1;
          return {
            session_id: sessionIdRef.current,
            turn_index: turnIndex,
            turn_id: createVoiceTurnId(sessionIdRef.current, turnIndex),
          };
        },
        initialStream,
      },
    );
    await stt.start();
    stt.setManualMode(true); // toggle-to-talk: pas de silence auto-finalize
    sttRef.current = stt;
    return stt;
  }, [endLatencySegment, incrementPttError, processTurn, setAudioState, teardownSTT]);

  const handlePTTPress = useCallback(async () => {
    if (endedRef.current) return;
    // Filet anti-blocage : si le verrou est resté coincé mais que l'état audio est
    // au repos (signe que le tour précédent a bien fini), on libère le verrou.
    if (isProcessingRef.current && state.audioState === "idle") {
      console.warn("[PRD4] PTT: stale processing lock detected — releasing.");
      if (processingWatchdogRef.current) {
        window.clearTimeout(processingWatchdogRef.current);
        processingWatchdogRef.current = null;
      }
      activeTurnControllerRef.current?.abort("stale-processing-lock");
      activeTurnControllerRef.current = null;
      activeTurnSequenceRef.current += 1;
      isProcessingRef.current = false;
    }
    if (isProcessingRef.current) return;
    if (pttFinalizingRef.current) return;
    // Le nouveau geste utilisateur invalide les analyses asynchrones du tour précédent.
    activeTurnControllerRef.current?.abort("new-user-turn");
    activeTurnControllerRef.current = null;
    activeTurnSequenceRef.current += 1;
    let initialStream: Promise<MediaStream> | undefined;
    try {
      initialStream = navigator.mediaDevices?.getUserMedia({ audio: true });
      initialStream?.catch(() => { /* handled below when createSTT awaits it */ });
      // Always start a fresh STT per turn for robustness (avoid stale WS, paused state, etc.)
      const nextTurn = conversationRef.current.filter((m) => m.role === "user").length + 1;
      if (latencyOverlayEnabled) {
        startLatencyTurn(nextTurn);
      }
      endLatencySegment(sttLatencySegmentRef.current);
      sttLatencySegmentRef.current = latencyOverlayEnabled
        ? startLatencySegment({ segment: "STT", service: latencyServiceLabel(getConfiguredSTTServiceInfo()) })
        : null;
      setAudioState("mic_starting");
      setUserSubtitle("");
      await createSTT(initialStream);
      setAudioState("user_speaking");
    } catch (err) {
      console.warn("[PRD4] PTT start failed:", err);
      void initialStream?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
      endLatencySegment(sttLatencySegmentRef.current);
      sttLatencySegmentRef.current = null;
      teardownSTT();
      incrementPttError();
      setAudioState("idle");
      toast({ title: "Micro indisponible", description: "Réessaie dans un instant.", variant: "destructive" });
    }
  }, [
    createSTT,
    endLatencySegment,
    incrementPttError,
    latencyOverlayEnabled,
    setAudioState,
    startLatencySegment,
    startLatencyTurn,
    state.audioState,
    teardownSTT,
  ]);

  const handlePTTRelease = useCallback(async () => {
    const stt = sttRef.current;
    if (!stt || pttFinalizingRef.current) {
      // Nothing recording — just normalize state
      if (!stt) setAudioState("idle");
      return;
    }
    pttFinalizingRef.current = true;
    setAudioState("user_finalizing");
    try {
      // Every provider resolves only after its audio tail and latest transcript
      // revision have been preserved. The final callback starts processTurn.
      await stt.flush();
    } finally {
      pttFinalizingRef.current = false;
      if (sttRef.current === stt) {
        endLatencySegment(sttLatencySegmentRef.current);
        sttLatencySegmentRef.current = null;
        if (!isProcessingRef.current) {
          setAudioState("idle");
          setUserSubtitle("");
          teardownSTT();
        }
      }
    }
  }, [endLatencySegment, setAudioState, teardownSTT]);

  const handleHangUp = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("user_hangup");
  }, [finalizeAndEnd]);

  // Cleanup au démontage
  useEffect(() => () => { cleanupAudio(); }, [cleanupAudio]);
  useEffect(() => {
    const closeProvider = () => {
      const output = responseOutputRef.current;
      responseOutputRef.current = null;
      if (output) void output.dispose();
    };
    window.addEventListener("pagehide", closeProvider);
    return () => window.removeEventListener("pagehide", closeProvider);
  }, []);

  // ---- End / Questionnaire --------------------------------------------------
  const handleEndContinue = useCallback(() => setPhase("questionnaire"), [setPhase]);

  const handleQuestionnaireSubmit = useCallback(
    async (answers: QuestionnairePRD4Answers) => {
      setSubmittingQuestionnaire(true);
      const latencies = turnLatenciesRef.current;
      const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
      const max = latencies.length ? Math.max(...latencies) : null;
      const onboardingDuration =
        onboardingStartedAtRef.current && firstMaxResponseAtRef.current
          ? firstMaxResponseAtRef.current - onboardingStartedAtRef.current
          : null;
      const data: QuestionnairePRD4Data = {
        version: "prd4",
        answers,
        technical: {
          session_id: sessionIdRef.current,
          submitted_at: new Date().toISOString(),
          duration_seconds: sessionDurationRef.current,
          teaser_seen: state.teaserSeen,
          teaser_skipped: state.teaserSkipped,
          role_profile: state.userRoleProfile,
          active_character: state.selectedCharacter,
          turn_count: conversationRef.current.filter((m) => m.role === "user").length,
          avg_latency_ms: avg,
          max_latency_ms: max,
          ptt_errors: state.pttErrors,
          transcript_available: conversationRef.current.length > 0,
          ava_start_variant: null,
          has_seen_film: state.hasSeenFilm,
          user_posture_raw: state.userPosture?.raw ?? null,
          user_posture_mode: state.userPosture?.mode ?? null,
          onboarding_duration_ms: onboardingDuration,
        },
      };
      try {
        if (sessionIdRef.current) {
          await savePRD4Questionnaire(sessionIdRef.current, data);
          void syncPRD4QuestionnaireToNotion(sessionIdRef.current, data);
        }
        trackEvent("prd4_questionnaire_submitted", {
          session_id: sessionIdRef.current,
          turn_count: data.technical.turn_count,
          duration_s: data.technical.duration_seconds,
          ptt_errors: data.technical.ptt_errors,
          q1_film_seen: answers.q1_film_seen,
          q9_duration_feeling: answers.q9_duration_feeling,
        });
      } catch (err) {
        console.warn("[PRD4] questionnaire submit failed:", err);
      } finally {
        setSubmittingQuestionnaire(false);
        setPhase("thanks");
      }
    },
    [
      setPhase,
      state.hasSeenFilm,
      state.pttErrors,
      state.selectedCharacter,
      state.teaserSeen,
      state.teaserSkipped,
      state.userPosture,
      state.userRoleProfile,
    ],
  );

  const handleRestart = useCallback(() => {
    cleanupAudio();
    reset();
    setUserSubtitle("");
    setMaxSubtitle("");
    sessionIdRef.current = null;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;
    triggeredVideoIdsRef.current = [];
    pendingPostVideoContextRef.current = null;
    activeTurnControllerRef.current?.abort("experience-restart");
    activeTurnControllerRef.current = null;
    activeTurnSequenceRef.current += 1;
    setActiveVideo(null);
    callPreparationRef.current = null;
    expectedAvatarTextRef.current.clear();
    endedRef.current = false;
  }, [cleanupAudio, reset]);

  const finishActiveVideo = useCallback((skipped: boolean) => {
    if (!activeVideo) return;
    pendingPostVideoContextRef.current = activeVideo.context || activeVideo.post_video_context || null;
    trackEvent("prd4_video_completed", {
      session_id: sessionIdRef.current,
      video_id: activeVideo.id,
      skipped,
    });
    setActiveVideo(null);
  }, [activeVideo]);

  // Narrative interludes keep the provider session connected but silent.
  useEffect(() => {
    if (activeVideo?.video_url) responseOutputRef.current?.interrupt();
  }, [activeVideo]);

  const attachAvatarMedia = useCallback((element: HTMLMediaElement | null) => {
    if (element) responseOutputRef.current?.attachMedia(element);
  }, []);


  // ---- Render ---------------------------------------------------------------
  let screen: ReactNode = null;
  switch (state.phase) {
    case "welcome":
      screen = (
        <WelcomeScreen
          onStart={handleStart}
          onStartIntent={unlockCinematicPlayback}
          videoReady={teaserPlayerReady}
          privacyPreferences={privacyPreferences}
          onPrivacyChange={handlePrivacyChange}
        />
      );
      break;
    case "teaser":
      break;
    case "film_question":
      screen = <FilmQuestionScreen onAnswer={handleFilmAnswer} />;
      break;
    case "transition_max":
      screen = <TransitionScreen onContinue={handleAnswered} />;
      break;
    case "role_capture":
      screen = (
        <RoleCaptureScreen
          onSubmit={handleRoleSubmit}
          onPTTError={handleRolePTTError}
          submitting={summarizing}
        />
      );
      break;
    case "role_summary":
      screen = state.userRoleProfile ? (
        <RoleSummaryScreen
          profile={state.userRoleProfile}
          onConfirm={handleRoleConfirm}
          onRestart={handleRoleRestart}
        />
      ) : null;
      break;
    case "character_select":
      screen = <CharacterSelectScreen onSelectMax={handleSelectMax} onLockedClick={handleLockedClick} />;
      break;
    case "calling_max":
      screen = <CallingMaxScreen onAnswered={handleAnswered} />;
      break;
    case "conversation_max":
      screen = (
        <>
          {!activeVideo?.video_url ? (
            <ConversationScreen
              audioState={state.audioState}
              userSubtitle={userSubtitle}
              maxSubtitle={maxSubtitle}
              conversationLog={state.conversationLog}
              sessionTimeRemaining={timer.formatted}
              onPTTPress={handlePTTPress}
              onPTTRelease={handlePTTRelease}
              onHangUp={handleHangUp}
              streamingAvatarActive={streamingAvatarActive}
              streamingAvatarState={streamingAvatarState}
              attachAvatarMedia={attachAvatarMedia}
            />
          ) : null}
          <LatencyOverlay enabled={latencyOverlayEnabled} segments={latencySegments} currentTurn={latencyCurrentTurn} />
        </>
      );
      break;
    case "end_session":
      screen = <EndSessionScreen onContinue={handleEndContinue} />;
      break;
    case "questionnaire":
      screen = (
        <QuestionnaireScreenPRD4
          teaserSeen={state.teaserSeen}
          onSubmit={handleQuestionnaireSubmit}
          onSkip={handleRestart}
          submitting={submittingQuestionnaire}
        />
      );
      break;
    case "thanks":
      screen = <ThanksScreen onRestart={handleRestart} />;
      break;
    default:
      break;
  }

  const teaserActive = state.phase === "teaser";
  const interludeActive = state.phase === "conversation_max" && Boolean(activeVideo?.video_url);
  const cinematicActive = teaserActive || interludeActive;
  const cinematicVideoUrl = interludeActive && activeVideo?.video_url
    ? activeVideo.video_url
    : TEASER_VIDEO_URL;

  return (
    <>
      {/* A single persistent native element is used for every cinematic. The
          initial "Commencer" gesture authorizes audible playback on this exact
          element; later videos only replace its HLS source. */}
      <GumletVideoPlayer
        ref={cinematicPlayerRef}
        videoUrl={cinematicVideoUrl}
        onComplete={interludeActive ? () => finishActiveVideo(false) : handleTeaserContinue}
        onSkip={interludeActive ? () => finishActiveVideo(true) : handleTeaserSkip}
        onReady={teaserActive || state.phase === "welcome" ? () => setTeaserPlayerReady(true) : undefined}
        active={cinematicActive}
        showSkip={cinematicActive}
      />
      {screen}
    </>
  );
};

export default IndexPRD4;
