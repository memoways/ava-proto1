/**
 * IndexPRD4 — Nouveau parcours (mai 2026).
 *
 * Phase 3 : Max contextualisé (résumé du rôle joueur injecté), conversation
 * réelle STT + TTS via TTSQueue, GM post-turn PRD4 en void (jamais bloquant).
 * Fin de session : 5 min OU `end_recommended` du GM.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useExperienceState } from "@/hooks/useExperienceState";
import type { AudioState, ConversationMessage, FilmAnswer } from "@/types";
import { trackEvent } from "@/services/posthogService";
import { summarizeRole } from "@/services/roleProfileService";
import { processPRD4Turn } from "@/services/prd4Orchestrator";
import { createPRD4Session, endPRD4Session, updatePRD4Conversation, updatePRD4Onboarding } from "@/services/prd4Session";
import { createConfiguredSTT, loadSTTSettingsFromDB, type STTSession } from "@/services/stt";
import { TTSQueue, chunkTextForTTS } from "@/services/elevenLabsTTS";
import { getLLMSettings } from "@/services/settingsService";
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

import WelcomeScreen from "@/components/prd4/WelcomeScreen";
import FilmQuestionScreen from "@/components/prd4/FilmQuestionScreen";
import TeaserScreen from "@/components/prd4/TeaserScreen";
import PostureCaptureScreen from "@/components/prd4/PostureCaptureScreen";
import TransitionScreen from "@/components/prd4/TransitionScreen";
import RoleCaptureScreen from "@/components/prd4/RoleCaptureScreen";
import RoleSummaryScreen from "@/components/prd4/RoleSummaryScreen";
import CharacterSelectScreen from "@/components/prd4/CharacterSelectScreen";
import CallingMaxScreen from "@/components/prd4/CallingMaxScreen";
import ConversationScreen from "@/components/prd4/ConversationScreen";
import EndSessionScreen from "@/components/prd4/EndSessionScreen";
import QuestionnaireScreenPRD4 from "@/components/prd4/QuestionnaireScreenPRD4";
import ThanksScreen from "@/components/ThanksScreen";
import GumletVideoPlayer from "@/components/GumletVideoPlayer";
import { savePRD4Questionnaire, syncPRD4QuestionnaireToNotion } from "@/services/prd4Questionnaire";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { pickVideoForLabels } from "@/services/videoTriggerMatcher";
import {
  loadVideoTriggerSettingsFromDB,
  videoTriggerDefaults,
  type VideoTriggerSettings,
} from "@/services/settingsService";
import type { QuestionnairePRD4Answers, QuestionnairePRD4Data, UserPosture } from "@/types";

const SESSION_DURATION_S = 5 * 60; // PRD4 §11 : ~5 min cible.

const IndexPRD4 = () => {
  const {
    state,
    setPhase,
    setFilmAnswer,
    markTeaserSeen,
    setRoleProfile,
    setUserPosture,
    setAudioState,
    addMessage,
    incrementPttError,
    endExperience,
    reset,
    setLastUserLabels,
  } = useExperienceState();

  const [userSubtitle, setUserSubtitle] = useState("");
  const [maxSubtitle, setMaxSubtitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
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
  const ttsQueueRef = useRef<TTSQueue | null>(null);
  const sttLatencySegmentRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const isProcessingRef = useRef(false);
  const processingWatchdogRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const userRoleRef = useRef(state.userRoleProfile);
  userRoleRef.current = state.userRoleProfile;
  const userPostureRef = useRef<UserPosture | null>(state.userPosture);
  userPostureRef.current = state.userPosture;
  const turnLatenciesRef = useRef<number[]>([]);
  const sessionDurationRef = useRef<number>(0);
  const triggeredVideoIdsRef = useRef<string[]>([]);
  const lastVideoTurnRef = useRef<number>(-Infinity);
  const videoTriggerSettingsRef = useRef<import("@/services/settingsService").VideoTriggerSettings>(
    require("@/services/settingsService").videoTriggerDefaults,
  );
  const pendingPostVideoContextRef = useRef<string | null>(null);
  const [submittingQuestionnaire, setSubmittingQuestionnaire] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoTriggerRow | null>(null);
  // Chrono onboarding (mesure du time-to-first-Max-response)
  const onboardingStartedAtRef = useRef<number | null>(null);
  const firstMaxResponseAtRef = useRef<number | null>(null);



  // Timer 5 minutes — démarré quand on entre en conversation, fin auto à 0.
  const handleTimeout = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("timeout_5min");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const timer = useTimer(SESSION_DURATION_S, handleTimeout);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // PostHog : phase tracking
  useEffect(() => {
    trackEvent("prd4_phase_changed", { phase: state.phase });
  }, [state.phase]);

  useEffect(() => {
    void loadSTTSettingsFromDB();
  }, []);

  // ---- Helpers conversation -------------------------------------------------
  const cleanupAudio = useCallback(() => {
    try { sttRef.current?.stop(); } catch { /* ignore */ }
    sttRef.current = null;
    try { ttsQueueRef.current?.cancel(); } catch { /* ignore */ }
    ttsQueueRef.current = null;
  }, []);

  const finalizeAndEnd = useCallback(
    async (reason: string) => {
      cleanupAudio();
      const sid = sessionIdRef.current;
      const duration = SESSION_DURATION_S - (timerRef.current?.remaining ?? SESSION_DURATION_S);
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
  const handleStart = useCallback(() => {
    onboardingStartedAtRef.current = Date.now();
    firstMaxResponseAtRef.current = null;
    trackEvent("prd4_onboarding_started", {});
    // L'écran "As-tu vu le film ?" est retiré : on enchaîne directement sur le teaser.
    setFilmAnswer("rappel");
    setPhase("teaser");
  }, [setFilmAnswer, setPhase]);
  const handleFilmAnswer = useCallback(
    (a: FilmAnswer) => {
      setFilmAnswer(a);
      trackEvent("prd4_film_answered", { answer: a });
      if (a === "vu") {
        setPhase("posture_capture");
      } else {
        setPhase("teaser");
      }
    },
    [setFilmAnswer, setPhase],
  );
  const handleTeaserContinue = useCallback(() => {
    markTeaserSeen(false);
    setPhase("posture_capture");
  }, [markTeaserSeen, setPhase]);
  const handleTeaserSkip = useCallback(() => {
    markTeaserSeen(true);
    setPhase("posture_capture");
  }, [markTeaserSeen, setPhase]);

  // ---- Posture capture (GIFF) ----------------------------------------------
  const handlePostureSubmit = useCallback(
    (raw: string) => {
      setUserPosture({ raw, mode: "voice" });
      trackEvent("giff_posture_captured", { mode: "voice", length: raw.length });
      setPhase("character_select");
    },
    [setUserPosture, setPhase],
  );
  const handlePostureSurprise = useCallback(() => {
    setUserPosture({ raw: "", mode: "surprise" });
    trackEvent("giff_posture_captured", { mode: "surprise", length: 0 });
    setPhase("character_select");
  }, [setUserPosture, setPhase]);
  const handlePosturePTTError = useCallback(
    (err: Error) => {
      incrementPttError();
      trackEvent("prd4_ptt_error", { phase: "posture_capture", message: err.message });
    },
    [incrementPttError],
  );

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
  const handleSelectMax = useCallback(() => setPhase("calling_max"), [setPhase]);
  const handleLockedClick = useCallback(
    (id: "emma" | "ava" | "leo") => trackEvent("prd4_character_locked_clicked", { character: id }),
    [],
  );

  // ---- Calling → conversation : créer session + ouvrir TTS ------------------
  const handleAnswered = useCallback(async () => {
    setPhase("conversation_max");
    endedRef.current = false;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;
    triggeredVideoIdsRef.current = [];
    pendingPostVideoContextRef.current = null;
    setActiveVideo(null);


    // Crée la session DB (toujours, en mode hard-codé) — persiste posture utilisateur
    try {
      const sid = await createPRD4Session(state.userRoleProfile, "max");
      sessionIdRef.current = sid;
      trackEvent("prd4_session_started", { session_id: sid });
      const startedAt = onboardingStartedAtRef.current;
      const posture = userPostureRef.current;
      void updatePRD4Onboarding(sid, {
        has_seen_film: state.hasSeenFilm ?? null,
        teaser_shown: state.teaserSeen,
        user_posture_raw: posture?.raw ?? null,
        user_posture_mode: posture?.mode ?? null,
        onboarding_started_at: startedAt ? new Date(startedAt).toISOString() : null,
      });
    } catch (err) {
      console.warn("[PRD4] createSession failed (continuing without DB persistence):", err);
    }

    // Démarre le timer 5 min
    timer.reset();
    timer.start();

    // Réplique d'ouverture de Max (scriptée pour amorcer)
    const opening = "Hallo... à qui ai-je affaire ?";
    setMaxSubtitle(opening);
    const openingMsg: ConversationMessage = { role: "max", content: opening, timestamp: Date.now() };
    conversationRef.current = [openingMsg];
    addMessage(openingMsg);
    setAudioState("max_speaking");

    // TTS de l'ouverture
    try {
      const queue = new TTSQueue({ onError: (e) => console.warn("[TTS] opening error:", e.message) });
      ttsQueueRef.current = queue;
      for (const chunk of chunkTextForTTS(opening)) {
        queue.enqueue(chunk, { session_id: sessionIdRef.current ?? undefined });
      }
      await queue.drain();
    } catch (err) {
      console.warn("[TTS] opening failed:", err);
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
  }, [addMessage, setAudioState, setPhase, state.hasSeenFilm, state.teaserSeen, state.userRoleProfile, timer]);


  // ---- Conversation : process turn ------------------------------------------
  const processTurn = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current || !userText.trim() || endedRef.current) return;
      isProcessingRef.current = true;
      // Watchdog : si le tour ne se termine pas en 60s, on libère le verrou pour ne pas bloquer l'UX
      if (processingWatchdogRef.current) window.clearTimeout(processingWatchdogRef.current);
      processingWatchdogRef.current = window.setTimeout(() => {
        console.warn("[PRD4] turn watchdog fired — releasing processing lock");
        isProcessingRef.current = false;
        setAudioState("idle");
        toast({ title: "Le tour a pris trop de temps", description: "Tu peux reparler.", variant: "destructive" });
      }, 60_000);
      setAudioState("max_thinking");
      setUserSubtitle(userText);

      const userMsg: ConversationMessage = { role: "user", content: userText, timestamp: Date.now() };
      conversationRef.current = [...conversationRef.current, userMsg];
      addMessage(userMsg);

      const turnIndex = conversationRef.current.filter((m) => m.role === "user").length;
      const turnId = createVoiceTurnId(sessionIdRef.current, turnIndex);
      const elapsed = SESSION_DURATION_S - (timerRef.current?.remaining ?? SESSION_DURATION_S);
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
          onLatencySegment: handleLatencySegment,
        });

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
        setAudioState("max_speaking");

        // TTS streaming
        let ttsLatencySegmentDone = false;
        const queue = new TTSQueue({
          onError: (e) => console.warn("[TTS] turn error:", e.message),
          onFirstPlaybackStart: () => {
            if (ttsLatencySegmentDone) return;
            ttsLatencySegmentDone = true;
            endLatencySegment(ttsLatencySegmentId);
          },
        });
        ttsQueueRef.current = queue;
        const ttsLatencySegmentId = latencyOverlayEnabled
          ? startLatencySegment({ segment: "TTS", service: latencyServiceLabel(ttsService) })
          : null;
        for (const chunk of chunkTextForTTS(result.maxResponse)) {
          queue.enqueue(chunk, { session_id: sessionIdRef.current ?? undefined, turn_id: turnId, turn_index: turnIndex });
        }
        const ttsResult = await queue.drain().finally(() => {
          if (!ttsLatencySegmentDone) endLatencySegment(ttsLatencySegmentId);
        });
        const tts_ms = ttsResult.firstPlaybackStartMs || ttsResult.generationWallMs || Math.round(performance.now() - ttsStart);
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
            t_audio_playback_total_ms: ttsResult.playbackTotalMs,
            t_turn_response_ready_ms: result.timings.total_ms,
            t_turn_voice_ready_ms: (result.timings.total_ms ?? 0) + tts_ms,
          },
          models: {
            max_model: llmSettings?.LLM_MODEL,
            gm_model: llmSettings?.LLM_MODEL_GM,
          },
          rag: { matches_count: result.ragMatches },
          tts: {
            provider: ttsService.serviceProvider,
            model: ttsService.model,
            segments_count: ttsResult.generatedSegments,
            segments_played: ttsResult.playedSegments,
            segments_failed: ttsResult.failedSegments,
          },
          stt: {
            provider: sttTelemetry?.provider,
            model: sttTelemetry?.model,
            mode: "realtime",
          },
          had_error: ttsResult.status === "failed",
          error_type: ttsResult.status === "failed" ? "tts" : null,
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
            const videos = await getVideoTriggersCached();
            const match = pickVideoForLabels(labels, videos, triggeredVideoIdsRef.current, userText);
            if (match) {
              pickedVideoId = match.row.id;
              triggeredVideoIdsRef.current = [...triggeredVideoIdsRef.current, match.row.id];
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
            try {
              const videos = await getVideoTriggersCached();
              const row = videos.find((v) => v.id === ev.trigger_video_id) || null;
              if (row?.video_url) {
                triggeredVideoIdsRef.current = [...triggeredVideoIdsRef.current, row.id];
                trackEvent("prd4_video_triggered", { session_id: sessionIdRef.current, video_id: row.id, title: row.title, source: "post_turn_fallback" });
                setActiveVideo(row);
              }
            } catch (err) {
              console.warn("[PRD4] post-turn video trigger fallback failed:", err);
            }
          }
          if (ev.end_recommended && !endedRef.current) {
            endedRef.current = true;
            void finalizeAndEnd("gm_end_recommended");
          }
        });

        trackEvent("prd4_turn_completed", {
          session_id: sessionIdRef.current,
          ...result.timings,
          rag_matches: result.ragMatches,
        });
        if (typeof result.timings?.total_ms === "number") {
          turnLatenciesRef.current.push(result.timings.total_ms);
        }

      } catch (err) {
        console.error("[PRD4] turn failed:", err);
        toast({ title: "Erreur dans la conversation", description: "Réessaie.", variant: "destructive" });
      } finally {
        if (processingWatchdogRef.current) {
          window.clearTimeout(processingWatchdogRef.current);
          processingWatchdogRef.current = null;
        }
        isProcessingRef.current = false;
        setAudioState("idle");
      }
    },
    [
      addCompletedLatencySegment,
      addMessage,
      endLatencySegment,
      finalizeAndEnd,
      latencyOverlayEnabled,
      setAudioState,
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
      isProcessingRef.current = false;
    }
    if (isProcessingRef.current) return;
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

  const handlePTTRelease = useCallback(() => {
    const stt = sttRef.current;
    if (!stt) {
      // Nothing recording — just normalize state
      setAudioState("idle");
      return;
    }
    stt.flush(); // déclenche le isFinal → processTurn si du texte a été capté
    // Si rien n'a été capté, on remet l'état au repos pour permettre une nouvelle tentative
    window.setTimeout(() => {
      endLatencySegment(sttLatencySegmentRef.current);
      sttLatencySegmentRef.current = null;
      if (!isProcessingRef.current) {
        setAudioState("idle");
        setUserSubtitle("");
        teardownSTT();
      }
    }, 1700);
  }, [endLatencySegment, setAudioState, teardownSTT]);

  const handleHangUp = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void finalizeAndEnd("user_hangup");
  }, [finalizeAndEnd]);

  // Cleanup au démontage
  useEffect(() => () => { cleanupAudio(); }, [cleanupAudio]);

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
    [setPhase, state.pttErrors, state.selectedCharacter, state.teaserSeen, state.teaserSkipped, state.userRoleProfile],
  );

  const handleRestart = useCallback(() => {
    reset();
    setUserSubtitle("");
    setMaxSubtitle("");
    sessionIdRef.current = null;
    conversationRef.current = [];
    turnLatenciesRef.current = [];
    sessionDurationRef.current = 0;
    triggeredVideoIdsRef.current = [];
    pendingPostVideoContextRef.current = null;
    setActiveVideo(null);
    endedRef.current = false;
  }, [reset]);


  // ---- Render ---------------------------------------------------------------
  switch (state.phase) {
    case "welcome":
      return <WelcomeScreen onStart={handleStart} />;
    case "film_question":
      return <FilmQuestionScreen onAnswer={handleFilmAnswer} />;
    case "teaser":
      return <TeaserScreen onContinue={handleTeaserContinue} onSkip={handleTeaserSkip} />;
    case "posture_capture":
      return (
        <PostureCaptureScreen
          onSubmit={handlePostureSubmit}
          onSurprise={handlePostureSurprise}
          onPTTError={handlePosturePTTError}
        />
      );
    case "transition_max":
      return <TransitionScreen onContinue={handleAnswered} />;
    case "role_capture":
      return (
        <RoleCaptureScreen
          onSubmit={handleRoleSubmit}
          onPTTError={handleRolePTTError}
          submitting={summarizing}
        />
      );
    case "role_summary":
      return state.userRoleProfile ? (
        <RoleSummaryScreen
          profile={state.userRoleProfile}
          onConfirm={handleRoleConfirm}
          onRestart={handleRoleRestart}
        />
      ) : null;
    case "character_select":
      return <CharacterSelectScreen onSelectMax={handleSelectMax} onLockedClick={handleLockedClick} />;
    case "calling_max":
      return <CallingMaxScreen onAnswered={handleAnswered} />;
    case "conversation_max":
      return (
        <>
          {activeVideo?.video_url ? (
            <GumletVideoPlayer
              videoUrl={activeVideo.video_url}
              onComplete={() => {
                pendingPostVideoContextRef.current = activeVideo.context || activeVideo.post_video_context || null;
                trackEvent("prd4_video_completed", { session_id: sessionIdRef.current, video_id: activeVideo.id, skipped: false });
                setActiveVideo(null);
              }}
              onSkip={() => {
                pendingPostVideoContextRef.current = activeVideo.context || activeVideo.post_video_context || null;
                trackEvent("prd4_video_completed", { session_id: sessionIdRef.current, video_id: activeVideo.id, skipped: true });
                setActiveVideo(null);
              }}
            />
          ) : (
            <ConversationScreen
              audioState={state.audioState}
              userSubtitle={userSubtitle}
              maxSubtitle={maxSubtitle}
              conversationLog={state.conversationLog}
              onPTTPress={handlePTTPress}
              onPTTRelease={handlePTTRelease}
              onHangUp={handleHangUp}
            />
          )}
          <LatencyOverlay enabled={latencyOverlayEnabled} segments={latencySegments} currentTurn={latencyCurrentTurn} />
        </>
      );
    case "end_session":
      return <EndSessionScreen onContinue={handleEndContinue} />;
    case "questionnaire":
      return (
        <QuestionnaireScreenPRD4
          teaserSeen={state.teaserSeen}
          onSubmit={handleQuestionnaireSubmit}
          onSkip={handleRestart}
          submitting={submittingQuestionnaire}
        />

      );
    case "thanks":
      return <ThanksScreen onRestart={handleRestart} />;
    default:
      return null;

  }
};

export default IndexPRD4;
