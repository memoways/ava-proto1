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
  updatePRD4ExperienceState,
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
import type { TTSProviderId } from "@/services/tts/types";
import { derivePerformanceIntent, logPerformanceIntent } from "@/services/tts/performanceIntent";
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
  TURN_RESPONSE_DEADLINE_MS,
} from "@/config/experienceRuntime";
import {
  pauseConversationTraceSync,
  prewarmConversationTraceOutbox,
  resumeConversationTraceSync,
} from "@/services/conversationTraceOutbox";
import {
  getPassiveVoiceNetworkObservation,
  recordPassiveVoiceNetworkObservation,
} from "@/services/networkDiagnostics";
import {
  fetchResumablePRD4Session,
  type ResumablePRD4Session,
} from "@/services/sessionConversationMemory";
import { resolveResumeTimerWindow } from "@/services/resumeTimer";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { appendExperienceEvent, applyTopicHandoffFallback, validateDirectorDecision } from "@/services/experienceDirector";
import type { ExperienceDirectorDecisionV1, RuntimeCharacter } from "@/types";
import {
  buildSwitchRequestGuidance,
  characterDisplayName,
  detectPlayerSwitchRequest,
  hasSpokenWithCharacter,
  inferCharacterSwitchStance,
  lastHandoffUserTurn,
  parseHandoffOffer,
  sliceConversationForCharacter,
  tagSpokenWith,
  type CharacterHandoffOffer,
} from "@/services/characterConversation";

const TEASER_VIDEO_URL = "https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049";

