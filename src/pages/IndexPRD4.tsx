import { createVoiceTurnV2, handleVoiceInputError, type ServiceObservation, type VoiceObserver } from "@/services/voiceTurnTelemetryV2";
import { renderWithVideoLatency, splitOutputLatency } from "@/services/streamingAvatar/latency";
import type { VideoLatencyObservation } from "@/services/streamingAvatar/types";
import { getRuntimeContext } from "@/services/environmentContext";
/**
 * IndexPRD4 — Nouveau parcours (mai 2026).
 *
 * Phase 3 : Max contextualisé (résumé du rôle joueur injecté), conversation
 * réelle STT + TTS via TTSQueue, GM post-turn PRD4 en void (jamais bloquant).
 * Fin de session : durée admin OU clôture naturelle du GM après le seuil minimum.
 */
import { createLocalSpeechDetector } from "@/services/localSpeechDetection";
import { generateSpeech } from "@/services/tts";
import { playAudioBlobRobust } from "@/services/audioPlayback";
import { GM_CODE_VERSION } from "@/agents/gameMasterPRD4";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useExperienceState } from "@/hooks/useExperienceState";
import type { AudioState, ConversationMessage, FilmAnswer } from "@/types";
import { identifyUser, trackEvent } from "@/services/posthogService";
import { prepareStreamedVoiceTurn } from "@/services/streamedVoiceTurn";
import { persistDeliveryReceipt } from "@/services/sessionConversationMemory";
import { getActiveProviderId } from "@/services/tts/providerSettings";
import type { ResponseDeliveryReceipt } from "@/services/responseDelivery";
import { processPRD4Turn, streamPRD4Turn } from "@/services/prd4Orchestrator";
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
  recordVoiceTurnV2,
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
  latestPostTurnForCharacter,
  type ResumablePRD4Session,
} from "@/services/sessionConversationMemory";
import { resolveResumeTimerWindow } from "@/services/resumeTimer";
import { getCharacterRuntimeReadiness, type CharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import {
  guardCharacterResponse,
  responseClaimsForeignIdentity,
  toCharacterExecutionContext,
  type CharacterExecutionContext,
} from "@/services/characterIdentityGuard";
import { appendExperienceEvent, applyTopicHandoffFallback, validateDirectorDecision } from "@/services/experienceDirector";
import type { ExperienceDirectorDecisionV1, RuntimeCharacter } from "@/types";
import { createAcousticInterruptionController, recognizedWordsChanged, withoutRejectedPrefix, endOfSpeechDelayMs, normalizeHandsFreeSettings, shouldBargeIn, type HandsFreeVoiceSettings } from "@/services/handsFreeVoice";
import { createMicRecoveryPolicy, isMicSilentlyDead, MIC_WATCHDOG_STRIKES } from "@/services/handsFreeRecovery";
import {
  buildSwitchRequestGuidance,
  characterDisplayName,
  detectPlayerSwitchRequest,
  hasSpokenWithCharacter,
  inferSpokenWith,
  hasCharacterHandoffConsent,
  lastHandoffUserTurn,
  parseGmApprovedHandoffOffer,
  sliceConversationForCharacter,
  tagSpokenWith,
  type CharacterHandoffOffer,
} from "@/services/characterConversation";


const TEASER_VIDEO_URL = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6acc8341689a80cf2e4a427d/main.m3u8";

function asTTSProviderId(value: string | null | undefined): TTSProviderId | null {
  return value === "elevenlabs" || value === "inworld" || value === "hume" || value === "gradium" || value === "cartesia" ? value : null;
}

const IndexPRD4 = () => {
  const {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
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
  // Mains libres : micro ouvert en continu, fin de parole sur silence, interruption.
  const handsFreeSettingsRef = useRef<HandsFreeVoiceSettings>(normalizeHandsFreeSettings(getGameplaySettings().VOICE_HANDS_FREE));
  const incrementalOutputEnabledRef = useRef(getGameplaySettings().VOICE_INCREMENTAL_OUTPUT === true);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(handsFreeSettingsRef.current.enabled);
  const [handsFreeListening, setHandsFreeListening] = useState(false);
  const handsFreeListeningRef = useRef(false);
  const handsFreeTimerRef = useRef<number | null>(null);
  const handsFreeFinalizingRef = useRef(false);
  const handsFreeBlockedRef = useRef(false);
  const handsFreeTranscriptRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const lastCharacterTextRef = useRef("");
  const streamedVoiceRef = useRef<ReturnType<typeof prepareStreamedVoiceTurn> | null>(null);
  const acousticRef = useRef<ReturnType<typeof createAcousticInterruptionController> | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof createLocalSpeechDetector>>>(null);
  const acousticVoiceRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const discardedPrefixRef = useRef("");
  const confirmedTextRef = useRef("");
  const activeVoiceTelemetryRef = useRef<ReturnType<typeof createVoiceTurnV2> | null>(null);
  const [voiceOnly, setVoiceOnly] = useState(false);
  const rescueRef = useRef(new Map<RuntimeCharacter, Blob>());
  const rescuePendingRef = useRef(new Set<RuntimeCharacter>());
  const voiceOnlyRef = useRef(voiceOnly); voiceOnlyRef.current = voiceOnly;
  const preloadRescueRef = useRef<(character: RuntimeCharacter, voiceId?: string, providerId?: TTSProviderId) => void>(() => {});
  const handsFreeNeedsRearmRef = useRef(false);
  const rearmHandsFreeRef = useRef<() => Promise<void>>(async () => {});
  // Reprise automatique du micro : la conversation reste intacte, seul le flux STT est rouvert.
  const micRecoveryRef = useRef(createMicRecoveryPolicy());
  const micRecoveryTimerRef = useRef<number | null>(null);
  const handsFreeStartingRef = useRef(false);
  const micGaveUpRef = useRef(false);
  const scheduleMicRecoveryRef = useRef<(reason: string) => boolean>(() => false);
  const rescueLifetimeRef = useRef(new AbortController());
  preloadRescueRef.current = (character, voiceId, providerId) => {
    if (!voiceOnlyRef.current || endedRef.current || rescueRef.current.has(character) || rescuePendingRef.current.has(character)) return;
    if (rescueLifetimeRef.current.signal.aborted) rescueLifetimeRef.current = new AbortController();
    const lifetime = rescueLifetimeRef.current;
    rescuePendingRef.current.add(character);
    void generateSpeech("La connexion a coupé. Tu peux réessayer.", { characterKey: character, voiceId, providerId, signal: lifetime.signal })
      .then(blob => { if (!lifetime.signal.aborted) rescueRef.current.set(character, blob); }).catch(() => {})
      .finally(() => rescuePendingRef.current.delete(character));
  };

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
  const turnInputReadyAtRef = useRef<number | null>(null);
  const inputTelemetryRef = useRef<ReturnType<typeof createVoiceTurnV2> | null>(null);
  const turnLatencyOriginRef = useRef<"ptt_finalized" | "transcript_final">("transcript_final");
  const selectedEncounterFrameRef = useRef<string | null>(null);
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
  const promptVersionsRef = useRef<Record<string, string>>({});
  const hasSeenFilmRef = useRef(state.hasSeenFilm);
  hasSeenFilmRef.current = state.hasSeenFilm;
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
  const activeCharacterContextRef = useRef<CharacterExecutionContext | null>(null);
  const startingCharacterRef = useRef<RuntimeCharacter>("max");
  const activeVoiceIdRef = useRef<string | null>(null);
  const activeTTSProviderIdRef = useRef<TTSProviderId | null>(null);
  const handoffCountRef = useRef(0);
  const handoffRecommendationRef = useRef<CharacterHandoffOffer | null>(null);
  const [handoffOffer, setHandoffOffer] = useState<CharacterHandoffOffer | null>(null);
  const handoffOfferRef = useRef<CharacterHandoffOffer | null>(null);
  const acceptedHandoffRef = useRef<CharacterHandoffOffer | null>(null);
  const setCurrentHandoffOffer = useCallback((offer: CharacterHandoffOffer | null) => {
    handoffOfferRef.current = offer;
    setHandoffOffer(offer);
  }, []);
  const [handoffCalling, setHandoffCalling] = useState(false);
  const [handoffCallingTarget, setHandoffCallingTarget] = useState<RuntimeCharacter>("emma");
  const handoffCallingRef = useRef(false);
  const approvedCallingTargetRef = useRef<RuntimeCharacter | null>(null);
  const handoffAttemptIdRef = useRef<string | null>(null);
  const [approvedCallingTarget, setApprovedCallingTarget] = useState<RuntimeCharacter | null>(null);
  const [submittingQuestionnaire, setSubmittingQuestionnaire] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoTriggerRow | null>(null);
  const [teaserPlayerReady, setTeaserPlayerReady] = useState(false);
  const [activePortraitUrl, setActivePortraitUrl] = useState<string | null>(null);
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
    approvedCallingTargetRef.current = null;
    acceptedHandoffRef.current = null;
    handoffAttemptIdRef.current = null;
    setApprovedCallingTarget(null);
    handoffCallingRef.current = false;
    setHandoffCalling(false);
    detectorRef.current?.stop(); detectorRef.current = null;
    acousticRef.current?.reset(); acousticVoiceRef.current = false;
    streamedVoiceRef.current = null; rescueLifetimeRef.current.abort(); rescueRef.current.clear(); handsFreeNeedsRearmRef.current = false;
    activeTurnSequenceRef.current += 1;
    activeTurnControllerRef.current?.abort("experience-cleanup");
    activeTurnControllerRef.current = null;
    activeOutputControllerRef.current?.abort("experience-cleanup");
    activeOutputControllerRef.current = null;
    pttFinalizingRef.current = false;
    handsFreeFinalizingRef.current = false;
    if (handsFreeTimerRef.current) window.clearTimeout(handsFreeTimerRef.current);
    handsFreeTimerRef.current = null;
    handsFreeListeningRef.current = false;
    setHandsFreeListening(false);
    const stt = sttRef.current;
    sttRef.current = null;
    try { stt?.stop(); } catch { /* ignore */ }
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
  }, [privacyPreferences, setPhase, unlockCinematicPlayback]);

  // Legacy briefing files/storage are retained but never used by this flow.
  const introductionReviewRef = useRef(false);
  const handleIntroductionReview = useCallback(() => {
    introductionReviewRef.current = true;
    trackEvent("prd4_introduction_reviewed", {});
    unlockCinematicPlayback();
    setPhase("teaser");
  }, [setPhase, unlockCinematicPlayback]);

  const handleFilmAnswer = useCallback(
    (a: FilmAnswer) => {
      setFilmAnswer(a);
      trackEvent("prd4_film_answered", { answer: a });
      setPhase("character_select");
    },
    [setFilmAnswer, setPhase],
  );
  const handleTeaserContinue = useCallback(() => {
    if (!introductionReviewRef.current) markTeaserSeen(false);
    setPhase(introductionReviewRef.current ? "character_select" : "film_question");
    introductionReviewRef.current = false;
  }, [setPhase, markTeaserSeen]);
  const handleTeaserSkip = useCallback(() => {
    if (!introductionReviewRef.current) markTeaserSeen(true);
    setPhase(introductionReviewRef.current ? "character_select" : "film_question");
    introductionReviewRef.current = false;
  }, [setPhase, markTeaserSeen]);

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
      attemptId?: string;
      onVoiceObservation?: VoiceObserver;
      onServiceObserved?: (value: ServiceObservation) => void;
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
    const intent = derivePerformanceIntent({
      text,
      characterKey,
      previousEmotionalState: pendingEmotionalStateRef.current,
      userMessage: context.userMessage,
    });
    logPerformanceIntent(intent, { turnId: context.turnId, characterKey });
    trackEvent("prd4_tts_performance", {
      session_id: sessionIdRef.current,
      turn_id: context.turnId,
      turn_index: context.turnIndex,
      character: characterKey,
      emotion: intent.emotion,
      intensity: intent.intensity,
      source: intent.source,
    });
    const turnContext = {
      sessionId: sessionIdRef.current ?? undefined,
      turnId: context.turnId,
      turnIndex: context.turnIndex,
      attemptId: context.attemptId,
      onVoiceObservation: context.onVoiceObservation,
      onServiceObserved: context.onServiceObserved,
      signal: context.signal,
      onPlaybackStart: context.onPlaybackStart,
      voiceId: context.voiceId,
      providerId: context.providerId,
      characterKey,
      performance: intent,
    };
    let videoLatency: VideoLatencyObservation | undefined;
    try {
      if (output.mode === "tts") setAudioState("max_speaking");
      const result = output.mode === "streaming_avatar"
        ? await renderWithVideoLatency(output, text, turnContext, value => { videoLatency = value; })
        : await output.renderText(text, turnContext);
      return videoLatency ? { ...result, videoLatency } : result;
    } catch (error) {
      if (context.signal?.aborted) {
        return {
          status: "cancelled",
          provider: output.provider,
          videoLatency,
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
          description: "La réponse du personnage reste affichée. Tu peux continuer la conversation.",
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
        const result = await fallback.renderText(text, turnContext);
        return { ...result, videoLatency: videoLatency ? { ...videoLatency, fallbackUsed: true } : undefined };
      }
      return {
        status: "failed",
        provider: output.provider,
        videoLatency,
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
    rescueLifetimeRef.current = new AbortController();
    const pinnedGameplay = getGameplaySettings();
    incrementalOutputEnabledRef.current = pinnedGameplay.VOICE_INCREMENTAL_OUTPUT === true;
    handsFreeSettingsRef.current = normalizeHandsFreeSettings(pinnedGameplay.VOICE_HANDS_FREE);
    setHandsFreeEnabled(handsFreeSettingsRef.current.enabled);
    setVoiceOnly(pinnedGameplay.VOICE_ONLY_UI === true);
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
        onMediaDiagnostics: diagnostics => trackEvent("prd4_streaming_avatar_media", {
          session_id: sid, provider: avatarSettings.activeProvider, ...diagnostics,
        }),
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

  const handleSelectCharacter = useCallback((character: RuntimeCharacter, profile: CharacterRuntimeReadiness | null) => {
    startingCharacterRef.current = character;
    activeCharacterRef.current = character;
    activeCharacterContextRef.current = null;
    selectedEncounterFrameRef.current = profile?.situationSummary ?? null;
    setActivePortraitUrl(profile?.portraitUrl ?? null);
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
    incrementalOutputEnabledRef.current = session.conversation_memory.incrementalOutputEnabled === true;
    const preset = session.conversation_memory.voicePreset;
    handsFreeSettingsRef.current = normalizeHandsFreeSettings(preset?.handsFree ?? { ...getGameplaySettings().VOICE_HANDS_FREE, interruptionStrategy: "text" });
    setHandsFreeEnabled(handsFreeSettingsRef.current.enabled);
    setVoiceOnly(preset?.voiceOnly === true);
    cleanupAudio();
    const now = Date.now();
    const timerWindow = resolveResumeTimerWindow(session.started_at, session.resume_expires_at, now);
    if (!timerWindow) {
      setResumableSession(null);
      return;
    }
    const { configuredDurationSeconds, elapsedSeconds, remainingSeconds } = timerWindow;
    const profile = await getCharacterRuntimeReadiness(session.active_character).catch(() => null);
    const characterContext = toCharacterExecutionContext(profile);
    if (!profile?.ready || !characterContext) {
      toast({
        title: "Personnage indisponible",
        description: "Sa fiche ou son attribution n’est pas complète. La reprise a été arrêtée pour protéger son identité.",
        variant: "destructive",
      });
      return;
    }
    const postureMode = session.user_posture_mode === "voice" || session.user_posture_mode === "surprise"
      ? session.user_posture_mode
      : null;
    const posture: UserPosture | null = session.user_posture_raw && postureMode
      ? { raw: session.user_posture_raw, mode: postureMode }
      : null;
    const latestGm = latestPostTurnForCharacter(session.gm_post_turn_log, session.active_character);

    const safeConversationLog = session.conversation_log.filter((message, index, messages) =>
      message.role === "user"
      || !responseClaimsForeignIdentity(message.content, inferSpokenWith(messages, index, session.active_character))
    );
    sessionIdRef.current = session.id;
    diagnosticTraceEnabledRef.current = session.diagnostic_trace_enabled;
    conversationRef.current = safeConversationLog;
    configuredSessionDurationRef.current = configuredDurationSeconds;
    sessionDurationRef.current = Math.min(configuredDurationSeconds, elapsedSeconds);
    triggeredVideoIdsRef.current = session.triggers_activated;
    activeCharacterRef.current = session.active_character;
    activeCharacterContextRef.current = characterContext;
    activeVoiceIdRef.current = profile.ttsVoiceId;
    activeTTSProviderIdRef.current = asTTSProviderId(profile.ttsProvider);
    setActivePortraitUrl(profile.portraitUrl);
    handoffCountRef.current = session.handoff_count;
    startingCharacterRef.current = session.active_character;
    setSelectedCharacter(session.active_character);
    setCurrentHandoffOffer(parseGmApprovedHandoffOffer(session.pending_handoff,
      session.active_character === "emma" ? "max" : "emma", session.orchestration_version_id));
    pendingGmGuidanceRef.current = latestGm?.execution_status === "executed"
      ? latestGm.next_turn_guidance?.trim() || null
      : null;
    pendingEmotionalStateRef.current = null;
    gmTopicsCoveredRef.current = latestGm?.topics_covered ?? [];
    endedRef.current = false;
    isProcessingRef.current = false;
    setActiveVideo(null);
    setSessionDurationSeconds(configuredDurationSeconds);
    timer.reset(remainingSeconds);
    timer.start();
    restoreConversation({
      conversationLog: safeConversationLog,
      userRoleProfile: session.player_role,
      userPosture: posture,
      hasSeenFilm: session.has_seen_film === "vu" || session.has_seen_film === "pas_vu" || session.has_seen_film === "rappel"
        ? session.has_seen_film
        : null,
      teaserSeen: session.teaser_shown === true,
      selectedCharacter: session.active_character,
    });
    const activeConversationLog = sliceConversationForCharacter(safeConversationLog, session.active_character);
    const lastCharacterReply = [...activeConversationLog].reverse().find((message) => message.role !== "user");
    const lastUser = [...activeConversationLog].reverse().find((message) => message.role === "user");
    setMaxSubtitle(lastCharacterReply?.content ?? "");
    setUserSubtitle(lastUser?.content ?? "");
    setResumableSession(null);
    trackEvent("prd4_session_resumed", {
      session_id: session.id,
      remaining_seconds: remainingSeconds,
      turns: safeConversationLog.filter((message) => message.role === "user").length,
    });
  }, [cleanupAudio, restoreConversation, resumableSession, setCurrentHandoffOffer, setSelectedCharacter, timer]);
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
    // Voice behavior was pinned with the session; admin changes affect new sessions.
    setHandsFreeEnabled(handsFreeSettingsRef.current.enabled);
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
    const characterContext = toCharacterExecutionContext(profile);
    if (!profile?.ready || !characterContext) {
      toast({
        title: "Personnage indisponible",
        description: "Sa fiche ou son attribution n’est pas complète. Aucun dialogue ne sera généré.",
        variant: "destructive",
      });
      setPhase("calling_max");
      return;
    }
    activeCharacterRef.current = startingCharacter;
    activeCharacterContextRef.current = characterContext;
    activeVoiceIdRef.current = profile?.ttsVoiceId ?? null;
    activeTTSProviderIdRef.current = asTTSProviderId(profile?.ttsProvider);
    setActivePortraitUrl(profile?.portraitUrl ?? null);
    handoffCountRef.current = 0;
    handoffRecommendationRef.current = null;
    setCurrentHandoffOffer(null);
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

    // Réplique d'ouverture du personnage actif (scriptée pour amorcer)
    const rawOpening = profile?.openingLine?.trim() || (startingCharacter === "max" ? OPENING_LINE : "Allô ?");
    const opening = guardCharacterResponse(rawOpening, characterContext).response;
    preloadRescueRef.current(startingCharacter, activeVoiceIdRef.current ?? undefined, activeTTSProviderIdRef.current ?? undefined);
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
    setCurrentHandoffOffer,
    timer,
  ]);


  const beginInputTelemetry = useCallback((mode: "push_to_talk" | "hands_free") => {
    inputTelemetryRef.current?.finish("cancelled");
    const turnIndex = conversationRef.current.filter((message) => message.role === "user").length + 1;
    const runtime = getRuntimeContext();
    const telemetry = createVoiceTurnV2({
      session_id: sessionIdRef.current, turn_id: createVoiceTurnId(sessionIdRef.current, turnIndex), turn_index: turnIndex,
      character: activeCharacterRef.current, environment_id: runtime.environmentId, context_type: runtime.contextType,
      input_mode: mode, latency_origin: "capture_start",
    }, performance.now(), recordVoiceTurnV2);
    inputTelemetryRef.current = telemetry;
    return telemetry;
  }, []);
  const finishInputTelemetry = useCallback((status: "failed" | "no_audio" | "cancelled") => {
    inputTelemetryRef.current?.finish(status);
    inputTelemetryRef.current = null;
  }, []);
  useEffect(() => () => { inputTelemetryRef.current?.finish("cancelled"); }, []);

  // ---- Conversation : process turn ------------------------------------------
  const processTurn = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current || !userText.trim() || endedRef.current) return;
      isProcessingRef.current = true;
      const inputReadyAt = turnInputReadyAtRef.current ?? performance.now();
      const latencyOrigin = turnInputReadyAtRef.current ? turnLatencyOriginRef.current : "transcript_final";
      turnInputReadyAtRef.current = null;
      turnLatencyOriginRef.current = "transcript_final";
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
      const turnCharacter = activeCharacterRef.current;
      const inputMode = handsFreeListeningRef.current ? "hands_free" : "push_to_talk";
      const runtime = getRuntimeContext();
      const telemetry = inputTelemetryRef.current ?? createVoiceTurnV2({
        session_id: sessionIdRef.current, turn_id: turnId, turn_index: turnIndex, character: turnCharacter,
        environment_id: runtime.environmentId, context_type: runtime.contextType, input_mode: inputMode,
        latency_origin: "transcript_final",
      }, inputReadyAt, recordVoiceTurnV2);
      inputTelemetryRef.current = null;
      telemetry.setOrigin(inputReadyAt, latencyOrigin === "ptt_finalized" ? "ptt_release" : inputMode === "hands_free" ? "app_turn_decision" : latencyOrigin);
      telemetry.observe("transcript_final");
      activeVoiceTelemetryRef.current = telemetry;
      if (detectorRef.current) telemetry.captureDsp(detectorRef.current.dsp);
      const finishAborted = () => telemetry.finish(
        turnController.signal.reason === "player-barge-in" ? "interrupted"
          : /deadline/.test(String(turnController.signal.reason)) ? "timeout" : "cancelled",
      );
      turnController.signal.addEventListener("abort", finishAborted, { once: true });
      const configuredDuration = configuredSessionDurationRef.current;
      const elapsed = configuredDuration - (timerRef.current?.remaining ?? configuredDuration);
      const llmSettings = (() => { try { return getLLMSettings(); } catch { return null; } })();
      const ttsService = getConfiguredTTSServiceInfo(activeTTSProviderIdRef.current ?? undefined);
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

      let streamedVoice: ReturnType<typeof prepareStreamedVoiceTurn> | null = null;
      let earlyFirstPlaybackAt: number | null = null;
      let streamTtsStartedAt: number | null = null;
      let streamGenerationComplete = false;
      let responseReceipt: ResponseDeliveryReceipt | undefined;
      let responseMessage: ConversationMessage | null = null;
      const owningSessionId = sessionIdRef.current;
      const persistReceipt = (receipt: ResponseDeliveryReceipt) => {
        responseReceipt = receipt;
        if (owningSessionId) void persistDeliveryReceipt(owningSessionId, receipt).catch(error => {
          console.error('[P1 delivery] Receipt persistence failed; local receipt retained', error);
        });
        const existing = responseMessage ?? conversationRef.current.find(m => m.delivery?.turnId === receipt.turnId);
        if (existing) { existing.delivery = receipt; existing.content = receipt.generated; }
        else if ((turnController.signal.aborted || receipt.status === 'failed') && receipt.generated && sessionIdRef.current === owningSessionId) {
          const interrupted = tagSpokenWith({ role: turnCharacter, content: receipt.generated,
            delivery: receipt, timestamp: Date.now() }, turnCharacter);
          conversationRef.current = [...conversationRef.current, interrupted];
          addMessage(interrupted);
        }
        if (owningSessionId && sessionIdRef.current === owningSessionId) {
          void updatePRD4Conversation(owningSessionId, conversationRef.current);
        }
      };
      try {
        const turnCharacterContext = activeCharacterContextRef.current;
        if (!turnCharacterContext || turnCharacterContext.characterKey !== activeCharacterRef.current) {
          throw new Error("Character context is missing or obsolete; generation blocked");
        }
        // Traçabilité : version de fiche utilisée par personnage, écrite une fois par changement.
        if (sessionIdRef.current && promptVersionsRef.current[turnCharacterContext.characterKey] !== turnCharacterContext.promptUpdatedAt) {
          promptVersionsRef.current = { ...promptVersionsRef.current, [turnCharacterContext.characterKey]: turnCharacterContext.promptUpdatedAt };
          void updatePRD4ExperienceState(sessionIdRef.current, {
            characterPromptVersions: promptVersionsRef.current,
            gmCodeVersion: GM_CODE_VERSION,
          }).catch(() => undefined);
        }
        const postVideoContext = pendingPostVideoContextRef.current ?? undefined;
        pendingPostVideoContextRef.current = null;
        // Consommation one-shot : une guidance périmée ne doit pas survivre à son tour.
        const requestedSwitch = detectPlayerSwitchRequest(userText, activeCharacterRef.current);
        const switchGuidance = requestedSwitch
          ? buildSwitchRequestGuidance(activeCharacterRef.current, requestedSwitch)
          : null;
        const gmGuidance = [pendingGmGuidanceRef.current, switchGuidance].filter(Boolean).join(" ") || null;
        pendingGmGuidanceRef.current = null;
        const handoffProposalForThisTurn = handoffRecommendationRef.current;
        handoffRecommendationRef.current = null;
        const priorConversation = sliceConversationForCharacter(
          conversationRef.current.slice(0, -1),
          activeCharacterRef.current,
        );
        const incremental = incrementalOutputEnabledRef.current
          && responseOutputRef.current?.mode === 'tts'
          && (activeTTSProviderIdRef.current ?? getActiveProviderId()) === 'gradium';
        if (incremental) {
          streamTtsStartedAt = performance.now();
          lastCharacterTextRef.current = '';
          const voiceId = activeVoiceIdRef.current ?? undefined;
          const performanceIntent = derivePerformanceIntent({ text: '', characterKey: turnCharacter,
            previousEmotionalState: pendingEmotionalStateRef.current, userMessage: userText });
          streamedVoice = prepareStreamedVoiceTurn({ characterKey: turnCharacter, voiceId,
            performance: performanceIntent, signal: turnController.signal,
            turn_id: turnId, turn_index: turnIndex, session_id: owningSessionId,
            attempt_id: telemetry.attemptId, onVoiceObservation: telemetry.observe,
            onServiceObserved: telemetry.service }, {
            onPlaybackStart: () => {
              if (!isCurrentTurn()) return;
              earlyFirstPlaybackAt = performance.now();
              if (streamGenerationComplete && processingWatchdogRef.current) {
                window.clearTimeout(processingWatchdogRef.current); processingWatchdogRef.current = null;
              }
              setAudioState('max_speaking');
              // This watchdog protects generation until completion, even if audio has begun.
            },
            onReceipt: persistReceipt,

          });
          streamedVoiceRef.current = streamedVoice;
        }
        const turnInput = {
          sessionId: sessionIdRef.current,
          conversationHistory: priorConversation,
          userMessage: userText,
          userRole: userRoleRef.current,
          hasSeenFilm: hasSeenFilmRef.current,
          userPostureRaw: userPostureRef.current?.raw ?? null,
          timeElapsedSeconds: elapsed,
          characterContext: turnCharacterContext,
          triggeredVideoIds: triggeredVideoIdsRef.current,
          postVideoContext,
          gmGuidance,
          gmTopicsCovered: gmTopicsCoveredRef.current,
          onLatencySegment: handleLatencySegment,
          signal: turnController.signal,
          turnId,
          turnIndex,
          diagnosticTraceEnabled: diagnosticTraceEnabledRef.current,
          onVoiceObservation: telemetry.observe,
          onServiceObserved: telemetry.service,
          onServerObserved: telemetry.server,
          onVersionsObserved: telemetry.versions,
          onGmObserved: telemetry.gm,
        };
        const result = streamedVoice
          ? await streamPRD4Turn(turnInput, event => {
              streamedVoice?.onEvent(event);
              if (isCurrentTurn() && event.type === 'segment') {
                lastCharacterTextRef.current += ` ${event.text}`;
              }
            }, streamedVoice.delivery)
          : await processPRD4Turn(turnInput);

        if (!isCurrentTurn()) return;
        streamGenerationComplete = true;

        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }

        const ttsStart = streamTtsStartedAt ?? performance.now();
        const responseReadyMs = Math.max(0, Math.round(performance.now() - inputReadyAt));
        const blocker =
          (result.timings.max_ms ?? 0) >= (result.timings.rag_ms ?? 0) ? "max_ms" : "rag_ms";
        const maxMsg: ConversationMessage = tagSpokenWith({
          role: activeCharacterRef.current,
          content: result.maxResponse,
          timestamp: Date.now(),
          pipeline: {
            rag_ms: result.timings.rag_ms,
            max_ms: result.timings.max_ms,
            total_ms: responseReadyMs,
            latency_origin: latencyOrigin,
            first_sound_status: "not_measured",
            blocker,
            segmentServices: {
              rag_ms: ragService,
              max_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL),
            },
          },
        }, activeCharacterRef.current);
        responseMessage = maxMsg;
        if (responseReceipt) maxMsg.delivery = responseReceipt;
        conversationRef.current = [...conversationRef.current, maxMsg];
        addMessage(maxMsg);
        setMaxSubtitle(result.maxResponse);
        lastCharacterTextRef.current = result.maxResponse;
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
        let firstPlaybackAt: number | null = earlyFirstPlaybackAt;
        const outputController = new AbortController();
        activeOutputControllerRef.current = outputController;
        const abortOutputFromTurn = () => outputController.abort(turnController.signal.reason);
        turnController.signal.addEventListener("abort", abortOutputFromTurn, { once: true });
        if (earlyFirstPlaybackAt == null) processingWatchdogRef.current = window.setTimeout(() => {
          if (activeOutputControllerRef.current !== outputController || outputController.signal.aborted) return;
          console.warn("[PRD4] TTS first-audio watchdog fired — cancelling output only");
          outputController.abort("tts-first-audio-deadline");
          streamedVoice?.cancel("tts-first-audio-deadline");
          try { responseOutputRef.current?.interrupt(); } catch { /* ignore */ }
          setAudioState("idle");
          toast({
            title: "La voix prend trop de temps",
            description: "La réponse du personnage reste affichée. Tu peux continuer.",
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
          if (!isCurrentTurn() || outputController.signal.aborted) return;
          firstPlaybackAt ??= performance.now();
          // Blob/avatars expose software playback start, never a physical acoustic timestamp.
          if (!streamedVoice) telemetry.observe("output_estimated", firstPlaybackAt);
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
        const outputResult = await (streamedVoice ? streamedVoice.finish() : renderResponseText(result.maxResponse, {
          turnId,
          turnIndex,
          attemptId: telemetry.attemptId,
          onVoiceObservation: telemetry.observe,
          onServiceObserved: telemetry.service,
          signal: outputController.signal,
          onPlaybackStart,
          voiceId: activeVoiceIdRef.current ?? undefined,
          providerId: activeTTSProviderIdRef.current ?? undefined,
          characterKey: activeCharacterRef.current,
          userMessage: userText,
        })).finally(() => {
          turnController.signal.removeEventListener("abort", abortOutputFromTurn);
          if (activeOutputControllerRef.current === outputController) activeOutputControllerRef.current = null;
          if (!outputLatencySegmentDone) endLatencySegment(outputLatencySegmentId);
        });
        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }
        if (outputResult.status === "played") telemetry.observe("audio_end");
        if (streamedVoice && earlyFirstPlaybackAt != null) onPlaybackStart();
        telemetry.durations(outputResult.generatedSegments > 0 ? outputResult.generationWallMs ?? null : null, outputResult.status === "played" ? outputResult.playbackTotalMs : null,
          outputResult.videoLatency?.status !== "not_measured" ? outputResult.videoLatency?.waitMs : undefined);
        telemetry.finish(outputController.signal.aborted && /deadline/.test(String(outputController.signal.reason)) ? "timeout"
          : outputResult.status === "failed" ? "failed" : outputResult.status === "cancelled" ? "cancelled"
          : outputResult.started ? "completed" : "no_audio");
        if (!isCurrentTurn()) return;
        if (outputResult.status === "failed" && voiceOnly && rescueRef.current.has(turnCharacter)) {
          void playAudioBlobRobust(rescueRef.current.get(turnCharacter)!, undefined, undefined, turnController.signal);
        }
        resumeConversationTraceSync(true);
        const outputWaitMs = firstPlaybackAt == null ? undefined : Math.max(0, Math.round(firstPlaybackAt - ttsStart));
        const { ttsMs: tts_ms, videoMs: video_ms } = splitOutputLatency(outputWaitMs, outputResult.videoLatency);
        const voiceReadyMs = firstPlaybackAt == null ? undefined : Math.max(0, Math.round(firstPlaybackAt - inputReadyAt));
        if (maxMsg.pipeline) {
          if (video_ms != null) maxMsg.pipeline.video_ms = video_ms;
          if (outputResult.videoLatency) maxMsg.pipeline.video_status = outputResult.videoLatency.status;
          if (tts_ms != null && tts_ms > 0) {
            maxMsg.pipeline.tts_ms = tts_ms;
            maxMsg.pipeline.tts_first_playback_ms = tts_ms;
          }
          maxMsg.pipeline.total_ms = voiceReadyMs ?? responseReadyMs;
          maxMsg.pipeline.first_sound_status = voiceReadyMs != null
            ? "measured"
            : outputResult.status === "failed"
              ? "failed"
              : "not_measured";
          maxMsg.pipeline.segmentServices = {
            ...(maxMsg.pipeline.segmentServices || {}),
            ...(tts_ms != null ? { tts_ms: { serviceProvider: outputResult.provider, serviceName: outputResult.provider, model: outputResult.model ?? "Unknown" } } : {}),
            ...(outputResult.videoLatency ? { video_ms: {
              serviceProvider: outputResult.videoLatency.provider, serviceName: outputResult.videoLatency.provider,
              model: outputResult.videoLatency.model ?? "Unknown", mode: "webrtc", endpointType: "video",
            } } : {}),
          };
          if ((tts_ms ?? 0) > (maxMsg.pipeline.max_ms ?? 0) && (tts_ms ?? 0) > (maxMsg.pipeline.rag_ms ?? 0)) {
            maxMsg.pipeline.blocker = "tts_ms";
          }
          if ((video_ms ?? 0) > Math.max(tts_ms ?? 0, maxMsg.pipeline.max_ms ?? 0, maxMsg.pipeline.rag_ms ?? 0)) {
            maxMsg.pipeline.blocker = "video_ms";
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
          voice_modality: inputMode === "hands_free" ? "micro_ouvert" : "push_to_talk",
          user_message_len: userText.length,
          max_response_len: result.maxResponse.length,
          timings: {
            t_stt_total_ms: sttTelemetry?.t_stt_ms,
            t_rag_total_ms: result.timings.rag_ms,
            t_max_llm_ms: result.timings.max_ms,
            t_tts_total_ms: tts_ms,
            t_video_wait_ms: video_ms,
            t_audio_playback_total_ms: outputResult.playbackTotalMs,
            t_turn_response_ready_ms: responseReadyMs,
            t_turn_voice_ready_ms: voiceReadyMs,
          },
          models: {
            max_model: llmSettings?.LLM_MODEL,
            gm_model: llmSettings?.LLM_MODEL_GM,
          },
          rag: { matches_count: result.ragMatches },
          video: outputResult.videoLatency,
          had_fallback: outputResult.videoLatency?.fallbackUsed,
          tts: tts_ms == null ? undefined : {
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
          stt_trigger: inputMode === "hands_free" ? "silence" : "ptt_flush",
          latency_origin: latencyOrigin,
          had_error: outputResult.status === "failed",
          error_type: outputResult.status === "failed"
            ? (outputAtStart?.mode === "streaming_avatar" ? "streaming_avatar" : "tts")
            : null,
        }));

        // Persist conversation (best effort, fire-and-forget)
        if (sessionIdRef.current) {
          void updatePRD4Conversation(sessionIdRef.current, conversationRef.current);
        }

        const deliveredCharacterText = responseReceipt?.delivered ?? result.maxResponse;
        // ---- Directeur d'expérience unique : labels, mémoire, guidance et une
        // action recommandée, toujours après le texte et la voix du personnage.
        void result.postTurnPromise.then(async (ev) => {
          if (!isCurrentTurn()) return;
          const gmExecuted = ev.execution_status === "executed";
          pendingGmGuidanceRef.current = gmExecuted ? ev.next_turn_guidance?.trim() || null : null;
          if (gmExecuted) {
            pendingEmotionalStateRef.current = ev.memory_after?.relationship.emotionalState
              ?? pendingEmotionalStateRef.current;
          }
          if (gmExecuted && ev.topics_covered?.length) {
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
            character: ev.character_key,
            engagement_delta: ev.engagement_delta,
            end_recommended: ev.end_recommended,
            trigger_video_id: ev.trigger_video_id ?? null,
            latency_ms: ev.latency_ms,
            labels: ev.labels ?? null,
            action: ev.action ?? { type: "none" },
            orchestration_version_id: ev.orchestration_version_id ?? null,
            execution_status: ev.execution_status ?? "executed",
          });
          if (gmExecuted && ev.labels) {
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
          const gmStance = ev.player_switch_request?.targetCharacter === requestedSwitch
            ? ev.player_switch_request.stance : null;
          const currentAction = ev.action ?? { type: "none" };
          const requestedOffer: CharacterHandoffOffer | null = requestedSwitch
            && gmStance === "accept"
            && currentAction.type === "handoff" && currentAction.targetCharacter === requestedSwitch
            && hasCharacterHandoffConsent(deliveredCharacterText, requestedSwitch, gmStance)
            ? { targetCharacter: requestedSwitch, reason: currentAction.reason, proposalGuidance: currentAction.proposalGuidance }
            : null;
          const recommendedOffer = handoffProposalForThisTurn
            && hasCharacterHandoffConsent(deliveredCharacterText, handoffProposalForThisTurn.targetCharacter,
              ev.player_switch_request?.targetCharacter === handoffProposalForThisTurn.targetCharacter
                ? ev.player_switch_request.stance : undefined)
            ? handoffProposalForThisTurn : null;
          const consentedOffer = requestedOffer ?? recommendedOffer;
          const offerConfirmed = ev.execution_status === "executed" && consentedOffer
            && (currentAction.type === "none"
              || (currentAction.type === "handoff" && currentAction.targetCharacter === consentedOffer.targetCharacter));
          const decision: ExperienceDirectorDecisionV1 = applyTopicHandoffFallback({
            labels: gmExecuted ? ev.labels ?? { themes: [], topics: [], intentions: [] } : { themes: [], topics: [], intentions: [] },
            nextTurnGuidance: gmExecuted ? ev.next_turn_guidance || null : null,
            memoryDelta: gmExecuted ? ev.memory_delta ?? null : null,
            action: offerConfirmed ? { type: "handoff", ...consentedOffer }
              : ev.execution_status !== "executed" || requestedSwitch ? { type: "none" } : currentAction,
          }, ev.execution_status === "executed" && !requestedSwitch ? directorConfig : null, activeCharacterRef.current);
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
            targetReady: (targetCharacter === "emma" ? emmaProfile : maxProfile)?.enabled === true
              && (targetCharacter === "emma" ? emmaProfile : maxProfile)?.ready === true,
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

          if (guarded.action.type === "handoff" && offerConfirmed) {
            const offer = { reason: guarded.action.reason, proposalGuidance: guarded.action.proposalGuidance,
              targetCharacter: guarded.action.targetCharacter,
              gmApproval: { turnId, orchestrationVersionId: ev.orchestration_version_id! } };
            setCurrentHandoffOffer(offer);
            if (sid) {
              void updatePRD4ExperienceState(sid, { pendingHandoff: offer });
              void appendExperienceEvent({ sessionId: sid, eventKey: `handoff-proposed:${turnId}`,
                eventType: "handoff_proposed", turnId, turnIndex, character: activeCharacterRef.current,
                orchestrationVersionId: ev.orchestration_version_id,
                payload: { reason: offer.reason, targetCharacter: offer.targetCharacter } });
            }
            trackEvent("prd4_handoff_proposed", { session_id: sid, turn_id: turnId,
              turn_index: turnIndex, target_character: offer.targetCharacter });
          } else if (guarded.action.type === "handoff") {
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
        if (maxMsg.pipeline?.first_sound_status === "measured" && typeof maxMsg.pipeline.total_ms === "number") {
          turnLatenciesRef.current.push(maxMsg.pipeline.total_ms);
        }

      } catch (err) {
        telemetry.finish(turnController.signal.aborted ? "cancelled" : "failed");
        if (turnController.signal.aborted || activeTurnSequenceRef.current !== turnSequence) return;
        console.error("[PRD4] turn failed:", err);
        const diagnosticFailure = diagnosticTraceEnabledRef.current && !streamedVoice;
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
          description: diagnosticFailure ? "La réponse du personnage n’a pas été diffusée. Tu peux rejouer le tour après avoir vérifié la base." : "Réessaie.",
          variant: "destructive",
        });
      } finally {
        if (streamedVoiceRef.current === streamedVoice) { streamedVoiceRef.current = null; acousticRef.current?.reset(); }
        streamedVoice?.cancel('turn-cleanup');
        turnController.signal.removeEventListener("abort", finishAborted);
        if (activeTurnSequenceRef.current === turnSequence) {
          if (processingWatchdogRef.current) {
            window.clearTimeout(processingWatchdogRef.current);
            processingWatchdogRef.current = null;
          }
          isProcessingRef.current = false;
          setAudioState("idle");
          resumeConversationTraceSync(true);
          // Mains libres : l'écho de la réplique entendu pendant la lecture est oublié.
          if (handsFreeListeningRef.current && !handsFreeFinalizingRef.current) sttRef.current?.resume();
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
    setCurrentHandoffOffer,
      latencyOverlayEnabled,
      voiceOnly,
      setAudioState,
      setLastUserLabels,
      startLatencySegment,
    ],
  );

  // ---- PTT handlers : démarre/reprend STT, finalise au release -------------
  const teardownSTT = useCallback((preserveInputTelemetry = false) => {
    if (!preserveInputTelemetry) finishInputTelemetry("cancelled");
    pttFinalizingRef.current = false;
    handsFreeFinalizingRef.current = false;
    detectorRef.current?.stop(); detectorRef.current = null;
    acousticRef.current?.reset(); acousticVoiceRef.current = false;
    lastTranscriptRef.current = ""; discardedPrefixRef.current = "";
    const stt = sttRef.current;
    sttRef.current = null;
    try { stt?.stop(); } catch { /* ignore */ }
  }, [finishInputTelemetry]);

  const createSTT = useCallback(async (initialStream?: Promise<MediaStream>) => {
    teardownSTT(true);
    const captureSequence = activeTurnSequenceRef.current;
    const captureTelemetry = inputTelemetryRef.current;
    const stt = await createConfiguredSTT(
      (text, isFinal) => {
        if (sttRef.current !== stt || endedRef.current) return;
        if (handsFreeListeningRef.current) {
          handsFreeTranscriptRef.current?.(text, isFinal);
          return;
        }
        setUserSubtitle(text);
        if (isFinal && text.trim()) {
          endLatencySegment(sttLatencySegmentRef.current);
          sttLatencySegmentRef.current = null;
          stt.pause();
          void processTurn(text);
        }
      },
      {
        onError: (err) => handleVoiceInputError(inputTelemetryRef, captureTelemetry, sttRef.current === stt, () => {
          console.error("[PRD4 STT]", err);
          const wasHandsFree = handsFreeListeningRef.current;
          acousticRef.current?.sttFailed(performance.now());
          handsFreeListeningRef.current = false; setHandsFreeListening(false);
          // Mains libres : la réplique en cours continue, seul le micro est rouvert.
          // En appuyer-pour-parler, le tour en cours reste abandonné comme avant.
          if (!wasHandsFree) {
            activeTurnControllerRef.current?.abort("stt-recovery");
            activeOutputControllerRef.current?.abort("stt-recovery");
          }
          incrementPttError();
          trackEvent("prd4_ptt_error", { phase: "conversation", message: err.message, hands_free: wasHandsFree });
          setUserSubtitle("Micro indisponible — réessaie.");
          // Force reset: drop the dead STT so the next click recreates a fresh one
          teardownSTT();
          if (sttLatencySegmentRef.current) {
            endLatencySegment(sttLatencySegmentRef.current);
            sttLatencySegmentRef.current = null;
          }
          if (!wasHandsFree || !isProcessingRef.current) setAudioState("idle");
          if (wasHandsFree) scheduleMicRecoveryRef.current(`stt_error:${err.message}`);
        }),
        getTelemetryContext: () => {
          const turnIndex = conversationRef.current.filter((m) => m.role === "user").length + 1;
          return {
            session_id: sessionIdRef.current,
            turn_index: turnIndex,
            turn_id: createVoiceTurnId(sessionIdRef.current, turnIndex),
          };
        },
        initialStream,
        onVoiceObservation: (name, at) => {
          if (sttRef.current === stt) inputTelemetryRef.current?.observe(name, at);
          else if (!sttRef.current && inputTelemetryRef.current === captureTelemetry) captureTelemetry?.observe(name, at);
        },
        onServiceObserved: (service) => { if (sttRef.current === stt) inputTelemetryRef.current?.service(service); },
      },
    ).catch((error: unknown) => {
      if (endedRef.current || activeTurnSequenceRef.current !== captureSequence) {
        throw new DOMException("Voice capture replaced", "StaleCaptureError");
      }
      throw error;
    });
    const discardReplacedCapture = (): never => {
      try { void Promise.resolve(stt.stop()).catch(() => {}); } catch { /* already closed */ }
      throw new DOMException("Voice capture replaced", "StaleCaptureError");
    };
    if (endedRef.current || activeTurnSequenceRef.current !== captureSequence) {
      discardReplacedCapture();
    }
    sttRef.current = stt;
    try {
      await stt.start();
    } catch (error) {
      if (sttRef.current !== stt || endedRef.current) discardReplacedCapture();
      throw error;
    }
    if (sttRef.current !== stt || endedRef.current) {
      discardReplacedCapture();
    }
    recordPassiveVoiceNetworkObservation({
      sttConnected: true,
      lastSttConnectedAt: Date.now(),
    });
    stt.getStream?.()?.getAudioTracks?.().forEach(track => track.addEventListener?.("ended", () => {
      if (sttRef.current !== stt) return;
      activeTurnControllerRef.current?.abort("microphone-ended");
      activeOutputControllerRef.current?.abort("microphone-ended");
      try { responseOutputRef.current?.interrupt(); } catch { /* already closed */ }
      teardownSTT(); handsFreeListeningRef.current = false; setHandsFreeListening(false);
      isProcessingRef.current = false; setAudioState("idle");
    }, { once: true }));
    stt.setManualMode(true); // toggle-to-talk: pas de silence auto-finalize
    return stt;
  }, [endLatencySegment, finishInputTelemetry, incrementPttError, processTurn, setAudioState, teardownSTT]);

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
    beginInputTelemetry("push_to_talk");
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
      preloadRescueRef.current(activeCharacterRef.current, activeVoiceIdRef.current ?? undefined, activeTTSProviderIdRef.current ?? undefined);
      setAudioState("user_speaking");
    } catch (err) {
      void initialStream?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
      if (err instanceof Error && err.name === "StaleCaptureError") return;
      finishInputTelemetry("failed");
      console.warn("[PRD4] PTT start failed:", err);
      endLatencySegment(sttLatencySegmentRef.current);
      sttLatencySegmentRef.current = null;
      teardownSTT();
      incrementPttError();
      setAudioState("idle");
      resumeConversationTraceSync(true);
      toast({ title: "Micro indisponible", description: "Réessaie dans un instant.", variant: "destructive" });
    }
  }, [
    beginInputTelemetry,
    finishInputTelemetry,
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
    turnInputReadyAtRef.current = performance.now();
    inputTelemetryRef.current?.observe("turn_decided", turnInputReadyAtRef.current);
    turnLatencyOriginRef.current = "ptt_finalized";
    setAudioState("user_finalizing");
    try {
      // Every provider resolves only after its audio tail and latest transcript
      // revision have been preserved. The final callback starts processTurn.
      await stt.flush();
    } catch (error) {
      if (sttRef.current !== stt) return;
      finishInputTelemetry("failed");
      throw error;
    } finally {
      if (sttRef.current === stt) {
        pttFinalizingRef.current = false;
        endLatencySegment(sttLatencySegmentRef.current);
        sttLatencySegmentRef.current = null;
        if (!isProcessingRef.current) {
          finishInputTelemetry("no_audio");
          turnInputReadyAtRef.current = null;
          turnLatencyOriginRef.current = "transcript_final";
          setAudioState("idle");
          setUserSubtitle("");
          teardownSTT();
        }
      }
    }
  }, [endLatencySegment, finishInputTelemetry, setAudioState, teardownSTT]);

  // ---- Mains libres -----------------------------------------------------------
  useEffect(() => {
    handsFreeBlockedRef.current = handoffCalling || Boolean(handoffOffer) || Boolean(activeVideo) || state.phase !== "conversation_max";
    if (handsFreeBlockedRef.current) {
      finishInputTelemetry("cancelled");
      if (handsFreeTimerRef.current) clearTimeout(handsFreeTimerRef.current);
      handsFreeTimerRef.current = null;
      acousticRef.current?.reset(); acousticVoiceRef.current = false;
      discardedPrefixRef.current = ""; lastTranscriptRef.current = "";
      if (handsFreeListeningRef.current) {
        handsFreeNeedsRearmRef.current = true;
        teardownSTT();
        activeTurnSequenceRef.current++;
        activeTurnControllerRef.current?.abort("capture-interlude");
        activeOutputControllerRef.current?.abort("capture-interlude");
        isProcessingRef.current = false;
      }
    } else if (handsFreeNeedsRearmRef.current && handsFreeListeningRef.current) {
      handsFreeNeedsRearmRef.current = false;
      handsFreeListeningRef.current = false;
      void rearmHandsFreeRef.current();
    }
  }, [activeVideo, finishInputTelemetry, handoffCalling, handoffOffer, state.phase, teardownSTT]);

  /** Le joueur coupe la parole : la voix s'arrête, le tour en cours est abandonné. */
  const interruptCharacter = useCallback(() => {
    const estimatedStop = streamedVoiceRef.current?.estimatedStopAt();
    if (estimatedStop != null) activeVoiceTelemetryRef.current?.observe("output_stop_estimated", estimatedStop);
    if (processingWatchdogRef.current) {
      window.clearTimeout(processingWatchdogRef.current);
      processingWatchdogRef.current = null;
    }
    activeTurnSequenceRef.current += 1;
    activeTurnControllerRef.current?.abort("player-barge-in");
    activeTurnControllerRef.current = null;
    activeOutputControllerRef.current?.abort("player-barge-in");
    activeOutputControllerRef.current = null;
    try { responseOutputRef.current?.interrupt(); } catch { /* ignore */ }
    isProcessingRef.current = false;
    resumeConversationTraceSync(true);
    setAudioState("user_speaking");
    trackEvent("prd4_barge_in", { session_id: sessionIdRef.current, character: activeCharacterRef.current });
  }, [setAudioState]);

  const finalizeHandsFreeUtterance = useCallback(async () => {
    handsFreeTimerRef.current = null;
    const stt = sttRef.current;
    if (!stt || handsFreeFinalizingRef.current || isProcessingRef.current || handsFreeBlockedRef.current) return;
    if (acousticVoiceRef.current) {
      handsFreeTimerRef.current = window.setTimeout(() => void finalizeHandsFreeUtterance(), 100);
      return;
    }
    handsFreeFinalizingRef.current = true;
    turnInputReadyAtRef.current = performance.now();
    inputTelemetryRef.current?.observe("turn_decided", turnInputReadyAtRef.current);
    turnLatencyOriginRef.current = "transcript_final";
    setAudioState("user_finalizing");
    try {
      await stt.flush(); // le callback final lance processTurn
    } catch (error) {
      if (sttRef.current !== stt) return;
      finishInputTelemetry("failed");
      throw error;
    } finally {
      if (sttRef.current === stt) {
        handsFreeFinalizingRef.current = false;
        if (handsFreeListeningRef.current) stt.resume();
        if (!isProcessingRef.current) { finishInputTelemetry("no_audio"); setAudioState("idle"); }
      }
    }
  }, [finishInputTelemetry, setAudioState]);

  if (!acousticRef.current) acousticRef.current = createAcousticInterruptionController({
    observe: event => activeVoiceTelemetryRef.current?.interruption(event),
    confirm: text => { confirmedTextRef.current = text; interruptCharacter(); },
    discard: text => { discardedPrefixRef.current = text; },
    recover: () => {
      activeTurnControllerRef.current?.abort("stt-recovery");
      activeOutputControllerRef.current?.abort("stt-recovery");
      try { responseOutputRef.current?.interrupt(); } catch { /* already stopped */ }
      handsFreeListeningRef.current = false; setHandsFreeListening(false);
      teardownSTT(); isProcessingRef.current = false; setAudioState("idle");
      scheduleMicRecoveryRef.current("acoustic_recovery");
    },
  });

  handsFreeTranscriptRef.current = (rawText: string, isFinal: boolean) => {
    const settings = handsFreeSettingsRef.current;
    if (!rawText.trim() || handsFreeBlockedRef.current) return;
    // Le micro livre de la parole : le budget de reprise automatique est rendu.
    micRecoveryRef.current.reset(); micGaveUpRef.current = false;
    let text = rawText;
    if (isFinal) {
      if (isProcessingRef.current) return;
      text = withoutRejectedPrefix(text, discardedPrefixRef.current);
      lastTranscriptRef.current = ""; discardedPrefixRef.current = "";
      if (!text.trim()) return;
      endLatencySegment(sttLatencySegmentRef.current); sttLatencySegmentRef.current = null;
      setUserSubtitle(text); void processTurn(text); return;
    }
    const changed = recognizedWordsChanged(lastTranscriptRef.current, text);
    if (isProcessingRef.current) {
      const acoustic = settings.interruptionStrategy === "acoustic_confirmed" && detectorRef.current && streamedVoiceRef.current?.reversibleOutput;
      if (acoustic) {
        if (!acousticRef.current?.transcript(text, performance.now())) { lastTranscriptRef.current = text; return; }
        discardedPrefixRef.current = text.endsWith(confirmedTextRef.current) ? text.slice(0, text.length - confirmedTextRef.current.length) : "";
        text = confirmedTextRef.current;
      } else {
        if (!shouldBargeIn(text, lastCharacterTextRef.current, settings)) { lastTranscriptRef.current = text; return; }
        interruptCharacter();
      }
    } else text = withoutRejectedPrefix(text, discardedPrefixRef.current);
    lastTranscriptRef.current = rawText;
    if (!changed || !text.trim()) return;
    if (!inputTelemetryRef.current) beginInputTelemetry("hands_free");
    setUserSubtitle(text); setAudioState("user_speaking");
    if (handsFreeTimerRef.current) window.clearTimeout(handsFreeTimerRef.current);
    handsFreeTimerRef.current = window.setTimeout(() => void finalizeHandsFreeUtterance(), endOfSpeechDelayMs(text, settings));
  };

  const handleToggleHandsFree = useCallback(async () => {
    if (endedRef.current) return;
    if (handsFreeListeningRef.current) {
      handsFreeNeedsRearmRef.current = false;
      if (micRecoveryTimerRef.current) window.clearTimeout(micRecoveryTimerRef.current);
      micRecoveryTimerRef.current = null;
      if (handsFreeTimerRef.current) window.clearTimeout(handsFreeTimerRef.current);
      handsFreeTimerRef.current = null;
      handsFreeListeningRef.current = false;
      setHandsFreeListening(false);
      teardownSTT();
      if (!isProcessingRef.current) setAudioState("idle");
      return;
    }
    let initialStream: Promise<MediaStream> | undefined;
    handsFreeStartingRef.current = true;
    beginInputTelemetry("hands_free");
    try {
      initialStream = navigator.mediaDevices?.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      initialStream?.catch(() => { /* handled by createSTT */ });
      setAudioState("mic_starting");
      setUserSubtitle("");
      handsFreeListeningRef.current = true;
      const stt = await createSTT(initialStream);
      stt.setManualMode(true); // application-owned end of speech
      const stream = stt.getStream?.();
      if (stream && handsFreeSettingsRef.current.interruptionStrategy === "acoustic_confirmed") {
        const detector = await createLocalSpeechDetector(stream, (voiced, at) => {
          if (sttRef.current !== stt || !handsFreeListeningRef.current || handsFreeBlockedRef.current) return;
          acousticVoiceRef.current = voiced;
          const output = handsFreeSettingsRef.current.bargeInEnabled && isProcessingRef.current ? streamedVoiceRef.current?.reversibleOutput ?? null : null;
          acousticRef.current?.signal(voiced, at, output, lastTranscriptRef.current);
        }, () => {
          if (sttRef.current !== stt) return;
          activeTurnControllerRef.current?.abort("acoustic-capture-failed");
          activeOutputControllerRef.current?.abort("acoustic-capture-failed");
          try { responseOutputRef.current?.interrupt(); } catch { /* already stopped */ }
          teardownSTT(); handsFreeListeningRef.current = false; setHandsFreeListening(false);
          isProcessingRef.current = false; setAudioState("idle");
          scheduleMicRecoveryRef.current("acoustic_capture_failed");
        }).catch(() => null);
        if (sttRef.current !== stt || endedRef.current) { detector?.stop(); return; }
        detectorRef.current = detector;

      }
      preloadRescueRef.current(activeCharacterRef.current, activeVoiceIdRef.current ?? undefined, activeTTSProviderIdRef.current ?? undefined);
      setHandsFreeListening(true);
      if (!isProcessingRef.current) setAudioState("idle");
      trackEvent("prd4_hands_free_started", { session_id: sessionIdRef.current, ...handsFreeSettingsRef.current });
    } catch (err) {
      void initialStream?.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
      if (err instanceof Error && err.name === "StaleCaptureError") {
        // Capture remplacée pendant son ouverture (changement de tour, transfert…) :
        // sans micro et sans relance en attente, la reprise doit être reprogrammée.
        if (!endedRef.current && handsFreeListeningRef.current && !sttRef.current && !handsFreeNeedsRearmRef.current) {
          handsFreeListeningRef.current = false;
          setHandsFreeListening(false);
          scheduleMicRecoveryRef.current("stale_capture");
        }
        return;
      }
      finishInputTelemetry("failed");
      console.warn("[PRD4] hands-free start failed:", err);
      handsFreeListeningRef.current = false;
      setHandsFreeListening(false);
      teardownSTT();
      incrementPttError();
      setAudioState("idle");
      // Une réouverture automatique qui échoue est retentée avant d'alerter le joueur.
      if (micRecoveryRef.current.attempts === 0) {
        toast({ title: "Micro indisponible", description: "Réessaie dans un instant.", variant: "destructive" });
      } else scheduleMicRecoveryRef.current("rearm_failed");
    } finally {
      handsFreeStartingRef.current = false;
    }
  }, [beginInputTelemetry, createSTT, finishInputTelemetry, incrementPttError, setAudioState, teardownSTT]);

  rearmHandsFreeRef.current = handleToggleHandsFree;

  scheduleMicRecoveryRef.current = (reason: string) => {
    if (endedRef.current) return false;
    if (micRecoveryTimerRef.current) return true;
    const delay = micRecoveryRef.current.next();
    if (delay === null) {
      if (!micGaveUpRef.current) {
        micGaveUpRef.current = true;
        trackEvent("prd4_mic_recovery_failed", { session_id: sessionIdRef.current, reason });
        toast({ title: "Micro à réactiver", description: "La reconnaissance a coupé. Réactive le micro pour reprendre.", variant: "destructive" });
      }
      return false;
    }
    trackEvent("prd4_mic_recovery", { session_id: sessionIdRef.current, reason, attempt: micRecoveryRef.current.attempts, delay_ms: delay });
    setUserSubtitle("Reconnexion du micro…");
    micRecoveryTimerRef.current = window.setTimeout(() => {
      micRecoveryTimerRef.current = null;
      if (endedRef.current || handsFreeListeningRef.current || handsFreeNeedsRearmRef.current) return;
      if (handsFreeBlockedRef.current) {
        // Vidéo ou transfert en cours : l'effet de blocage rouvrira le micro à la fin.
        handsFreeNeedsRearmRef.current = true; handsFreeListeningRef.current = true;
        return;
      }
      void rearmHandsFreeRef.current();
    }, delay);
    return true;
  };

  // Filet de sécurité : un micro censé écouter sans flux STT connecté (fermeture
  // silencieuse du fournisseur) est relancé sans attendre une action du joueur.
  useEffect(() => {
    if (!handsFreeListening) return;
    let strikes = 0;
    const id = window.setInterval(() => {
      const dead = isMicSilentlyDead({
        listening: handsFreeListeningRef.current,
        ended: endedRef.current,
        blocked: handsFreeBlockedRef.current || handsFreeNeedsRearmRef.current,
        starting: handsFreeStartingRef.current || micRecoveryTimerRef.current !== null,
        sttActive: sttRef.current?.isActive === true,
      });
      strikes = dead ? strikes + 1 : 0;
      if (strikes < MIC_WATCHDOG_STRIKES) return;
      strikes = 0;
      console.warn("[PRD4] hands-free mic lost without error — reopening");
      handsFreeListeningRef.current = false; setHandsFreeListening(false);
      teardownSTT();
      if (!isProcessingRef.current) setAudioState("idle");
      scheduleMicRecoveryRef.current("watchdog");
    }, 2_000);
    return () => window.clearInterval(id);
  }, [handsFreeListening, setAudioState, teardownSTT]);

  useEffect(() => () => {
    if (micRecoveryTimerRef.current) window.clearTimeout(micRecoveryTimerRef.current);
    micRecoveryTimerRef.current = null;
  }, []);

  const handleHangUp = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("user_hangup");
  }, [finalizeAndEnd]);

  const switchToCharacter = useCallback(async (target: RuntimeCharacter) => {
    if (endedRef.current || handoffCallingRef.current || activeCharacterRef.current === target
      || acceptedHandoffRef.current?.targetCharacter !== target) return;
    const source = "gm" as const;
    handoffCallingRef.current = true;
    const from = activeCharacterRef.current;
    activeTurnControllerRef.current?.abort("character-switch");
    activeOutputControllerRef.current?.abort("character-switch");
    activeTurnSequenceRef.current += 1;
    const switchSequence = activeTurnSequenceRef.current;
    setHandoffCallingTarget(target);
    setHandoffCalling(true);
    setApprovedCallingTarget(null);
    const sid = sessionIdRef.current;
    const isSwitchCurrent = () => !endedRef.current &&
      activeTurnSequenceRef.current === switchSequence && sessionIdRef.current === sid;
    const eventSuffix = `:gm-${handoffAttemptIdRef.current ?? crypto.randomUUID()}`;
    const targetName = characterDisplayName(target);
    trackEvent("prd4_handoff_accepted", { session_id: sid, target_character: target, source });
    if (sid) void appendExperienceEvent({
      sessionId: sid,
      eventKey: `handoff-accepted:${from}-${target}${eventSuffix}`,
      eventType: "handoff_accepted",
      character: from,
      payload: { reason: source, targetCharacter: target },
    });
    try {
      const profile = await getCharacterRuntimeReadiness(target).catch(() => null);
      if (!isSwitchCurrent()) return;
      const characterContext = toCharacterExecutionContext(profile);
      if (!profile?.enabled || !profile.ready || !characterContext) {
        throw new Error(`${targetName} n’a pas de fiche et d’attribution validées dans Orchestration.`);
      }
      if (target === "emma") await activateTTSFallback("emma_handoff_tts_v1");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
      if (!isSwitchCurrent()) return;
      const firstContact = !hasSpokenWithCharacter(conversationRef.current, target);
      const nextHandoffCount = handoffCountRef.current + 1;
      // A refused session write must leave the displayed actor and counter
      // intact, so the approved offer can safely retry the same transition.
      if (sid) await updatePRD4ExperienceState(sid, {
        activeCharacter: target,
        pendingHandoff: null,
        handoffCount: nextHandoffCount,
      });
      if (!isSwitchCurrent()) return;
      pendingGmGuidanceRef.current = null;
      pendingEmotionalStateRef.current = null;
      pendingPostVideoContextRef.current = null;
      gmTopicsCoveredRef.current = [];
      handoffRecommendationRef.current = null;
      activeCharacterRef.current = target;
      activeCharacterContextRef.current = characterContext;
      activeVoiceIdRef.current = profile?.ttsVoiceId ?? null;
      activeTTSProviderIdRef.current = asTTSProviderId(profile?.ttsProvider);
      setActivePortraitUrl(profile?.portraitUrl ?? null);
      handoffCountRef.current = nextHandoffCount;
      setSelectedCharacter(target);
      setCurrentHandoffOffer(null);
      const recordExecuted = () => {
        if (sid) {
          void appendExperienceEvent({
            sessionId: sid,
            eventKey: `handoff-executed:${from}-${target}${eventSuffix}`,
            eventType: "handoff_executed",
            character: target,
            payload: { timerPreserved: true, sessionPreserved: true, firstContact, source },
          });
        }
        trackEvent("prd4_handoff_executed", { session_id: sid, target_character: target, first_contact: firstContact, source });
      };
      const rawOpeningLine = profile?.openingLine?.trim() || (target === "max" ? OPENING_LINE : "Allô ?");
      const openingLine = guardCharacterResponse(rawOpeningLine, characterContext).response;
      const opening = tagSpokenWith({ role: target, content: openingLine, timestamp: Date.now() }, target);
      conversationRef.current = [...conversationRef.current, opening];
      addMessage(opening);
      setMaxSubtitle(openingLine);
      if (sid) await updatePRD4Conversation(sid, conversationRef.current);
      if (!isSwitchCurrent()) return;
      recordExecuted();
      acceptedHandoffRef.current = null;
      handoffCallingRef.current = false;
      approvedCallingTargetRef.current = null;
      setAudioState("max_speaking");
      setHandoffCalling(false);
      preloadRescueRef.current(target, profile?.ttsVoiceId ?? undefined, asTTSProviderId(profile?.ttsProvider) ?? undefined);
      const openingController = new AbortController();
      activeOutputControllerRef.current = openingController;
      await renderResponseText(openingLine, {
        turnId: `${sid ?? "local"}:${target}-opening`,
        turnIndex: conversationRef.current.filter((message) => message.role === "user").length,
        voiceId: profile?.ttsVoiceId ?? undefined,
        providerId: asTTSProviderId(profile?.ttsProvider) ?? undefined,
        characterKey: target,
        signal: openingController.signal,
      });
      if (!isSwitchCurrent()) return;
      setAudioState("idle");
    } catch (error) {
      if (!isSwitchCurrent()) return;
      setHandoffCalling(false);
      if (activeCharacterRef.current === from) setCurrentHandoffOffer(acceptedHandoffRef.current);
      toast({
        title: `${targetName} n’est pas disponible`,
        description: error instanceof Error ? error.message : `Restez avec ${characterDisplayName(from)}.`,
        variant: "destructive",
      });
      if (sid) void appendExperienceEvent({
        sessionId: sid,
        eventKey: `handoff-blocked-on-accept:${from}-${target}${eventSuffix}`,
        eventType: "handoff_blocked",
        character: from,
        payload: { blockedReason: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      if (isSwitchCurrent()) {
        handoffCallingRef.current = false;
        approvedCallingTargetRef.current = null;
        acceptedHandoffRef.current = null;
      }
    }
  }, [activateTTSFallback, addMessage, renderResponseText, setAudioState, setCurrentHandoffOffer, setSelectedCharacter]);

  const handleAcceptHandoff = useCallback(() => {
    if (endedRef.current || state.audioState === "mic_starting" || handoffCallingRef.current || approvedCallingTargetRef.current) return;
    const offer = handoffOfferRef.current;
    if (!offer?.gmApproval || offer.targetCharacter === activeCharacterRef.current) return;
    const target = offer.targetCharacter;
    finishInputTelemetry("cancelled");
    cleanupAudio();
    acceptedHandoffRef.current = offer;
    setCurrentHandoffOffer(null);
    if (processingWatchdogRef.current) window.clearTimeout(processingWatchdogRef.current);
    processingWatchdogRef.current = null;
    isProcessingRef.current = false;
    resumeConversationTraceSync(true);
    setUserSubtitle("");
    setMaxSubtitle("");
    setAudioState("idle");
    approvedCallingTargetRef.current = target;
    handoffAttemptIdRef.current = crypto.randomUUID();
    setApprovedCallingTarget(target);
  }, [cleanupAudio, finishInputTelemetry, setAudioState, setCurrentHandoffOffer, state.audioState]);

  const handleApprovedCallAnswered = useCallback(() => {
    const target = approvedCallingTargetRef.current;
    if (target && !endedRef.current) void switchToCharacter(target);
  }, [switchToCharacter]);


  const handleRejectHandoff = useCallback(() => {
    if (approvedCallingTargetRef.current || handoffCallingRef.current) return;
    const offer = handoffOfferRef.current;
    if (!offer) return;
    setCurrentHandoffOffer(null);
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
  }, [setCurrentHandoffOffer]);

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
    introductionReviewRef.current = false;
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
    activeCharacterContextRef.current = null;
    activeVoiceIdRef.current = null;
    activeTTSProviderIdRef.current = null;
    handoffCountRef.current = 0;
    handoffRecommendationRef.current = null;
    startingCharacterRef.current = "max";
    setCurrentHandoffOffer(null);
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
  }, [cleanupAudio, reset, setCurrentHandoffOffer]);

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
    case "volunteer_briefing":
    case "film_question":
      screen = <FilmQuestionScreen onAnswer={handleFilmAnswer} />;
      break;
    case "transition_max":
      screen = <TransitionScreen onContinue={handleAnswered} />;
      break;
    case "character_select":
      screen = (
        <CharacterSelectScreen
          onSelect={handleSelectCharacter}
          onLockedClick={handleLockedClick}
          onReviewIntroduction={handleIntroductionReview}
        />
      );
      break;
    case "calling_max":
      screen = <CallingMaxScreen character={startingCharacterRef.current} situation={selectedEncounterFrameRef.current} portraitUrl={activePortraitUrl} onAnswered={handleAnswered} />;
      break;
    case "conversation_max":
      screen = (
        <>
          {!activeVideo?.video_url ? (
            approvedCallingTarget ? (
              <CallingMaxScreen character={approvedCallingTarget} onAnswered={handleApprovedCallAnswered} />
            ) : (
            <ConversationScreen
              audioState={state.audioState}
              userSubtitle={userSubtitle}
              maxSubtitle={maxSubtitle}
              conversationLog={state.conversationLog}
              sessionTimeRemaining={timer.formatted}
              onPTTPress={handlePTTPress}
              onPTTRelease={handlePTTRelease}
              handsFree={handsFreeEnabled}
              voiceOnly={voiceOnly}
              handsFreeListening={handsFreeListening}
              onToggleHandsFree={() => { micRecoveryRef.current.reset(); micGaveUpRef.current = false; void handleToggleHandsFree(); }}
              onHangUp={handleHangUp}
              streamingAvatarActive={streamingAvatarActive}
              streamingAvatarState={streamingAvatarState}
              attachAvatarMedia={attachAvatarMedia}
              activeCharacter={state.selectedCharacter}
              portraitUrl={activePortraitUrl}
              handoffOffer={handoffOffer}
              handoffCalling={handoffCalling}
              handoffCallingTarget={handoffCallingTarget}
              onAcceptHandoff={() => void handleAcceptHandoff()}
              onRejectHandoff={handleRejectHandoff}
            />
            )
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