function asTTSProviderId(value: string | null | undefined): TTSProviderId | null {
  return value === "elevenlabs" || value === "inworld" || value === "hume" || value === "gradium" || value === "cartesia" ? value : null;
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
    removeLastMessage,
    incrementPttError,
    endExperience,
    reset,
    setLastUserLabels,
    restoreConversation,
    setSelectedCharacter,
  } = useExperienceState();

  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [resumableSession, setResumableSession] = useState<ResumablePRD4Session | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
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
  const activeOutputControllerRef = useRef<AbortController | null>(null);
  const activeTurnSequenceRef = useRef(0);
  const endedRef = useRef(false);
  const userRoleRef = useRef(state.userRoleProfile);
  userRoleRef.current = state.userRoleProfile;
  const userPostureRef = useRef<UserPosture | null>(state.userPosture);
  userPostureRef.current = state.userPosture;
  const turnLatenciesRef = useRef<number[]>([]);
  const sessionDurationRef = useRef<number>(0);
  const configuredSessionDurationRef = useRef<number>(initialSessionDuration);
  const showQuestionnaireRef = useRef(getGameplaySettings().SHOW_QUESTIONNAIRE);
  const gameplaySettingsLoadRef = useRef<Promise<GameplaySettings> | null>(null);
  const triggeredVideoIdsRef = useRef<string[]>([]);
  const lastVideoTurnRef = useRef<number>(-Infinity);
  const videoTriggerSettingsRef = useRef<VideoTriggerSettings>(videoTriggerDefaults);
  const pendingPostVideoContextRef = useRef<string | null>(null);
  // Boucle GM→Max : guidance produite par le post-tour N, consommée au tour N+1.
  const pendingGmGuidanceRef = useRef<string | null>(null);
  const pendingEmotionalStateRef = useRef<string | null>(null);
  const gmTopicsCoveredRef = useRef<string[]>([]);
  const activeCharacterRef = useRef<RuntimeCharacter>("max");
  const startingCharacterRef = useRef<RuntimeCharacter>("max");
  const activeVoiceIdRef = useRef<string | null>(null);
  const activeTTSProviderIdRef = useRef<TTSProviderId | null>(null);
  const handoffCountRef = useRef(0);
  const handoffRecommendationRef = useRef<CharacterHandoffOffer | null>(null);
  const pendingPlayerSwitchRef = useRef<RuntimeCharacter | null>(null);
  const switchToCharacterRef = useRef<((target: RuntimeCharacter, source: "player" | "gm") => Promise<void>) | null>(null);
  const [handoffOffer, setHandoffOffer] = useState<CharacterHandoffOffer | null>(null);
  const [handoffCalling, setHandoffCalling] = useState(false);
  const [handoffCallingTarget, setHandoffCallingTarget] = useState<RuntimeCharacter>("emma");
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
      showQuestionnaireRef.current = settings.SHOW_QUESTIONNAIRE;
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

  useEffect(() => {
    if (isPrivacyNoticeEnabled() && !privacyPreferences?.voiceAndStorageAcknowledged) return;
    let cancelled = false;
    setResumeLoading(true);
    void fetchResumablePRD4Session()
      .then((session) => { if (!cancelled) setResumableSession(session); })
      .catch(() => { if (!cancelled) setResumableSession(null); })
      .finally(() => { if (!cancelled) setResumeLoading(false); });
    return () => { cancelled = true; };
  }, [privacyPreferences?.voiceAndStorageAcknowledged]);

  // ---- Helpers conversation -------------------------------------------------
  const cleanupAudio = useCallback(() => {
    activeTurnSequenceRef.current += 1;
    activeTurnControllerRef.current?.abort("experience-cleanup");
    activeTurnControllerRef.current = null;
    activeOutputControllerRef.current?.abort("experience-cleanup");
    activeOutputControllerRef.current = null;
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
      voiceId?: string;
      providerId?: TTSProviderId;
      characterKey?: string;
      userMessage?: string | null;
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
    const characterKey = context.characterKey ?? activeCharacterRef.current;
    const performance = derivePerformanceIntent({
      text,
      characterKey,
      previousEmotionalState: pendingEmotionalStateRef.current,
      userMessage: context.userMessage,
    });
    logPerformanceIntent(performance, { turnId: context.turnId, characterKey });
    trackEvent("prd4_tts_performance", {
      session_id: sessionIdRef.current,
      turn_id: context.turnId,
      turn_index: context.turnIndex,
      character: characterKey,
      emotion: performance.emotion,
      intensity: performance.intensity,
      source: performance.source,
    });
    const turnContext = {
      sessionId: sessionIdRef.current ?? undefined,
      turnId: context.turnId,
      turnIndex: context.turnIndex,
      signal: context.signal,
      onPlaybackStart: context.onPlaybackStart,
      voiceId: context.voiceId,
      providerId: context.providerId,
      characterKey,
      performance,
    };
    try {
      if (output.mode === "tts") setAudioState("max_speaking");
      return await output.renderText(text, turnContext);
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
        return fallback.renderText(text, turnContext);
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
      else await prewarmConversationTraceOutbox().catch((error) => {
        console.warn("[PRD4] diagnostic outbox prewarm failed", error);
      });
    }
    diagnosticTraceEnabledRef.current = diagnosticTraceEnabled;

    const startingCharacter = startingCharacterRef.current;
    const sid = await createPRD4Session(
      state.userRoleProfile,
      startingCharacter,
      {
        diagnostic_trace_enabled: diagnosticTraceEnabled,
        output_mode: outputSettings.mode,
        streaming_avatar_provider:
          outputSettings.mode === "streaming_avatar" ? avatarSettings.activeProvider : null,
        resume_expires_at: new Date(
          Date.now() + (configuredSessionDurationRef.current + 300) * 1_000,
        ).toISOString(),
        active_character: startingCharacter,
      } as never,
    );
    sessionIdRef.current = sid;
    identifyUser(sid, { experience: "prd4", character: startingCharacter });
    trackEvent("prd4_session_started", {
      session_id: sid,
      character: startingCharacter,
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
      // Le repli TTS ne doit pas désactiver la trace diagnostique : la session
      // reste traçable, seul le rendu de sortie change.
      await activateTTSFallback(error instanceof Error ? error.message : String(error));
    }
  }, [
    activateTTSFallback,
    setAudioState,
    state.hasSeenFilm,
    state.teaserSeen,
    state.userRoleProfile,
  ]);

  const handleSelectCharacter = useCallback((character: RuntimeCharacter) => {
    startingCharacterRef.current = character;
    activeCharacterRef.current = character;
    setSelectedCharacter(character);
    setPhase("calling_max");
    callPreparationRef.current = prepareCall().catch((error) => {
      console.error("[PRD4] call preparation failed", error);
      throw error;
    });
  }, [prepareCall, setPhase, setSelectedCharacter]);

  const handleResumeCall = useCallback(async () => {
    const session = resumableSession;
    if (!session) return;
    cleanupAudio();
    const now = Date.now();
    const timerWindow = resolveResumeTimerWindow(session.started_at, session.resume_expires_at, now);
    if (!timerWindow) {
      setResumableSession(null);
      return;
    }
    const { configuredDurationSeconds, elapsedSeconds, remainingSeconds } = timerWindow;
    const postureMode = session.user_posture_mode === "voice" || session.user_posture_mode === "surprise"
      ? session.user_posture_mode
      : null;
    const posture: UserPosture | null = session.user_posture_raw && postureMode
      ? { raw: session.user_posture_raw, mode: postureMode }
      : null;
    const latestGm = [...session.gm_post_turn_log]
      .sort((a, b) => (b.turn_index ?? 0) - (a.turn_index ?? 0))[0];

    sessionIdRef.current = session.id;
    diagnosticTraceEnabledRef.current = session.diagnostic_trace_enabled;
    conversationRef.current = session.conversation_log;
    configuredSessionDurationRef.current = configuredDurationSeconds;
    sessionDurationRef.current = Math.min(configuredDurationSeconds, elapsedSeconds);
    triggeredVideoIdsRef.current = session.triggers_activated;
    activeCharacterRef.current = session.active_character;
    activeVoiceIdRef.current = null;
    activeTTSProviderIdRef.current = null;
    void getCharacterRuntimeReadiness(session.active_character).then((profile) => {
        activeVoiceIdRef.current = profile?.ttsVoiceId ?? null;
        activeTTSProviderIdRef.current = asTTSProviderId(profile?.ttsProvider);
      }).catch(() => {});
    handoffCountRef.current = session.handoff_count;
    startingCharacterRef.current = session.active_character;
    setSelectedCharacter(session.active_character);
    setHandoffOffer(parseHandoffOffer(session.pending_handoff, session.active_character === "emma" ? "max" : "emma"));
    pendingGmGuidanceRef.current = latestGm?.next_turn_guidance?.trim() || null;
    pendingEmotionalStateRef.current = null;
    gmTopicsCoveredRef.current = latestGm?.topics_covered ?? [];
    endedRef.current = false;
    isProcessingRef.current = false;
    setActiveVideo(null);
    setSessionDurationSeconds(configuredDurationSeconds);
    timer.reset(remainingSeconds);
    timer.start();
    restoreConversation({
      conversationLog: session.conversation_log,
      userRoleProfile: session.player_role,
      userPosture: posture,
      hasSeenFilm: session.has_seen_film === "vu" || session.has_seen_film === "pas_vu" || session.has_seen_film === "rappel"
        ? session.has_seen_film
        : null,
      teaserSeen: session.teaser_shown === true,
      selectedCharacter: session.active_character,
    });
    const lastMax = [...session.conversation_log].reverse().find((message) => message.role !== "user");
    const lastUser = [...session.conversation_log].reverse().find((message) => message.role === "user");
    setMaxSubtitle(lastMax?.content ?? "");
    setUserSubtitle(lastUser?.content ?? "");
    setResumableSession(null);
    trackEvent("prd4_session_resumed", {
      session_id: session.id,
      remaining_seconds: remainingSeconds,
      turns: session.conversation_log.filter((message) => message.role === "user").length,
    });
  }, [cleanupAudio, restoreConversation, resumableSession, setSelectedCharacter, timer]);
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
    showQuestionnaireRef.current = gameplaySettings.SHOW_QUESTIONNAIRE;
    setSessionDurationSeconds(configuredDuration);

    // The provider was started when entering `calling_max`. Do not let the
    // shorter post-ringing grace period dispose a HeyGen session that is still
    // legitimately connecting: the provider's connection deadline remains the
    // authoritative minimum before falling back to local TTS.
    try {
      const preparation = callPreparationRef.current ?? prepareCall();
      callPreparationRef.current = preparation;
      await withTimeout(
        "streaming_avatar_after_rings",
        preparation,
        Math.max(
          avatarSettingsRef.current.fallbackTimeoutMs,
          avatarSettingsRef.current.connectionTimeoutMs,
        ),
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
    const startingCharacter = startingCharacterRef.current;
    const profile = await getCharacterRuntimeReadiness(startingCharacter).catch(() => null);
    activeCharacterRef.current = startingCharacter;
    activeVoiceIdRef.current = profile?.ttsVoiceId ?? null;
    activeTTSProviderIdRef.current = asTTSProviderId(profile?.ttsProvider);
    handoffCountRef.current = 0;
    handoffRecommendationRef.current = null;
    pendingPlayerSwitchRef.current = null;
    setHandoffOffer(null);
    setHandoffCalling(false);
    pendingGmGuidanceRef.current = null;
    pendingEmotionalStateRef.current = null;
    gmTopicsCoveredRef.current = [];
    setSelectedCharacter(startingCharacter);
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
    const opening = profile?.openingLine?.trim() || (startingCharacter === "max" ? OPENING_LINE : "Allô ?");
    setMaxSubtitle(opening);
    const openingMsg: ConversationMessage = tagSpokenWith(
      { role: startingCharacter, content: opening, timestamp: Date.now() },
      startingCharacter,
    );
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
        voiceId: activeVoiceIdRef.current ?? undefined,
        providerId: activeTTSProviderIdRef.current ?? undefined,
        characterKey: startingCharacter,
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
    setSelectedCharacter,
    timer,
  ]);


  // ---- Conversation : process turn ------------------------------------------
  const processTurn = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current || !userText.trim() || endedRef.current) return;
      isProcessingRef.current = true;
      pauseConversationTraceSync();
      activeTurnControllerRef.current?.abort("superseded-turn");
      activeOutputControllerRef.current?.abort("superseded-turn");
      activeOutputControllerRef.current = null;
      const turnController = new AbortController();
      activeTurnControllerRef.current = turnController;
      const turnSequence = activeTurnSequenceRef.current + 1;
      activeTurnSequenceRef.current = turnSequence;
      const isCurrentTurn = () =>
        activeTurnSequenceRef.current === turnSequence &&
        activeTurnControllerRef.current === turnController &&
        !turnController.signal.aborted &&
        !endedRef.current;

      // Watchdog de réponse : protège uniquement RAG/LLM. Le TTS recevra ensuite
      // sa propre fenêtre complète, indépendante des écritures diagnostiques.
      if (processingWatchdogRef.current) window.clearTimeout(processingWatchdogRef.current);
      processingWatchdogRef.current = window.setTimeout(() => {
        if (!isCurrentTurn()) return;
        console.warn("[PRD4] turn watchdog fired — releasing processing lock");
        turnController.abort("turn-recovery-deadline");
        isProcessingRef.current = false;
        setAudioState("idle");
        toast({ title: "Le tour a pris trop de temps", description: "Tu peux reparler.", variant: "destructive" });
        trackEvent("prd4_turn_recovered", {
          session_id: sessionIdRef.current,
          turn_sequence: turnSequence,
          reason: "recovery_deadline",
        });
      }, TURN_RESPONSE_DEADLINE_MS);
      setAudioState("max_thinking");
      setUserSubtitle(userText);

      const userMsg: ConversationMessage = tagSpokenWith(
        { role: "user", content: userText, timestamp: Date.now() },
        activeCharacterRef.current,
      );
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
        const requestedSwitch = detectPlayerSwitchRequest(userText, activeCharacterRef.current);
        pendingPlayerSwitchRef.current = requestedSwitch;
        const switchGuidance = requestedSwitch
          ? buildSwitchRequestGuidance(activeCharacterRef.current, requestedSwitch)
          : null;
        const gmGuidance = [pendingGmGuidanceRef.current, switchGuidance].filter(Boolean).join(" ") || null;
        pendingGmGuidanceRef.current = null;
        const handoffProposalForThisTurn = handoffRecommendationRef.current;
        const priorConversation = sliceConversationForCharacter(
          conversationRef.current.slice(0, -1),
          activeCharacterRef.current,
        );
        const result = await processPRD4Turn({
          sessionId: sessionIdRef.current,
          conversationHistory: priorConversation,
          userMessage: userText,
          userRole: userRoleRef.current,
          userPostureRaw: userPostureRef.current?.raw ?? null,
          timeElapsedSeconds: elapsed,
          characterName: activeCharacterRef.current === "emma" ? "Emma" : "Max",
          triggeredVideoIds: triggeredVideoIdsRef.current,
          postVideoContext,
          gmGuidance,
          gmTopicsCovered: gmTopicsCoveredRef.current,
          onLatencySegment: handleLatencySegment,
          signal: turnController.signal,
          turnId,
          turnIndex,
          diagnosticTraceEnabled: diagnosticTraceEnabledRef.current,
        });

        if (!isCurrentTurn()) return;

        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }

        const ttsStart = performance.now();
        const blocker =
          (result.timings.max_ms ?? 0) >= (result.timings.rag_ms ?? 0) ? "max_ms" : "rag_ms";
        const maxMsg: ConversationMessage = tagSpokenWith({
          role: activeCharacterRef.current,
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
        }, activeCharacterRef.current);
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
        const outputController = new AbortController();
        activeOutputControllerRef.current = outputController;
        const abortOutputFromTurn = () => outputController.abort(turnController.signal.reason);
        turnController.signal.addEventListener("abort", abortOutputFromTurn, { once: true });
        processingWatchdogRef.current = window.setTimeout(() => {
          if (activeOutputControllerRef.current !== outputController || outputController.signal.aborted) return;
          console.warn("[PRD4] TTS first-audio watchdog fired — cancelling output only");
          outputController.abort("tts-first-audio-deadline");
          try { responseOutputRef.current?.interrupt(); } catch { /* ignore */ }
          setAudioState("idle");
          toast({
            title: "La voix prend trop de temps",
            description: "La réponse de Max reste affichée. Tu peux continuer.",
            variant: "destructive",
          });
          trackEvent("prd4_tts_first_audio_timeout", {
            session_id: sessionIdRef.current,
            turn_id: turnId,
            turn_index: turnIndex,
            deadline_ms: TURN_FIRST_AUDIO_DEADLINE_MS,
          });
          const observed = getPassiveVoiceNetworkObservation();
          recordPassiveVoiceNetworkObservation({
            firstAudioTimeouts: observed.firstAudioTimeouts + 1,
          });
        }, TURN_FIRST_AUDIO_DEADLINE_MS);
        const onPlaybackStart = () => {
          if (processingWatchdogRef.current) {
            window.clearTimeout(processingWatchdogRef.current);
            processingWatchdogRef.current = null;
          }
          if (outputLatencySegmentDone) return;
          outputLatencySegmentDone = true;
          endLatencySegment(outputLatencySegmentId);
          recordPassiveVoiceNetworkObservation({
            firstAudioMs: Math.round(performance.now() - ttsStart),
            firstAudioTimeouts: 0,
          });
        };
        const outputResult = await renderResponseText(result.maxResponse, {
          turnId,
          turnIndex,
          signal: outputController.signal,
          onPlaybackStart,
          voiceId: activeVoiceIdRef.current ?? undefined,
          providerId: activeTTSProviderIdRef.current ?? undefined,
          characterKey: activeCharacterRef.current,
          userMessage: userText,
        }).finally(() => {
          turnController.signal.removeEventListener("abort", abortOutputFromTurn);
          if (activeOutputControllerRef.current === outputController) activeOutputControllerRef.current = null;
          if (!outputLatencySegmentDone) endLatencySegment(outputLatencySegmentId);
        });
        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }
        if (!isCurrentTurn()) return;
        resumeConversationTraceSync(true);
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
          character: activeCharacterRef.current,
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

        // A handoff recommendation first guides a natural proposal by Max. The
        // explicit choice only appears after that next spoken reply completed.
        if (handoffProposalForThisTurn && handoffProposalForThisTurn.targetCharacter !== activeCharacterRef.current) {
          handoffRecommendationRef.current = null;
          setHandoffOffer(handoffProposalForThisTurn);
          if (sessionIdRef.current) {
            void updatePRD4ExperienceState(sessionIdRef.current, { pendingHandoff: handoffProposalForThisTurn });
            void appendExperienceEvent({
              sessionId: sessionIdRef.current,
              eventKey: `handoff-proposed:${turnId}`,
              eventType: "handoff_proposed",
              turnId,
              turnIndex,
              character: activeCharacterRef.current,
              payload: { reason: handoffProposalForThisTurn.reason, targetCharacter: handoffProposalForThisTurn.targetCharacter },
            });
          }
          trackEvent("prd4_handoff_proposed", {
            session_id: sessionIdRef.current,
            turn_id: turnId,
            turn_index: turnIndex,
            target_character: handoffProposalForThisTurn.targetCharacter,
          });
        }

        if (requestedSwitch) {
          const stance = inferCharacterSwitchStance(result.maxResponse);
          if (stance === "accept") {
            pendingPlayerSwitchRef.current = null;
            void switchToCharacterRef.current?.(requestedSwitch, "player");
          } else if (stance === "object") {
            pendingPlayerSwitchRef.current = null;
          }
        }

        // ---- Directeur d'expérience unique : labels, mémoire, guidance et une
        // action recommandée, toujours après le texte et la voix du personnage.
        void result.postTurnPromise.then(async (ev) => {
          if (!isCurrentTurn()) return;
          pendingGmGuidanceRef.current = ev.next_turn_guidance?.trim() || null;
          pendingEmotionalStateRef.current = ev.memory_after?.relationship.emotionalState
            ?? pendingEmotionalStateRef.current;
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
            turn_id: turnId,
            turn_index: ev.turn_index,
            engagement_delta: ev.engagement_delta,
            end_recommended: ev.end_recommended,
            trigger_video_id: ev.trigger_video_id ?? null,
            latency_ms: ev.latency_ms,
            labels: ev.labels ?? null,
            action: ev.action ?? { type: "none" },
            orchestration_version_id: ev.orchestration_version_id ?? null,
          });
          if (ev.labels) {
            const total = (ev.labels.themes?.length ?? 0) + (ev.labels.topics?.length ?? 0) + (ev.labels.intentions?.length ?? 0);
            const log = conversationRef.current;
            if (total > 0) {
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

          const [videos, maxProfile, emmaProfile] = await Promise.all([
            getVideoTriggersCached(),
            getCharacterRuntimeReadiness("max").catch(() => null),
            getCharacterRuntimeReadiness("emma").catch(() => null),
          ]);
          if (!isCurrentTurn()) return;
          const settings = videoTriggerSettingsRef.current;
          const directorConfig = ev.orchestration_config;
          const pendingPlayerTarget = requestedSwitch && pendingPlayerSwitchRef.current === requestedSwitch
            ? requestedSwitch
            : null;
          if (pendingPlayerTarget) {
            const stance = ev.player_switch_request?.targetCharacter === pendingPlayerTarget
              ? ev.player_switch_request.stance
              : "defer";
            pendingPlayerSwitchRef.current = null;
            if (stance === "accept") {
              void switchToCharacterRef.current?.(pendingPlayerTarget, "player");
            }
          }
          const decision: ExperienceDirectorDecisionV1 = applyTopicHandoffFallback({
            labels: ev.labels ?? { themes: [], topics: [], intentions: [] },
            nextTurnGuidance: ev.next_turn_guidance || null,
            memoryDelta: ev.memory_delta ?? null,
            action: requestedSwitch ? { type: "none" } : (ev.action ?? { type: "none" }),
          }, directorConfig, activeCharacterRef.current);
          const targetCharacter = decision.action.type === "handoff" ? decision.action.targetCharacter : "emma";
          const guarded = validateDirectorDecision(decision, {
            configPublished: Boolean(ev.orchestration_version_id),
            currentCharacter: activeCharacterRef.current,
            userTurn: turnIndex,
            handoffCount: handoffCountRef.current,
            handoffPending: Boolean(handoffOffer || handoffRecommendationRef.current),
            lastHandoffTurn: lastHandoffUserTurn(conversationRef.current),
            handoffsEnabled: directorConfig?.editor.allowHandoffs ?? true,
            minimumHandoffTurn: directorConfig?.minimumHandoffTurn ?? 4,
            maximumHandoffsPerSession: directorConfig?.maximumHandoffsPerSession ?? 8,
            minimumTurnsBetweenHandoffs: directorConfig?.minimumTurnsBetweenHandoffs ?? 2,
            targetReady: (targetCharacter === "emma" ? emmaProfile : maxProfile)?.enabled !== false,
            playedVideoIds: triggeredVideoIdsRef.current,
            availableVideoIds: videos.filter((video) => Boolean(video.video_url)).map((video) => video.id),
            lastVideoTurn: Number.isFinite(lastVideoTurnRef.current) ? lastVideoTurnRef.current : null,
            minimumVideoTurn: settings.ENABLED ? settings.MIN_TURNS_BEFORE_FIRST : Number.MAX_SAFE_INTEGER,
            minimumTurnsBetweenVideos: settings.MIN_TURNS_BETWEEN,
            maximumVideosPerSession: settings.MAX_PER_SESSION,
            cinematicsEnabled: directorConfig?.editor.allowCinematics ?? true,
            resultIsCurrent: isCurrentTurn(),
          });
          const sid = sessionIdRef.current;
          if (!guarded.accepted && guarded.recommendedAction.type !== "none") {
            trackEvent(`prd4_${guarded.recommendedAction.type}_blocked`, { session_id: sid, turn_id: turnId, reason: guarded.blockedReason });
            if (sid) void appendExperienceEvent({
              sessionId: sid,
              eventKey: `director-blocked:${turnId}:${guarded.recommendedAction.type}`,
              eventType: guarded.recommendedAction.type === "handoff" ? "handoff_blocked" : "cinematic_blocked",
              turnId,
              turnIndex,
              character: activeCharacterRef.current,
              orchestrationVersionId: ev.orchestration_version_id,
              payload: { blockedReason: guarded.blockedReason, action: guarded.recommendedAction },
            });
          }

          if (guarded.action.type === "handoff") {
            handoffRecommendationRef.current = {
              reason: guarded.action.reason,
              proposalGuidance: guarded.action.proposalGuidance,
              targetCharacter: guarded.action.targetCharacter,
            };
            pendingGmGuidanceRef.current = guarded.action.proposalGuidance;
            trackEvent("prd4_handoff_recommended", { session_id: sid, turn_id: turnId, turn_index: turnIndex });
          } else if (guarded.action.type === "cinematic") {
            const cinematic = guarded.action;
            const video = videos.find((candidate) => candidate.id === cinematic.videoId && candidate.video_url) ?? null;
            if (video) {
              triggeredVideoIdsRef.current = [...triggeredVideoIdsRef.current, video.id];
              lastVideoTurnRef.current = turnIndex;
              trackEvent("prd4_video_recommended", { session_id: sid, turn_id: turnId, video_id: video.id, confidence: cinematic.confidence });
              trackEvent("prd4_video_triggered", { session_id: sid, turn_id: turnId, video_id: video.id, title: video.title, source: "experience_director" });
              setActiveVideo(video);
              if (sid) void appendExperienceEvent({
                sessionId: sid,
                eventKey: `cinematic-played:${turnId}`,
                eventType: "cinematic_played",
                turnId,
                turnIndex,
                character: activeCharacterRef.current,
                orchestrationVersionId: ev.orchestration_version_id,
                payload: { videoId: video.id, reason: cinematic.reason, confidence: cinematic.confidence },
              });
            }
          } else if (guarded.action.type === "end") {
            const minimumClosureSeconds = getSessionMinimumClosureSeconds(configuredSessionDurationRef.current);
            if (elapsed >= minimumClosureSeconds && !endedRef.current) {
              endedRef.current = true;
              void finalizeAndEnd("gm_end_recommended");
            } else if (elapsed < minimumClosureSeconds) {
              trackEvent("prd4_early_end_blocked", { session_id: sid, elapsed_seconds: elapsed, minimum_closure_seconds: minimumClosureSeconds });
            }
          }
        }).catch((directorError) => console.warn("[PRD4] director result ignored:", directorError));

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
          resumeConversationTraceSync(true);
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
      handoffOffer,
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
    recordPassiveVoiceNetworkObservation({
      sttConnected: true,
      lastSttConnectedAt: Date.now(),
    });
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
      activeOutputControllerRef.current?.abort("stale-processing-lock");
      activeOutputControllerRef.current = null;
      activeTurnSequenceRef.current += 1;
      isProcessingRef.current = false;
    }
    if (isProcessingRef.current) return;
    if (pttFinalizingRef.current) return;
    pauseConversationTraceSync();
    // Le nouveau geste utilisateur invalide les analyses asynchrones du tour précédent.
    activeTurnControllerRef.current?.abort("new-user-turn");
    activeTurnControllerRef.current = null;
    activeOutputControllerRef.current?.abort("new-user-turn");
    activeOutputControllerRef.current = null;
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
      resumeConversationTraceSync(true);
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

  const switchToCharacter = useCallback(async (target: RuntimeCharacter, source: "player" | "gm") => {
    if (handoffCalling || activeCharacterRef.current === target) return;
    const from = activeCharacterRef.current;
    setHandoffCallingTarget(target);
    setHandoffCalling(true);
    const sid = sessionIdRef.current;
    const targetName = characterDisplayName(target);
    trackEvent("prd4_handoff_accepted", { session_id: sid, target_character: target, source });
    if (sid) void appendExperienceEvent({
      sessionId: sid,
      eventKey: `handoff-accepted:${from}-${target}`,
      eventType: "handoff_accepted",
      character: from,
      payload: { reason: source, targetCharacter: target },
    });
    try {
      const profile = await getCharacterRuntimeReadiness(target).catch(() => null);
      if (profile?.enabled === false) {
        throw new Error(`${targetName} n’est pas activée dans Orchestration.`);
      }
      if (target === "emma") await activateTTSFallback("emma_handoff_tts_v1");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
      const firstContact = !hasSpokenWithCharacter(conversationRef.current, target);
      activeCharacterRef.current = target;
      activeVoiceIdRef.current = profile?.ttsVoiceId ?? null;
      activeTTSProviderIdRef.current = asTTSProviderId(profile?.ttsProvider);
      handoffCountRef.current += 1;
      setSelectedCharacter(target);
      setHandoffOffer(null);
      if (sid) await updatePRD4ExperienceState(sid, {
        activeCharacter: target,
        pendingHandoff: null,
        handoffCount: handoffCountRef.current,
      });
      if (firstContact) {
        const openingLine = profile?.openingLine?.trim() || (target === "max" ? OPENING_LINE : "Allô ?");
        const opening = tagSpokenWith({ role: target, content: openingLine, timestamp: Date.now() }, target);
        conversationRef.current = [...conversationRef.current, opening];
        addMessage(opening);
        setMaxSubtitle(openingLine);
        setAudioState("max_speaking");
        setHandoffCalling(false);
        await renderResponseText(openingLine, {
          turnId: `${sid ?? "local"}:${target}-opening`,
          turnIndex: conversationRef.current.filter((message) => message.role === "user").length,
          voiceId: profile?.ttsVoiceId ?? undefined,
          providerId: asTTSProviderId(profile?.ttsProvider) ?? undefined,
          characterKey: target,
        });
      } else {
        setHandoffCalling(false);
      }
      setAudioState("idle");
      if (sid) {
        void updatePRD4Conversation(sid, conversationRef.current);
        void appendExperienceEvent({
          sessionId: sid,
          eventKey: `handoff-executed:${from}-${target}`,
          eventType: "handoff_executed",
          character: target,
          payload: { timerPreserved: true, sessionPreserved: true, firstContact, source },
        });
      }
      trackEvent("prd4_handoff_executed", { session_id: sid, target_character: target, first_contact: firstContact, source });
    } catch (error) {
      setHandoffCalling(false);
      toast({
        title: `${targetName} n’est pas disponible`,
        description: error instanceof Error ? error.message : `Restez avec ${characterDisplayName(from)}.`,
        variant: "destructive",
      });
      if (sid) void appendExperienceEvent({
        sessionId: sid,
        eventKey: `handoff-blocked-on-accept:${from}-${target}`,
        eventType: "handoff_blocked",
        character: from,
        payload: { blockedReason: error instanceof Error ? error.message : String(error) },
      });
    }
  }, [activateTTSFallback, addMessage, handoffCalling, renderResponseText, setAudioState, setSelectedCharacter]);

  switchToCharacterRef.current = switchToCharacter;

  const handleRejectHandoff = useCallback(() => {
    const offer = handoffOffer;
    if (!offer) return;
    setHandoffOffer(null);
    const sid = sessionIdRef.current;
    if (sid) {
      void updatePRD4ExperienceState(sid, { pendingHandoff: null, handoffCount: handoffCountRef.current });
      void appendExperienceEvent({
        sessionId: sid,
        eventKey: `handoff-refused:${activeCharacterRef.current}-${offer.targetCharacter}`,
        eventType: "handoff_refused",
        character: activeCharacterRef.current,
        payload: { reason: offer.reason, targetCharacter: offer.targetCharacter },
      });
    }
    trackEvent("prd4_handoff_refused", { session_id: sid, target_character: offer.targetCharacter });
  }, [handoffOffer]);

  const handleAcceptHandoff = useCallback(async () => {
    const offer = handoffOffer;
    if (!offer) return;
    await switchToCharacter(offer.targetCharacter, "gm");
  }, [handoffOffer, switchToCharacter]);

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
  const handleEndContinue = useCallback(
    () => setPhase(showQuestionnaireRef.current ? "questionnaire" : "thanks"),
    [setPhase],
  );

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
    pendingGmGuidanceRef.current = null;
    pendingEmotionalStateRef.current = null;
    activeCharacterRef.current = "max";
    activeVoiceIdRef.current = null;
    activeTTSProviderIdRef.current = null;
    handoffCountRef.current = 0;
    handoffRecommendationRef.current = null;
    pendingPlayerSwitchRef.current = null;
    startingCharacterRef.current = "max";
    setHandoffOffer(null);
    setHandoffCalling(false);
    activeTurnControllerRef.current?.abort("experience-restart");
    activeTurnControllerRef.current = null;
    activeOutputControllerRef.current?.abort("experience-restart");
    activeOutputControllerRef.current = null;
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
    if (sessionIdRef.current) void appendExperienceEvent({
      sessionId: sessionIdRef.current,
      eventKey: `cinematic-${skipped ? "skipped" : "completed"}:${activeVideo.id}`,
      eventType: skipped ? "cinematic_skipped" : "cinematic_completed",
      character: activeCharacterRef.current,
      payload: { videoId: activeVideo.id, skipped },
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
          resumeAvailable={Boolean(resumableSession)}
          resumeLoading={resumeLoading}
          onResume={handleResumeCall}
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
      screen = <CharacterSelectScreen onSelect={handleSelectCharacter} onLockedClick={handleLockedClick} />;
      break;
    case "calling_max":
      screen = <CallingMaxScreen character={startingCharacterRef.current} onAnswered={handleAnswered} />;
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
              activeCharacter={state.selectedCharacter === "emma" ? "emma" : "max"}
              handoffOffer={handoffOffer}
              handoffCalling={handoffCalling}
              handoffCallingTarget={handoffCallingTarget}
              onAcceptHandoff={() => void handleAcceptHandoff()}
              onRejectHandoff={handleRejectHandoff}
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
